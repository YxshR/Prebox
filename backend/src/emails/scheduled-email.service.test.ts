import { ScheduledEmailService } from './scheduled-email.service';
import { ScheduledEmailRequest, ScheduleStatus } from './scheduled-email.types';
import { SubscriptionTier } from '../shared/types';

// Mock dependencies
jest.mock('./email.service');
jest.mock('../billing/subscription.service');
jest.mock('../billing/wallet.service');
jest.mock('../config/database');

describe('ScheduledEmailService', () => {
  let scheduledEmailService: ScheduledEmailService;

  beforeEach(() => {
    scheduledEmailService = new ScheduledEmailService();
    jest.clearAllMocks();
  });

  describe('scheduleEmail', () => {
    const mockRequest: ScheduledEmailRequest = {
      tenantId: 'tenant_123',
      campaignId: 'campaign_456',
      emailJob: {
        to: ['test@example.com'],
        from: 'sender@example.com',
        subject: 'Test Email',
        htmlContent: '<h1>Test</h1>',
        textContent: 'Test'
      },
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      userType: 'subscription'
    };

    it('should schedule an email successfully for subscription user', async () => {
      // Mock validation to pass
      jest.spyOn(scheduledEmailService, 'validateScheduling').mockResolvedValue({
        isValid: true
      });

      // Mock database save
      jest.spyOn(scheduledEmailService as any, 'saveScheduledEmail').mockResolvedValue(undefined);

      const result = await scheduledEmailService.scheduleEmail(mockRequest);

      expect(result).toBeDefined();
      expect(result.tenantId).toBe(mockRequest.tenantId);
      expect(result.status).toBe(ScheduleStatus.PENDING);
      expect(result.userType).toBe('subscription');
    });

    it('should schedule an email successfully for recharge user with cost estimation', async () => {
      const rechargeRequest = { ...mockRequest, userType: 'recharge' as const };

      // Mock validation to pass with estimated cost
      jest.spyOn(scheduledEmailService, 'validateScheduling').mockResolvedValue({
        isValid: true,
        estimatedCost: 0.02 // ₹0.02 for 1 recipient
      });

      jest.spyOn(scheduledEmailService as any, 'saveScheduledEmail').mockResolvedValue(undefined);

      const result = await scheduledEmailService.scheduleEmail(rechargeRequest);

      expect(result.userType).toBe('recharge');
      expect(result.estimatedCost).toBe(0.02);
    });

    it('should throw error when validation fails', async () => {
      // Mock validation to fail
      jest.spyOn(scheduledEmailService, 'validateScheduling').mockResolvedValue({
        isValid: false,
        reason: 'Insufficient balance'
      });

      await expect(scheduledEmailService.scheduleEmail(mockRequest))
        .rejects.toThrow('Scheduling validation failed: Insufficient balance');
    });
  });

  describe('validateScheduling', () => {
    const tenantId = 'tenant_123';
    const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

    it('should reject scheduling for past dates', async () => {
      const result = await scheduledEmailService.validateScheduling(
        tenantId,
        pastDate,
        'subscription',
        1
      );

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('must be in the future');
    });

    it('should validate subscription user scheduling within 14 days', async () => {
      const validDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days

      // Mock subscription service
      const mockSubscription = {
        id: 'sub_123',
        tenantId,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        limits: { dailyEmailLimit: 100 }
      };

      jest.spyOn(scheduledEmailService['subscriptionService'], 'getSubscriptionByTenantId')
        .mockResolvedValue(mockSubscription as any);

      const result = await scheduledEmailService.validateScheduling(
        tenantId,
        validDate,
        'subscription',
        1
      );

      expect(result.isValid).toBe(true);
    });

    it('should reject subscription user scheduling beyond 14 days', async () => {
      const invalidDate = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000); // 20 days

      const mockSubscription = {
        id: 'sub_123',
        tenantId,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      };

      jest.spyOn(scheduledEmailService['subscriptionService'], 'getSubscriptionByTenantId')
        .mockResolvedValue(mockSubscription as any);

      const result = await scheduledEmailService.validateScheduling(
        tenantId,
        invalidDate,
        'subscription',
        1
      );

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('14 days in advance');
      expect(result.maxScheduleDate).toBeDefined();
    });

    it('should validate recharge user with sufficient balance', async () => {
      const mockSubscription = { id: 'sub_123', tenantId };

      jest.spyOn(scheduledEmailService['subscriptionService'], 'getSubscriptionByTenantId')
        .mockResolvedValue(mockSubscription as any);

      jest.spyOn(scheduledEmailService['subscriptionService'], 'calculateRecipientCost')
        .mockReturnValue(0.02);

      jest.spyOn(scheduledEmailService['walletService'], 'hasSufficientBalance')
        .mockResolvedValue(true);

      const result = await scheduledEmailService.validateScheduling(
        tenantId,
        futureDate,
        'recharge',
        1
      );

      expect(result.isValid).toBe(true);
      expect(result.estimatedCost).toBe(0.02);
    });

    it('should reject recharge user with insufficient balance', async () => {
      const mockSubscription = { id: 'sub_123', tenantId };

      jest.spyOn(scheduledEmailService['subscriptionService'], 'getSubscriptionByTenantId')
        .mockResolvedValue(mockSubscription as any);

      jest.spyOn(scheduledEmailService['subscriptionService'], 'calculateRecipientCost')
        .mockReturnValue(10.00);

      jest.spyOn(scheduledEmailService['walletService'], 'hasSufficientBalance')
        .mockResolvedValue(false);

      jest.spyOn(scheduledEmailService['walletService'], 'getWalletBalance')
        .mockResolvedValue({ balance: 5.00 } as any);

      const result = await scheduledEmailService.validateScheduling(
        tenantId,
        futureDate,
        'recharge',
        500 // 500 recipients = ₹10
      );

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Insufficient wallet balance');
      expect(result.estimatedCost).toBe(10.00);
    });
  });

  describe('cancelScheduledEmail', () => {
    it('should cancel a pending scheduled email', async () => {
      const scheduleId = 'schedule_123';
      const mockScheduledEmail = {
        id: scheduleId,
        status: ScheduleStatus.PENDING,
        tenantId: 'tenant_123'
      };

      jest.spyOn(scheduledEmailService as any, 'getScheduledEmailById')
        .mockResolvedValue(mockScheduledEmail);

      jest.spyOn(scheduledEmailService as any, 'updateScheduledEmailStatus')
        .mockResolvedValue(undefined);

      await expect(scheduledEmailService.cancelScheduledEmail(scheduleId, 'User requested'))
        .resolves.not.toThrow();
    });

    it('should throw error when trying to cancel non-pending email', async () => {
      const scheduleId = 'schedule_123';
      const mockScheduledEmail = {
        id: scheduleId,
        status: ScheduleStatus.SENT,
        tenantId: 'tenant_123'
      };

      jest.spyOn(scheduledEmailService as any, 'getScheduledEmailById')
        .mockResolvedValue(mockScheduledEmail);

      await expect(scheduledEmailService.cancelScheduledEmail(scheduleId))
        .rejects.toThrow('Cannot cancel email with status: sent');
    });

    it('should throw error when scheduled email not found', async () => {
      const scheduleId = 'nonexistent_123';

      jest.spyOn(scheduledEmailService as any, 'getScheduledEmailById')
        .mockResolvedValue(null);

      await expect(scheduledEmailService.cancelScheduledEmail(scheduleId))
        .rejects.toThrow('Scheduled email not found');
    });
  });

  describe('processScheduledEmails', () => {
    it('should process due scheduled emails successfully', async () => {
      const mockDueEmails = [
        {
          id: 'schedule_1',
          tenantId: 'tenant_123',
          emailJob: {
            to: ['test1@example.com'],
            from: 'sender@example.com',
            subject: 'Test 1',
            htmlContent: '<h1>Test 1</h1>'
          },
          userType: 'subscription',
          status: ScheduleStatus.PENDING
        },
        {
          id: 'schedule_2',
          tenantId: 'tenant_456',
          emailJob: {
            to: ['test2@example.com'],
            from: 'sender@example.com',
            subject: 'Test 2',
            htmlContent: '<h1>Test 2</h1>'
          },
          userType: 'recharge',
          estimatedCost: 0.02,
          status: ScheduleStatus.PENDING
        }
      ];

      jest.spyOn(scheduledEmailService as any, 'getDueScheduledEmails')
        .mockResolvedValue(mockDueEmails);

      jest.spyOn(scheduledEmailService as any, 'processSingleScheduledEmail')
        .mockResolvedValue(undefined);

      const result = await scheduledEmailService.processScheduledEmails();

      expect(result.totalProcessed).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
    });

    it('should handle processing errors gracefully', async () => {
      const mockDueEmails = [
        {
          id: 'schedule_1',
          tenantId: 'tenant_123',
          emailJob: {
            to: ['test1@example.com'],
            from: 'sender@example.com',
            subject: 'Test 1',
            htmlContent: '<h1>Test 1</h1>'
          },
          userType: 'subscription',
          status: ScheduleStatus.PENDING
        }
      ];

      jest.spyOn(scheduledEmailService as any, 'getDueScheduledEmails')
        .mockResolvedValue(mockDueEmails);

      jest.spyOn(scheduledEmailService as any, 'processSingleScheduledEmail')
        .mockRejectedValue(new Error('Processing failed'));

      jest.spyOn(scheduledEmailService as any, 'updateScheduledEmailStatus')
        .mockResolvedValue(undefined);

      const result = await scheduledEmailService.processScheduledEmails();

      expect(result.totalProcessed).toBe(1);
      expect(result.successful).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error).toBe('Processing failed');
    });
  });

  describe('triggerScheduledEmails', () => {
    it('should manually trigger specific scheduled emails', async () => {
      const scheduleIds = ['schedule_1', 'schedule_2'];
      const mockScheduledEmails = [
        {
          id: 'schedule_1',
          tenantId: 'tenant_123',
          emailJob: {
            to: ['test1@example.com'],
            from: 'sender@example.com',
            subject: 'Test 1',
            htmlContent: '<h1>Test 1</h1>'
          },
          userType: 'subscription',
          status: ScheduleStatus.PENDING
        }
      ];

      jest.spyOn(scheduledEmailService as any, 'getScheduledEmailsByIds')
        .mockResolvedValue(mockScheduledEmails);

      jest.spyOn(scheduledEmailService as any, 'processSingleScheduledEmail')
        .mockResolvedValue(undefined);

      const result = await scheduledEmailService.triggerScheduledEmails(scheduleIds);

      expect(result.totalProcessed).toBe(1);
      expect(result.successful).toBe(1);
    });

    it('should trigger all due emails when no specific IDs provided', async () => {
      const mockDueEmails = [
        {
          id: 'schedule_1',
          tenantId: 'tenant_123',
          emailJob: {
            to: ['test1@example.com'],
            from: 'sender@example.com',
            subject: 'Test 1',
            htmlContent: '<h1>Test 1</h1>'
          },
          userType: 'subscription',
          status: ScheduleStatus.PENDING
        }
      ];

      jest.spyOn(scheduledEmailService as any, 'getDueScheduledEmails')
        .mockResolvedValue(mockDueEmails);

      jest.spyOn(scheduledEmailService as any, 'processSingleScheduledEmail')
        .mockResolvedValue(undefined);

      const result = await scheduledEmailService.triggerScheduledEmails();

      expect(result.totalProcessed).toBe(1);
      expect(result.successful).toBe(1);
    });
  });
});