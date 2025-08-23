/**
 * Admin Services Unit Tests
 * Comprehensive tests for all admin functionality
 */

import { AdminUserService } from './admin-user.service';
import { AdminBillingService } from './admin-billing.service';
import { AdminAnalyticsService } from './admin-analytics.service';
import { AdminSubscriptionService } from './admin-subscription.service';
import { AdminUsageService } from './admin-usage.service';
import { AdminScheduledEmailService } from './admin-scheduled-email.service';
import { TestUtils } from '../config/test-config';

// Mock dependencies
const mockDatabase = TestUtils.mockDatabase();
const mockRedis = TestUtils.mockRedis();

jest.mock('../database/database.service', () => ({
  DatabaseService: {
    getInstance: () => mockDatabase
  }
}));

describe('AdminUserService', () => {
  let adminUserService: AdminUserService;;

  beforeEach(() => {
    adminUserService = new AdminUserService();
    jest.clearAllMocks();
  });

  describe('getUsers', () => {
    it('should return paginated list of users', async () => {
      const mockUsers = [
        TestUtils.generateMockUser({ id: 'user-1', email: 'user1@example.com' }),
        TestUtils.generateMockUser({ id: 'user-2', email: 'user2@example.com' })
      ];

      mockDatabase.query.mockResolvedValue({
        rows: mockUsers,
        rowCount: 2
      });

      const result = await adminUserService.getUsers({ page: 1, limit: 10 });

      expect(result).toEqual({
        users: mockUsers,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1
      });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM users'),
        expect.arrayContaining([10, 0])
      );
    });

    it('should filter users by subscription tier', async () => {
      const filters = { subscriptionTier: 'PREMIUM' };
      
      await adminUserService.getUsers({ page: 1, limit: 10, filters });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE subscription_tier = $3'),
        expect.arrayContaining([10, 0, 'PREMIUM'])
      );
    });

    it('should search users by email', async () => {
      const filters = { search: 'john@example.com' };
      
      await adminUserService.getUsers({ page: 1, limit: 10, filters });

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE email ILIKE $3'),
        expect.arrayContaining([10, 0, '%john@example.com%'])
      );
    });
  });

  describe('getUserDetails', () => {
    it('should return detailed user information', async () => {
      const userId = 'user-1';
      const mockUser = TestUtils.generateMockUser({ id: userId });
      const mockSubscription = { tier: 'PREMIUM', status: 'ACTIVE' };
      const mockUsage = { emailsSent: 1500, recipientsReached: 5000 };

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [mockUser] })
        .mockResolvedValueOnce({ rows: [mockSubscription] })
        .mockResolvedValueOnce({ rows: [mockUsage] });

      const result = await adminUserService.getUserDetails(userId);

      expect(result).toEqual({
        user: mockUser,
        subscription: mockSubscription,
        usage: mockUsage
      });
    });

    it('should throw error for non-existent user', async () => {
      mockDatabase.query.mockResolvedValue({ rows: [] });

      await expect(adminUserService.getUserDetails('non-existent'))
        .rejects.toThrow('User not found');
    });
  });

  describe('updateUserStatus', () => {
    it('should update user status successfully', async () => {
      const userId = 'user-1';
      const status = 'SUSPENDED';

      mockDatabase.query.mockResolvedValue({ rowCount: 1 });

      await adminUserService.updateUserStatus(userId, status);

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET status = $1'),
        [status, userId]
      );
    });

    it('should log status change for audit', async () => {
      const userId = 'user-1';
      const status = 'ACTIVE';
      const adminId = 'admin-1';

      mockDatabase.query.mockResolvedValue({ rowCount: 1 });

      await adminUserService.updateUserStatus(userId, status, adminId);

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO admin_audit_log'),
        expect.arrayContaining([adminId, 'USER_STATUS_CHANGE', userId])
      );
    });
  });
});

