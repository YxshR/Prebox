import { Request, Response } from 'express';
import { AnalyticsService, AnalyticsTimeRange } from './analytics.service';
import { ApiResponse } from '../shared/types';

export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  /**
   * Get analytics dashboard data
   * GET /api/analytics/dashboard
   */
  async getDashboardAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = (req as any).user.tenantId;
      const timeRange: AnalyticsTimeRange = {
        startDate: req.query.startDate as string || this.getDefaultStartDate(),
        endDate: req.query.endDate as string || this.getDefaultEndDate(),
        period: (req.query.period as 'daily' | 'weekly' | 'monthly' | 'yearly') || 'daily'
      };

      const analytics = await this.analyticsService.getDashboardAnalytics(tenantId, timeRange);

      res.json({
        success: true,
        data: analytics
      } as ApiResponse);

    } catch (error) {
      console.error('Get dashboard analytics error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'ANALYTICS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch analytics data'
        }
      } as ApiResponse);
    }
  }

  /**
   * Get delivery trends data
   * GET /api/analytics/delivery-trends
   */
  async getDeliveryTrends(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = (req as any).user.tenantId;
      const timeRange: AnalyticsTimeRange = {
        startDate: req.query.startDate as string || this.getDefaultStartDate(),
        endDate: req.query.endDate as string || this.getDefaultEndDate(),
        period: (req.query.period as 'daily' | 'weekly' | 'monthly' | 'yearly') || 'daily'
      };

      const trends = await this.analyticsService.getDeliveryTrends(tenantId, timeRange);

      res.json({
        success: true,
        data: trends
      } as ApiResponse);

    } catch (error) {
      console.error('Get delivery trends error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'DELIVERY_TRENDS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch delivery trends'
        }
      } as ApiResponse);
    }
  }

  /**
   * Get engagement metrics
   * GET /api/analytics/engagement
   */
  async getEngagementMetrics(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = (req as any).user.tenantId;
      const timeRange: AnalyticsTimeRange = {
        startDate: req.query.startDate as string || this.getDefaultStartDate(),
        endDate: req.query.endDate as string || this.getDefaultEndDate(),
        period: (req.query.period as 'daily' | 'weekly' | 'monthly' | 'yearly') || 'daily'
      };

      const engagement = await this.analyticsService.getEngagementMetrics(tenantId, timeRange);

      res.json({
        success: true,
        data: engagement
      } as ApiResponse);

    } catch (error) {
      console.error('Get engagement metrics error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'ENGAGEMENT_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch engagement metrics'
        }
      } as ApiResponse);
    }
  }

  /**
   * Get campaign performance data
   * GET /api/analytics/campaigns
   */
  async getCampaignPerformance(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = (req as any).user.tenantId;
      const timeRange: AnalyticsTimeRange = {
        startDate: req.query.startDate as string || this.getDefaultStartDate(),
        endDate: req.query.endDate as string || this.getDefaultEndDate(),
        period: (req.query.period as 'daily' | 'weekly' | 'monthly' | 'yearly') || 'daily'
      };

      const campaigns = await this.analyticsService.getCampaignPerformance(tenantId, timeRange);

      res.json({
        success: true,
        data: campaigns
      } as ApiResponse);

    } catch (error) {
      console.error('Get campaign performance error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CAMPAIGN_PERFORMANCE_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch campaign performance'
        }
      } as ApiResponse);
    }
  }

  /**
   * Get key metrics summary
   * GET /api/analytics/key-metrics
   */
  async getKeyMetrics(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = (req as any).user.tenantId;
      const timeRange: AnalyticsTimeRange = {
        startDate: req.query.startDate as string || this.getDefaultStartDate(),
        endDate: req.query.endDate as string || this.getDefaultEndDate(),
        period: (req.query.period as 'daily' | 'weekly' | 'monthly' | 'yearly') || 'daily'
      };

      const metrics = await this.analyticsService.getKeyMetrics(tenantId, timeRange);

      res.json({
        success: true,
        data: metrics
      } as ApiResponse);

    } catch (error) {
      console.error('Get key metrics error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'KEY_METRICS_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch key metrics'
        }
      } as ApiResponse);
    }
  }

  private getDefaultStartDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  }

  private getDefaultEndDate(): string {
    const date = new Date();
    return date.toISOString().split('T')[0];
  }
}