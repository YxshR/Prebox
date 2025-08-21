import { SubscriptionService } from './subscription.service';
import { SubscriptionTier } from '../shared/types';

describe('SubscriptionService', () => {
  let subscriptionService: SubscriptionService;

  beforeEach(() => {
    subscriptionService = new SubscriptionService();
  });

  describe('getSubscriptionPlan', () => {
    it('should return Free tier plan with correct limits', () => {
      const plan = subscriptionService.getSubscriptionPlan(SubscriptionTier.FREE);
      
      expect(plan).toBeDefined();
      expect(plan?.tier).toBe(SubscriptionTier.FREE);
      expect(plan?.limits.dailyEmailLimit).toBe(100);
      expect(plan?.limits.monthlyRecipientLimit).toBe(300);
      expect(plan?.limits.monthlyEmailLimit).toBe(2000);
      expect(plan?.limits.templateLimit).toBe(1);
      expect(plan?.limits.customDomainLimit).toBe(0);
      expect(plan?.limits.hasLogoCustomization).toBe(false);
      expect(plan?.limits.hasCustomDomains).toBe(false);
    });

    it('should return Paid Standard tier plan with correct limits', () => {
      const plan = subscriptionService.getSubscriptionPlan(SubscriptionTier.PAID_STANDARD);
      
      expect(plan).toBeDefined();
      expect(plan?.tier).toBe(SubscriptionTier.PAID_STANDARD);
      expect(plan?.limits.dailyEmailLimit).toBe(1000);
      expect(plan?.limits.monthlyRecipientLimit).toBe(5000);
      expect(plan?.limits.monthlyEmailLimit).toBe(30000);
      expect(plan?.limits.templateLimit).toBe(10);
      expect(plan?.limits.customDomainLimit).toBe(0);
      expect(plan?.limits.hasLogoCustomization).toBe(true);
      expect(plan?.limits.hasCustomDomains).toBe(false);
    });

    it('should return Premium tier plan with correct limits', () => {
      const plan = subscriptionService.getSubscriptionPlan(SubscriptionTier.PREMIUM);
      
      expect(plan).toBeDefined();
      expect(plan?.tier).toBe(SubscriptionTier.PREMIUM);
      expect(plan?.limits.dailyEmailLimit).toBe(5000);
      expect(plan?.limits.monthlyRecipientLimit).toBe(25000);
      expect(plan?.limits.monthlyEmailLimit).toBe(100000);
      expect(plan?.limits.templateLimit).toBe(-1); // Unlimited
      expect(plan?.limits.customDomainLimit).toBe(10);
      expect(plan?.limits.hasLogoCustomization).toBe(true);
      expect(plan?.limits.hasCustomDomains).toBe(true);
    });

    it('should return Enterprise tier plan with unlimited limits', () => {
      const plan = subscriptionService.getSubscriptionPlan(SubscriptionTier.ENTERPRISE);
      
      expect(plan).toBeDefined();
      expect(plan?.tier).toBe(SubscriptionTier.ENTERPRISE);
      expect(plan?.limits.dailyEmailLimit).toBe(-1); // Unlimited
      expect(plan?.limits.monthlyRecipientLimit).toBe(-1); // Unlimited
      expect(plan?.limits.monthlyEmailLimit).toBe(-1); // Unlimited
      expect(plan?.limits.templateLimit).toBe(-1); // Unlimited
      expect(plan?.limits.customDomainLimit).toBe(-1); // Unlimited
      expect(plan?.limits.hasLogoCustomization).toBe(true);
      expect(plan?.limits.hasCustomDomains).toBe(true);
    });

    it('should return null for invalid tier', () => {
      const plan = subscriptionService.getSubscriptionPlan('invalid' as SubscriptionTier);
      expect(plan).toBeNull();
    });
  });

  describe('getAllSubscriptionPlans', () => {
    it('should return all 4 subscription plans', () => {
      const plans = subscriptionService.getAllSubscriptionPlans();
      
      expect(plans).toHaveLength(4);
      expect(plans.map(p => p.tier)).toContain(SubscriptionTier.FREE);
      expect(plans.map(p => p.tier)).toContain(SubscriptionTier.PAID_STANDARD);
      expect(plans.map(p => p.tier)).toContain(SubscriptionTier.PREMIUM);
      expect(plans.map(p => p.tier)).toContain(SubscriptionTier.ENTERPRISE);
    });
  });

  describe('createSubscription', () => {
    it('should create a Free tier subscription by default', async () => {
      const subscription = await subscriptionService.createSubscription('tenant-123');
      
      expect(subscription.tenantId).toBe('tenant-123');
      expect(subscription.planId).toBe('free-tier');
      expect(subscription.status).toBe('active');
      expect(subscription.limits.dailyEmailLimit).toBe(100);
      expect(subscription.usage.dailyEmailsSent).toBe(0);
      expect(subscription.rechargeBalance).toBe(0);
    });

    it('should create a subscription with specified tier', async () => {
      const subscription = await subscriptionService.createSubscription('tenant-123', SubscriptionTier.PREMIUM);
      
      expect(subscription.tenantId).toBe('tenant-123');
      expect(subscription.planId).toBe('premium-tier');
      expect(subscription.limits.dailyEmailLimit).toBe(5000);
    });

    it('should throw error for invalid tier', async () => {
      await expect(
        subscriptionService.createSubscription('tenant-123', 'invalid' as SubscriptionTier)
      ).rejects.toThrow('Invalid subscription tier: invalid');
    });
  });

  describe('checkQuota', () => {
    it('should return allowed=true when within limits', async () => {
      // Mock the getSubscriptionByTenantId method
      const mockSubscription = await subscriptionService.createSubscription('tenant-123', SubscriptionTier.FREE);
      jest.spyOn(subscriptionService as any, 'getSubscriptionByTenantId').mockResolvedValue(mockSubscription);

      const result = await subscriptionService.checkQuota('tenant-123', 'daily_emails', 50);
      
      expect(result.allowed).toBe(true);
      expect(result.quotaType).toBe('daily_emails');
      expect(result.currentUsage).toBe(0);
      expect(result.limit).toBe(100);
    });

    it('should return allowed=false when exceeding limits', async () => {
      const mockSubscription = await subscriptionService.createSubscription('tenant-123', SubscriptionTier.FREE);
      mockSubscription.usage.dailyEmailsSent = 95; // Already used 95 out of 100
      jest.spyOn(subscriptionService as any, 'getSubscriptionByTenantId').mockResolvedValue(mockSubscription);

      const result = await subscriptionService.checkQuota('tenant-123', 'daily_emails', 10);
      
      expect(result.allowed).toBe(false);
      expect(result.currentUsage).toBe(95);
      expect(result.limit).toBe(100);
    });

    it('should return allowed=true for unlimited quotas', async () => {
      const mockSubscription = await subscriptionService.createSubscription('tenant-123', SubscriptionTier.ENTERPRISE);
      jest.spyOn(subscriptionService as any, 'getSubscriptionByTenantId').mockResolvedValue(mockSubscription);

      const result = await subscriptionService.checkQuota('tenant-123', 'daily_emails', 10000);
      
      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(-1); // Unlimited
    });
  });

  describe('changeTier', () => {
    it('should throw error when target tier is same as current', async () => {
      const request = {
        userId: 'user-123',
        currentTier: SubscriptionTier.FREE,
        targetTier: SubscriptionTier.FREE
      };

      await expect(subscriptionService.changeTier(request)).rejects.toThrow('Target tier is the same as current tier');
    });

    it('should throw error for invalid target tier', async () => {
      const request = {
        userId: 'user-123',
        currentTier: SubscriptionTier.FREE,
        targetTier: 'invalid' as SubscriptionTier
      };

      await expect(subscriptionService.changeTier(request)).rejects.toThrow('Invalid target tier: invalid');
    });
  });
});