describe('AdminBillingService', () => {
  let adminBillingService: AdminBillingService;

  beforeEach(() => {
    adminBillingService = new AdminBillingService();
    jest.clearAllMocks();
  });

  describe('getBillingOverview', () => {
    it('should return comprehensive billing overview', async () => {
      const mockOverview = {
        totalRevenue: 50000,
        monthlyRecurringRevenue: 15000,
        activeSubscriptions: 250,
        churnRate: 5.2
      };

      mockDatabase.query.mockResolvedValue({ rows: [mockOverview] });

      const result = await adminBillingService.getBillingOverview();

      expect(result).toEqual(mockOverview);
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT')
      );
    });
  });

  describe('getRevenueAnalytics', () => {
    it('should return revenue analytics by time period', async () => {
      const timeRange = { start: new Date('2024-01-01'), end: new Date('2024-01-31') };
      const mockAnalytics = [
        { date: '2024-01-01', revenue: 1500, subscriptions: 10 },
        { date: '2024-01-02', revenue: 2000, subscriptions: 15 }
      ];

      mockDatabase.query.mockResolvedValue({ rows: mockAnalytics });

      const result = await adminBillingService.getRevenueAnalytics(timeRange);

      expect(result).toEqual(mockAnalytics);
    });
  });

  describe('processRefund', () => {
    it('should process refund successfully', async () => {
      const refundData = {
        invoiceId: 'inv-1',
        amount: 5000, // $50.00
        reason: 'Customer request',
        adminId: 'admin-1'
      };

      mockDatabase.query.mockResolvedValue({ rowCount: 1 });

      await adminBillingService.processRefund(refundData);

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO refunds'),
        expect.arrayContaining([
          refundData.invoiceId,
          refundData.amount,
          refundData.reason,
          refundData.adminId
        ])
      );
    });
  });
});

describe('AdminAnalyticsService', () => {
  let adminAnalyticsService: AdminAnalyticsService;

  beforeEach(() => {
    adminAnalyticsService = new AdminAnalyticsService();
    jest.clearAllMocks();
  });

  describe('getPlatformMetrics', () => {
    it('should return platform-wide metrics', async () => {
      const mockMetrics = {
        totalUsers: 1000,
        activeUsers: 750,
        totalEmailsSent: 500000,
        averageDeliveryRate: 95.5
      };

      mockDatabase.query.mockResolvedValue({ rows: [mockMetrics] });

      const result = await adminAnalyticsService.getPlatformMetrics();

      expect(result).toEqual(mockMetrics);
    });
  });

  describe('getUserGrowthAnalytics', () => {
    it('should return user growth analytics', async () => {
      const timeRange = { start: new Date('2024-01-01'), end: new Date('2024-01-31') };
      const mockGrowth = [
        { date: '2024-01-01', newUsers: 25, churnedUsers: 5 },
        { date: '2024-01-02', newUsers: 30, churnedUsers: 3 }
      ];

      mockDatabase.query.mockResolvedValue({ rows: mockGrowth });

      const result = await adminAnalyticsService.getUserGrowthAnalytics(timeRange);

      expect(result).toEqual(mockGrowth);
    });
  });

  describe('getSystemHealthMetrics', () => {
    it('should return system health metrics', async () => {
      const mockHealth = {
        apiResponseTime: 250,
        errorRate: 0.5,
        queueLength: 150,
        databaseConnections: 25
      };

      mockDatabase.query.mockResolvedValue({ rows: [mockHealth] });

      const result = await adminAnalyticsService.getSystemHealthMetrics();

      expect(result).toEqual(mockHealth);
    });
  });
});

describe('AdminSubscriptionService', () => {
  let adminSubscriptionService: AdminSubscriptionService;

  beforeEach(() => {
    adminSubscriptionService = new AdminSubscriptionService();
    jest.clearAllMocks();
  });

  describe('getAllSubscriptions', () => {
    it('should return paginated subscriptions', async () => {
      const mockSubscriptions = [
        { id: 'sub-1', userId: 'user-1', tier: 'PREMIUM', status: 'ACTIVE' },
        { id: 'sub-2', userId: 'user-2', tier: 'STANDARD', status: 'ACTIVE' }
      ];

      mockDatabase.query.mockResolvedValue({
        rows: mockSubscriptions,
        rowCount: 2
      });

      const result = await adminSubscriptionService.getAllSubscriptions({ page: 1, limit: 10 });

      expect(result).toEqual({
        subscriptions: mockSubscriptions,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1
      });
    });
  });

  describe('updateSubscriptionTier', () => {
    it('should update subscription tier', async () => {
      const subscriptionId = 'sub-1';
      const newTier = 'PREMIUM';
      const adminId = 'admin-1';

      mockDatabase.query.mockResolvedValue({ rowCount: 1 });

      await adminSubscriptionService.updateSubscriptionTier(subscriptionId, newTier, adminId);

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE subscriptions SET tier = $1'),
        [newTier, subscriptionId]
      );
    });
  });
});

