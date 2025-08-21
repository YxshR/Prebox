/**
 * Analytics Service Unit Tests
 * Tests for analytics data collection, aggregation, and reporting
 */

import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  const tenantId = 'test-tenant-id';
  let mockPool: any;

  beforeEach(() => {
    mockPool = {
      query: jest.fn(),
      connect: jest.fn()
    };
    analyticsService = new AnalyticsService(mockPool);
    jest.clearAllMocks();
  });

  describe('getDashboardAnalytics', () => {
    it('should return comprehensive dashboard analytics', async () => {
      const timeRange = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        period: 'daily' as const
      };
      
      const result = await analyticsService.getDashboardAnalytics(tenantId, timeRange);

      expect(result).toBeDefined();
      expect(result.deliveryTrends).toBeDefined();
      expect(result.engagementMetrics).toBeDefined();
      expect(result.campaignPerformance).toBeDefined();
      expect(result.keyMetrics).toBeDefined();
      expect(Array.isArray(result.deliveryTrends)).toBe(true);
      expect(Array.isArray(result.campaignPerformance)).toBe(true);
    });
  });

  describe('getDeliveryTrends', () => {
    it('should return delivery trends data', async () => {
      const timeRange = {
        startDate: '2024-01-01',
        endDate: '2024-01-07',
        period: 'daily' as const
      };
      
      const result = await analyticsService.getDeliveryTrends(tenantId, timeRange);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('date');
      expect(result[0]).toHaveProperty('delivered');
      expect(result[0]).toHaveProperty('bounced');
      expect(result[0]).toHaveProperty('failed');
      expect(result[0]).toHaveProperty('total');
    });
  });

  describe('getEngagementMetrics', () => {
    it('should return engagement metrics', async () => {
      const timeRange = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        period: 'daily' as const
      };
      
      const result = await analyticsService.getEngagementMetrics(tenantId, timeRange);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('opens');
      expect(result).toHaveProperty('clicks');
      expect(result).toHaveProperty('unsubscribes');
      expect(result).toHaveProperty('complaints');
      expect(result).toHaveProperty('totalSent');
      expect(typeof result.opens).toBe('number');
      expect(typeof result.clicks).toBe('number');
    });
  });

  describe('getCampaignPerformance', () => {
    it('should return campaign performance data', async () => {
      const timeRange = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        period: 'daily' as const
      };
      
      const result = await analyticsService.getCampaignPerformance(tenantId, timeRange);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('campaignName');
      expect(result[0]).toHaveProperty('delivered');
      expect(result[0]).toHaveProperty('opened');
      expect(result[0]).toHaveProperty('clicked');
      expect(result[0]).toHaveProperty('bounced');
      expect(result[0]).toHaveProperty('unsubscribed');
    });
  });

  describe('getKeyMetrics', () => {
    it('should return key metrics summary', async () => {
      const timeRange = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        period: 'daily' as const
      };
      
      const result = await analyticsService.getKeyMetrics(tenantId, timeRange);

      expect(result).toBeDefined();
      expect(result).toHaveProperty('totalEmailsSent');
      expect(result).toHaveProperty('deliveryRate');
      expect(result).toHaveProperty('openRate');
      expect(result).toHaveProperty('clickRate');
      expect(result).toHaveProperty('bounceRate');
      expect(result).toHaveProperty('unsubscribeRate');
      expect(result).toHaveProperty('activeContacts');
      expect(result).toHaveProperty('activeCampaigns');
      
      expect(typeof result.totalEmailsSent).toBe('number');
      expect(typeof result.deliveryRate).toBe('number');
      expect(result.deliveryRate).toBeGreaterThanOrEqual(0);
      expect(result.deliveryRate).toBeLessThanOrEqual(100);
    });
  });
});