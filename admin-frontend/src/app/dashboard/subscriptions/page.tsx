'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PencilIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import AdminLayout from '@/components/layout/AdminLayout';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface Subscription {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  tenant_name: string;
  plan_name: string;
  plan_price: number;
  status: string;
  current_period_start: string;
  current_period_end: string;
  recharge_balance: number;
}

export default function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedTier, setSelectedTier] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<any>(null);

  const fetchSubscriptions = async (page = 1) => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit: 20,
        search: searchTerm || undefined,
        status: selectedStatus || undefined,
        tier: selectedTier || undefined
      };

      const response = await apiClient.getSubscriptions(params);
      setSubscriptions(response.data);
      setTotalPages(Math.ceil((response.meta?.total || 0) / (response.meta?.limit || 10)));
      setCurrentPage(page);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch subscriptions');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.getSubscriptionStats();
      setStats(response.data);
    } catch (error: any) {
      console.error('Failed to fetch subscription stats:', error);
    }
  };

  useEffect(() => {
    fetchSubscriptions(1);
    fetchStats();
  }, [searchTerm, selectedStatus, selectedTier]);

  const handleCancelSubscription = async (subscriptionId: string) => {
    if (!confirm('Are you sure you want to cancel this subscription?')) {
      return;
    }

    try {
      await apiClient.cancelSubscription(subscriptionId, 'Admin cancellation');
      toast.success('Subscription cancelled successfully');
      fetchSubscriptions(currentPage);
      fetchStats();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel subscription');
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'past_due': return 'bg-yellow-100 text-yellow-800';
      case 'trialing': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-gray-900">Subscriptions</h1>
            <p className="mt-2 text-sm text-gray-700">
              Manage user subscriptions, billing, and plan changes.
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <CheckCircleIcon className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Active Subscriptions
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.activeSubscriptions}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ExclamationTriangleIcon className="h-6 w-6 text-yellow-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Past Due
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.pastDueSubscriptions}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <span className="text-2xl">₹</span>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Monthly Revenue
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        ₹{stats.monthlyRevenue?.toLocaleString() || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <span className="text-2xl">📊</span>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Avg Revenue Per User
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        ₹{stats.averageRevenuePerUser?.toFixed(0) || 0}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Search</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                    placeholder="Search subscriptions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="past_due">Past Due</option>
                  <option value="trialing">Trialing</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Tier</label>
                <select
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value)}
                >
                  <option value="">All Tiers</option>
                  <option value="free">Free</option>
                  <option value="paid_standard">Paid Standard</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <FunnelIcon className="h-4 w-4 mr-2" />
                  Filter
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Subscriptions Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {subscriptions.map((subscription, index) => (
                <motion.li
                  key={subscription.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center">
                          <span className="text-sm font-medium text-white">
                            {subscription.first_name?.[0] || subscription.email[0].toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center">
                          <div className="text-sm font-medium text-gray-900">
                            {subscription.first_name} {subscription.last_name}
                          </div>
                          <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(subscription.status)}`}>
                            {subscription.status}
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">{subscription.email}</div>
                        <div className="text-sm text-gray-500">{subscription.tenant_name}</div>
                        <div className="text-xs text-gray-400">
                          {subscription.plan_name} - ₹{subscription.plan_price}/month
                          {subscription.recharge_balance > 0 && ` • Balance: ₹${subscription.recharge_balance}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="text-right">
                        <div className="text-sm text-gray-900">
                          {new Date(subscription.current_period_end).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-gray-500">Next billing</div>
                      </div>

                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleCancelSubscription(subscription.id)}
                          className="text-red-600 hover:text-red-900"
                          disabled={subscription.status === 'cancelled'}
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => fetchSubscriptions(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => fetchSubscriptions(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Page <span className="font-medium">{currentPage}</span> of{' '}
                  <span className="font-medium">{totalPages}</span>
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const page = i + 1;
                    return (
                      <button
                        key={page}
                        onClick={() => fetchSubscriptions(page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          page === currentPage
                            ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}