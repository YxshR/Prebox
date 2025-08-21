'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  UsersIcon,
  CreditCardIcon,
  EnvelopeIcon,
  ChartBarIcon,
  ArrowUpIcon,
  ArrowDownIcon
} from '@heroicons/react/24/outline';
import AdminLayout from '@/components/layout/AdminLayout';
import { apiClient } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface DashboardStats {
  userStats: any;
  subscriptionStats: any;
  systemMetrics: any;
  emailVolumeData: any[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [userStats, subscriptionStats, systemMetrics, emailVolumeData] = await Promise.all([
          apiClient.getUserStats(),
          apiClient.getSubscriptionStats(),
          apiClient.getSystemMetrics(),
          apiClient.getEmailVolumeData(30)
        ]);

        setStats({
          userStats: userStats.data,
          subscriptionStats: subscriptionStats.data,
          systemMetrics: systemMetrics.data,
          emailVolumeData: emailVolumeData.data
        });
      } catch (error: any) {
        setError(error.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
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

  if (error) {
    return (
      <AdminLayout>
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">{error}</div>
        </div>
      </AdminLayout>
    );
  }

  const statCards = [
    {
      name: 'Total Users',
      value: stats?.userStats?.totalUsers || 0,
      change: stats?.userStats?.newUsersThisMonth || 0,
      changeType: 'increase',
      icon: UsersIcon,
      color: 'bg-blue-500'
    },
    {
      name: 'Active Subscriptions',
      value: stats?.subscriptionStats?.activeSubscriptions || 0,
      change: stats?.subscriptionStats?.monthlyRevenue || 0,
      changeType: 'increase',
      icon: CreditCardIcon,
      color: 'bg-green-500'
    },
    {
      name: 'Emails Sent Today',
      value: stats?.systemMetrics?.emailsToday || 0,
      change: stats?.systemMetrics?.deliveryRate || 0,
      changeType: 'increase',
      icon: EnvelopeIcon,
      color: 'bg-purple-500'
    },
    {
      name: 'Monthly Revenue',
      value: `₹${stats?.subscriptionStats?.monthlyRevenue?.toLocaleString() || 0}`,
      change: stats?.subscriptionStats?.averageRevenuePerUser || 0,
      changeType: 'increase',
      icon: ChartBarIcon,
      color: 'bg-yellow-500'
    }
  ];

  const tierData = stats?.userStats?.usersByTier ? Object.entries(stats.userStats.usersByTier).map(([tier, count]) => ({
    name: tier.replace('_', ' ').toUpperCase(),
    value: count
  })) : [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Admin Dashboard</h1>
          <p className="mt-2 text-sm text-gray-700">
            Overview of your email platform performance and metrics.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((item, index) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-white overflow-hidden shadow rounded-lg"
            >
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className={`${item.color} p-3 rounded-md`}>
                      <item.icon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {item.name}
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {item.value}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-5 py-3">
                <div className="text-sm">
                  <div className="flex items-center">
                    {item.changeType === 'increase' ? (
                      <ArrowUpIcon className="h-4 w-4 text-green-500 mr-1" />
                    ) : (
                      <ArrowDownIcon className="h-4 w-4 text-red-500 mr-1" />
                    )}
                    <span className={`${item.changeType === 'increase' ? 'text-green-600' : 'text-red-600'} font-medium`}>
                      {typeof item.change === 'number' ? item.change.toFixed(1) : item.change}
                    </span>
                    <span className="text-gray-500 ml-1">
                      {item.name === 'Monthly Revenue' ? 'ARPU' : 'this month'}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Charts Grid */}
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
              <LineChart data={stats?.emailVolumeData || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="sent" stroke="#8884d8" strokeWidth={2} />
                <Line type="monotone" dataKey="delivered" stroke="#82ca9d" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* User Distribution by Tier */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white p-6 rounded-lg shadow"
          >
            <h3 className="text-lg font-medium text-gray-900 mb-4">Users by Subscription Tier</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={tierData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {tierData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
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
            <h3 className="text-lg leading-6 font-medium text-gray-900">System Performance</h3>
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="text-2xl font-bold text-indigo-600">
                        {stats?.systemMetrics?.deliveryRate?.toFixed(1) || 0}%
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <div className="text-sm font-medium text-gray-500">Delivery Rate</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="text-2xl font-bold text-green-600">
                        {stats?.systemMetrics?.openRate?.toFixed(1) || 0}%
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <div className="text-sm font-medium text-gray-500">Open Rate</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 overflow-hidden shadow rounded-lg">
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="text-2xl font-bold text-red-600">
                        {stats?.systemMetrics?.bounceRate?.toFixed(1) || 0}%
                      </div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <div className="text-sm font-medium text-gray-500">Bounce Rate</div>
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