'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import AdminLayout from '@/components/layout/AdminLayout';
import { apiClient } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AnalyticsPage() {
  const [systemMetrics, setSystemMetrics] = useState<Record<string, number> | null>(null);
  const [emailVolumeData, setEmailVolumeData] = useState<Array<{ date: string; volume: number }>>([]);
  const [topCampaigns, setTopCampaigns] = useState<Array<{ 
    campaignId: string; 
    campaignName: string; 
    tenantName: string; 
    totalSent: number; 
    deliveryRate: number; 
  }>>([]);
  const [systemHealth, setSystemHealth] = useState<{ 
    errorRate: number; 
    uptime: number; 
    responseTime: number; 
    [key: string]: string | number; 
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        setLoading(true);
        const [metrics, volume, campaigns, health] = await Promise.all([
          apiClient.getSystemMetrics(),
          apiClient.getEmailVolumeData(30),
          apiClient.getTopCampaigns(10),
          apiClient.getSystemHealth()
        ]);

        setSystemMetrics(metrics.data);
        setEmailVolumeData(volume.data);
        setTopCampaigns(campaigns.data);
        setSystemHealth(health.data);
      } catch (error: unknown) {
        console.error('Failed to fetch analytics data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyticsData();
  }, []);

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Analytics</h1>
          <p className="mt-2 text-sm text-gray-700">
            System performance metrics and email delivery analytics.
          </p>
        </div>

        {/* System Metrics */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white overflow-hidden shadow rounded-lg"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-2xl">📧</div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Total Emails
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {systemMetrics?.totalEmails?.toLocaleString() || 0}
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white overflow-hidden shadow rounded-lg"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-2xl">📈</div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Delivery Rate
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {systemMetrics?.deliveryRate?.toFixed(1) || 0}%
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white overflow-hidden shadow rounded-lg"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-2xl">👁️</div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Open Rate
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {systemMetrics?.openRate?.toFixed(1) || 0}%
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white overflow-hidden shadow rounded-lg"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="text-2xl">🔄</div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      Bounce Rate
                    </dt>
                    <dd className="text-lg font-medium text-gray-900">
                      {systemMetrics?.bounceRate?.toFixed(1) || 0}%
                    </dd>
                  </dl>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Email Volume Chart */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white p-6 rounded-lg shadow"
          >
            <h3 className="text-lg font-medium text-gray-900 mb-4">Email Volume (Last 30 Days)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={emailVolumeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="sent" stroke="#8884d8" strokeWidth={2} name="Sent" />
                <Line type="monotone" dataKey="delivered" stroke="#82ca9d" strokeWidth={2} name="Delivered" />
                <Line type="monotone" dataKey="bounced" stroke="#ff7c7c" strokeWidth={2} name="Bounced" />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Top Campaigns */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white p-6 rounded-lg shadow"
          >
            <h3 className="text-lg font-medium text-gray-900 mb-4">Top Performing Campaigns</h3>
            <div className="space-y-4">
              {topCampaigns.slice(0, 5).map((campaign, index) => (
                <div key={campaign.campaignId} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {campaign.campaignName}
                    </div>
                    <div className="text-xs text-gray-500">{campaign.tenantName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {campaign.deliveryRate?.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {campaign.totalSent} sent
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* System Health */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white shadow rounded-lg"
        >
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">System Health</h3>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="text-2xl font-bold text-blue-600">
                        {systemHealth?.queueSize || 0}
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <div className="text-sm font-medium text-gray-500">Queue Size</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="text-2xl font-bold text-green-600">
                        {systemHealth?.processingRate || 0}
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <div className="text-sm font-medium text-gray-500">Processing Rate/hr</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="text-2xl font-bold text-red-600">
                        {systemHealth?.errorRate?.toFixed(1) || 0}%
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <div className="text-sm font-medium text-gray-500">Error Rate</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="text-2xl font-bold text-purple-600">
                        {systemHealth?.activeConnections || 0}
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <div className="text-sm font-medium text-gray-500">Active Connections</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AdminLayout>
  );
}