describe('AdminUsageService', () => {
  let adminUsageService: AdminUsageService;

  beforeEach(() => {
    adminUsageService = new AdminUsageService();
    jest.clearAllMocks();
  });

  describe('getUsageOverview', () => {
    it('should return platform usage overview', async () => {
      const mockUsage = {
        totalEmailsSent: 1000000,
        totalRecipients: 500000,
        averageEmailsPerUser: 1000,
        topUsers: [
          { userId: 'user-1', emailsSent: 50000 },
          { userId: 'user-2', emailsSent: 45000 }
        ]
      };

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ total: 1000000 }] })
        .mockResolvedValueOnce({ rows: [{ total: 500000 }] })
        .mockResolvedValueOnce({ rows: [{ avg: 1000 }] })
        .mockResolvedValueOnce({ rows: mockUsage.topUsers });

      const result = await adminUsageService.getUsageOverview();

      expect(result).toEqual({
        totalEmailsSent: 1000000,
        totalRecipients: 500000,
        averageEmailsPerUser: 1000,
        topUsers: mockUsage.topUsers
      });
    });
  });

  describe('getUserUsageDetails', () => {
    it('should return detailed usage for specific user', async () => {
      const userId = 'user-1';
      const mockUsage = {
        dailyUsage: [
          { date: '2024-01-01', emails: 100, recipients: 500 },
          { date: '2024-01-02', emails: 150, recipients: 750 }
        ],
        monthlyTotals: {
          emails: 3000,
          recipients: 15000,
          templates: 25
        }
      };

      mockDatabase.query
        .mockResolvedValueOnce({ rows: mockUsage.dailyUsage })
        .mockResolvedValueOnce({ rows: [mockUsage.monthlyTotals] });

      const result = await adminUsageService.getUserUsageDetails(userId);

      expect(result).toEqual(mockUsage);
    });
  });
});

describe('AdminScheduledEmailService', () => {
  let adminScheduledEmailService: AdminScheduledEmailService;

  beforeEach(() => {
    adminScheduledEmailService = new AdminScheduledEmailService();
    jest.clearAllMocks();
  });

  describe('getAllScheduledEmails', () => {
    it('should return paginated scheduled emails', async () => {
      const mockScheduledEmails = [
        {
          id: 'sched-1',
          tenantId: 'tenant-1',
          campaignId: 'campaign-1',
          scheduledAt: new Date('2024-02-01T10:00:00Z'),
          status: 'PENDING'
        },
        {
          id: 'sched-2',
          tenantId: 'tenant-2',
          campaignId: 'campaign-2',
          scheduledAt: new Date('2024-02-02T14:00:00Z'),
          status: 'PENDING'
        }
      ];

      mockDatabase.query.mockResolvedValue({
        rows: mockScheduledEmails,
        rowCount: 2
      });

      const result = await adminScheduledEmailService.getAllScheduledEmails({ page: 1, limit: 10 });

      expect(result).toEqual({
        scheduledEmails: mockScheduledEmails,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1
      });
    });
  });

  describe('cancelScheduledEmail', () => {
    it('should cancel scheduled email successfully', async () => {
      const scheduleId = 'sched-1';
      const adminId = 'admin-1';
      const reason = 'Admin intervention';

      mockDatabase.query.mockResolvedValue({ rowCount: 1 });

      await adminScheduledEmailService.cancelScheduledEmail(scheduleId, adminId, reason);

      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE scheduled_emails SET status = $1'),
        ['CANCELLED', expect.any(Date), scheduleId]
      );
    });
  });

  describe('getScheduledEmailMetrics', () => {
    it('should return scheduled email metrics', async () => {
      const mockMetrics = {
        totalScheduled: 500,
        pendingCount: 150,
        sentCount: 300,
        cancelledCount: 50,
        failedCount: 0
      };

      mockDatabase.query.mockResolvedValue({ rows: [mockMetrics] });

      const result = await adminScheduledEmailService.getScheduledEmailMetrics();

      expect(result).toEqual(mockMetrics);
    });
  });
});

describe('Integration Tests', () => {
  it('should handle admin operations with proper audit logging', async () => {
    const adminUserService = new AdminUserService();
    const adminId = 'admin-1';
    const userId = 'user-1';
    const action = 'SUSPEND_USER';

    mockDatabase.query.mockResolvedValue({ rowCount: 1 });

    await adminUserService.updateUserStatus(userId, 'SUSPENDED', adminId);

    // Verify audit log entry
    expect(mockDatabase.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO admin_audit_log'),
      expect.arrayContaining([adminId, 'USER_STATUS_CHANGE', userId])
    );
  });

  it('should handle concurrent admin operations safely', async () => {
    const adminBillingService = new AdminBillingService();
    
    // Simulate concurrent refund processing
    const refunds = [
      { invoiceId: 'inv-1', amount: 1000, reason: 'Reason 1', adminId: 'admin-1' },
      { invoiceId: 'inv-2', amount: 2000, reason: 'Reason 2', adminId: 'admin-2' }
    ];

    mockDatabase.query.mockResolvedValue({ rowCount: 1 });

    await Promise.all(refunds.map(refund => 
      adminBillingService.processRefund(refund)
    ));

    expect(mockDatabase.query).toHaveBeenCalledTimes(2);
  });
});