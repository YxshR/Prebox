'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  ChartBarIcon, 
  EnvelopeIcon, 
  UsersIcon, 
  EyeIcon,
  CursorArrowRaysIcon,
  ExclamationTriangleIcon,
  UserMinusIcon,
  MegaphoneIcon
} from '@heroicons/react/24/outline';

import TimeRangeSelector from '../../../components/analytics/TimeRangeSelector';
import AnimatedMetricCard from '../../../components/analytics/AnimatedMetricCard';
import DeliveryTrendsChart from '../../../components/analytics/DeliveryTrendsChart';
import EngagementMetricsChart from '../../../components/analytics/EngagementMetricsChart';
import CampaignPerformanceChart from '../../../components/analytics/CampaignPerformanceChart';
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner';

import { 
  analyticsApi, 
  AnalyticsData, 
  AnalyticsTimeRange 
} from '../../../lib/analyticsApi';

export default function AnalyticsPage() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Default to last 30 days
  const [timeRange, setTimeRange] = useState<AnalyticsTimeRange>(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 30);
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      period: 'daily'
    };
  });

  const fetchAnalyticsData = async (range: AnalyticsTimeRange) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Try to fetch real data from the API
      try {
        const data = await analyticsApi.getDashboardAnalytics(range);
        setAnalyticsData(data);
      } catch (apiError) {
        // Fallback to mock data if API is not available
        console.warn('Analytics API not available, using mock data:', apiError);
        const mockData: AnalyticsData = {
          deliveryTrends: generateMockDeliveryTrends(range),
          engagementMetrics: {
            opens: 1250,
            clicks: 340,
            unsubscribes: 25,
            complaints: 8,
            totalSent: 2500
          },
          campaignPerformance: [
            { campaignName: 'Welcome Series', delivered: 850, opened: 425, clicked: 127, bounced: 45, unsubscribed: 12 },
            { campaignName: 'Product Launch', delivered: 720, opened: 360, clicked: 108, bounced: 38, unsubscribed: 8 },
            { campaignName: 'Newsletter #42', delivered: 650, opened: 292, clicked: 87, bounced: 32, unsubscribed: 5 },
            { campaignName: 'Black Friday', delivered: 280, opened: 168, clicked: 56, bounced: 15, unsubscribed: 3 }
          ],
          keyMetrics: {
            totalEmailsSent: 2500,
            deliveryRate: 94.2,
            openRate: 50.0,
            clickRate: 13.6,
            bounceRate: 5.2,
            unsubscribeRate: 1.0,
            activeContacts: 1850,
            activeCampaigns: 4
          }
        };
        setAnalyticsData(mockData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics data');
    } finally {
      setIsLoading(false);
    }
  };

  const generateMockDeliveryTrends = (range: AnalyticsTimeRange) => {
    const start = new Date(range.startDate);
    const end = new Date(range.endDate);
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    const trends = [];
    for (let i = 0; i < Math.min(days, 30); i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      
      const total = Math.floor(Math.random() * 200) + 50;
      const delivered = Math.floor(total * (0.9 + Math.random() * 0.08));
      const bounced = Math.floor(total * (0.02 + Math.random() * 0.06));
      const failed = total - delivered - bounced;
      
      trends.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        delivered,
        bounced,
        failed,
        total
      });
    }
    
    return trends;
  };

  useEffect(() => {
    fetchAnalyticsData(timeRange);
  }, [timeRange]);

  const handleTimeRangeChange = (newRange: AnalyticsTimeRange) => {
    setTimeRange(newRange);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-xl shadow-sm border border-red-200 max-w-md w-full mx-4"
        >
          <div className="text-center">
            <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Analytics</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => fetchAnalyticsData(timeRange)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Time Range Selector */}
        <TimeRangeSelector 
          selectedRange={timeRange}
          onRangeChange={handleTimeRangeChange}
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : analyticsData ? (
          <div className="space-y-8">
            {/* Key Metrics Cards */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              <AnimatedMetricCard
                title="Total Emails Sent"
                value={analyticsData.keyMetrics.totalEmailsSent}
                format="number"
                icon={<EnvelopeIcon className="w-6 h-6" />}
                color="blue"
                delay={0}
              />
              <AnimatedMetricCard
                title="Delivery Rate"
                value={analyticsData.keyMetrics.deliveryRate}
                format="percentage"
                icon={<ChartBarIcon className="w-6 h-6" />}
                color="green"
                delay={0.1}
              />
              <AnimatedMetricCard
                title="Open Rate"
                value={analyticsData.keyMetrics.openRate}
                format="percentage"
                icon={<EyeIcon className="w-6 h-6" />}
                color="purple"
                delay={0.2}
              />
              <AnimatedMetricCard
                title="Click Rate"
                value={analyticsData.keyMetrics.clickRate}
                format="percentage"
                icon={<CursorArrowRaysIcon className="w-6 h-6" />}
                color="indigo"
                delay={0.3}
              />
            </motion.div>

            {/* Secondary Metrics */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              <AnimatedMetricCard
                title="Bounce Rate"
                value={analyticsData.keyMetrics.bounceRate}
                format="percentage"
                icon={<ExclamationTriangleIcon className="w-6 h-6" />}
                color="yellow"
                delay={0.4}
              />
              <AnimatedMetricCard
                title="Unsubscribe Rate"
                value={analyticsData.keyMetrics.unsubscribeRate}
                format="percentage"
                icon={<UserMinusIcon className="w-6 h-6" />}
                color="red"
                delay={0.5}
              />
              <AnimatedMetricCard
                title="Active Contacts"
                value={analyticsData.keyMetrics.activeContacts}
                format="number"
                icon={<UsersIcon className="w-6 h-6" />}
                color="green"
                delay={0.6}
              />
              <AnimatedMetricCard
                title="Active Campaigns"
                value={analyticsData.keyMetrics.activeCampaigns}
                format="number"
                icon={<MegaphoneIcon className="w-6 h-6" />}
                color="blue"
                delay={0.7}
              />
            </motion.div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
              {/* Delivery Trends Chart */}
              <DeliveryTrendsChart 
                data={analyticsData.deliveryTrends}
                isLoading={false}
              />

              {/* Engagement Metrics Chart */}
              <EngagementMetricsChart 
                data={analyticsData.engagementMetrics}
                isLoading={false}
              />
            </div>

            {/* Campaign Performance Chart */}
            <CampaignPerformanceChart 
              data={analyticsData.campaignPerformance}
              isLoading={false}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}