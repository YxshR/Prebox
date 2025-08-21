import api from './api';

export interface AnalyticsData {
  deliveryTrends: DeliveryTrendData[];
  engagementMetrics: EngagementMetricsData;
  campaignPerformance: CampaignPerformanceData[];
  keyMetrics: KeyMetricsData;
}

export interface DeliveryTrendData {
  date: string;
  delivered: number;
  bounced: number;
  failed: number;
  total: number;
}

export interface EngagementMetricsData {
  opens: number;
  clicks: number;
  unsubscribes: number;
  complaints: number;
  totalSent: number;
}

export interface CampaignPerformanceData {
  campaignName: string;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
}

export interface KeyMetricsData {
  totalEmailsSent: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  unsubscribeRate: number;
  activeContacts: number;
  activeCampaigns: number;
}

export interface AnalyticsTimeRange {
  startDate: string;
  endDate: string;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
}

export const analyticsApi = {
  /**
   * Get analytics dashboard data
   */
  async getDashboardAnalytics(timeRange: AnalyticsTimeRange): Promise<AnalyticsData> {
    const response = await api.get('/analytics/dashboard', {
      params: timeRange
    });
    return response.data.data;
  },

  /**
   * Get delivery trends data
   */
  async getDeliveryTrends(timeRange: AnalyticsTimeRange): Promise<DeliveryTrendData[]> {
    const response = await api.get('/analytics/delivery-trends', {
      params: timeRange
    });
    return response.data.data;
  },

  /**
   * Get engagement metrics
   */
  async getEngagementMetrics(timeRange: AnalyticsTimeRange): Promise<EngagementMetricsData> {
    const response = await api.get('/analytics/engagement', {
      params: timeRange
    });
    return response.data.data;
  },

  /**
   * Get campaign performance data
   */
  async getCampaignPerformance(timeRange: AnalyticsTimeRange): Promise<CampaignPerformanceData[]> {
    const response = await api.get('/analytics/campaigns', {
      params: timeRange
    });
    return response.data.data;
  },

  /**
   * Get key metrics summary
   */
  async getKeyMetrics(timeRange: AnalyticsTimeRange): Promise<KeyMetricsData> {
    const response = await api.get('/analytics/key-metrics', {
      params: timeRange
    });
    return response.data.data;
  }
};