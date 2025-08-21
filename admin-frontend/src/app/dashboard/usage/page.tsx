'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import AdminLayout from '@/components/layout/AdminLayout';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface TenantUsage {
  tenantId: string;
  tenantName: string;
  userEmail: string;
  subscriptionTier: string;
  dailyEmailsSent: number;
  monthlyEmailsSent: number;
  uniqueRecipients: number;
  templatesCreated: number;
  customDomainsUsed: number;
  rechargeBalance: number;
  dailyLimit: number;
  monthlyEmailLimit: number;
  monthlyRecipientLimit: number;
  templateLimit: number;
  customDomainLimit: number;
  usagePercentage: {
    daily: number;
    monthlyEmails: number;
    monthlyRecipients: number;
    templates: number;
    domains: number;
  };
  lastResetDate: string;
  createdAt: string;
}

interface UsageStats {
  totalTenants: number;
  activeTenantsToday: number;
  totalEmailsSentToday: number;
  totalEmailsSentThisMonth: number;
  averageUsageByTier: Record<string, {
    dailyUsage: number;
    monthlyUsage: number;
    recipientUsage: number;
  }>;
  topUsageTenants: Array<{
    tenantName: string;
    userEmail: string;
    subscriptionTier: string;
    monthlyEmailsSent: number;
    usagePercentage: number;
  }>;
}

export default function UsagePage() {
  const [usage, setUsage] = useState<TenantUsage[]>([]);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTier, setSelectedTier] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedTenant, setSelectedTenant] = useState<TenantUsage | null>(null);
  const [showQuotaModal, setShowQuotaModal] = useState(false);

  const fetchUsage = async (page = 1) => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit: 20,
        search: searchTerm || undefined,
        subscriptionTier: selectedTier || undefined
      };

      const response = await apiClient.getTenantUsage(params);
      setUsage(response.data);
      setTotalPages(Math.ceil(response.meta.total / response.meta.limit));
      setCurrentPage(page);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch usage data');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.getUsageStats();
      setStats(response.data);
    } catch (error: any) {
      console.error('Failed to fetch usage stats:', error);
    }
  };

  useEffect(() => {
    fetchUsage(1);
    fetchStats();
  }, [searchTerm, selectedTier]);

  const handleResetUsage = async (tenantId: string, resetType: 'daily' | 'monthly' | 'all') => {
    if (!confirm(`Are you sure you want to reset ${resetType} usage for this tenant?`)) {
      return;
    }

    try {
      await apiClient.resetTenantUsage(tenantId, resetType);
      toast.success(`${resetType} usage reset successfully`);
      fetchUsage(currentPage);
      fetchStats();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reset usage');
    }
  };

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600 bg-red-100';
    if (percentage >= 75) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'bg-purple-100 text-purple-800';
      case 'premium': return 'bg-blue-100 text-blue-800';
      case 'paid_standard': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-gray-900">Usage Monitoring</h1>
            <p className="mt-2 text-sm text-gray-700">
              Monitor tenant usage and quota management across all subscription tiers.
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
                        Total Tenants
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.totalTenants}
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
                    <ClockIcon className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Active Today
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.activeTenantsToday}
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
                    <span className="text-2xl">📧</span>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Emails Today
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.totalEmailsSentToday.toLocaleString()}
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
                        Emails This Month
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.totalEmailsSentThisMonth.toLocaleString()}
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Search</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                    placeholder="Search tenants..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Subscription Tier</label>
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
                  onClick={() => fetchUsage(1)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <ArrowPathIcon className="h-4 w-4 mr-2" />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {usage.map((tenant, index) => (
                <motion.li
                  key={tenant.tenantId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <div className="px-4 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {tenant.tenantName[0]?.toUpperCase() || tenant.userEmail[0].toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center">
                            <div className="text-sm font-medium text-gray-900">
                              {tenant.tenantName}
                            </div>
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTierBadgeColor(tenant.subscriptionTier)}`}>
                              {tenant.subscriptionTier.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">{tenant.userEmail}</div>
                          {tenant.rechargeBalance > 0 && (
                            <div className="text-xs text-green-600">
                              Balance: ₹{tenant.rechargeBalance}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        {/* Usage Indicators */}
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className={`px-2 py-1 rounded-full ${getUsageColor(tenant.usagePercentage.daily)}`}>
                            Daily: {tenant.dailyEmailsSent}/{tenant.dailyLimit} ({tenant.usagePercentage.daily.toFixed(0)}%)
                          </div>
                          <div className={`px-2 py-1 rounded-full ${getUsageColor(tenant.usagePercentage.monthlyEmails)}`}>
                            Monthly: {tenant.monthlyEmailsSent}/{tenant.monthlyEmailLimit} ({tenant.usagePercentage.monthlyEmails.toFixed(0)}%)
                          </div>
                          <div className={`px-2 py-1 rounded-full ${getUsageColor(tenant.usagePercentage.monthlyRecipients)}`}>
                            Recipients: {tenant.uniqueRecipients}/{tenant.monthlyRecipientLimit} ({tenant.usagePercentage.monthlyRecipients.toFixed(0)}%)
                          </div>
                          <div className={`px-2 py-1 rounded-full ${getUsageColor(tenant.usagePercentage.templates)}`}>
                            Templates: {tenant.templatesCreated}/{tenant.templateLimit} ({tenant.usagePercentage.templates.toFixed(0)}%)
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleResetUsage(tenant.tenantId, 'daily')}
                            className="text-blue-600 hover:text-blue-900 text-xs px-2 py-1 border border-blue-300 rounded"
                          >
                            Reset Daily
                          </button>
                          <button
                            onClick={() => handleResetUsage(tenant.tenantId, 'monthly')}
                            className="text-orange-600 hover:text-orange-900 text-xs px-2 py-1 border border-orange-300 rounded"
                          >
                            Reset Monthly
                          </button>
                          <button
                            onClick={() => {
                              setSelectedTenant(tenant);
                              setShowQuotaModal(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-900 text-xs px-2 py-1 border border-indigo-300 rounded"
                          >
                            Edit Quota
                          </button>
                        </div>
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
                onClick={() => fetchUsage(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => fetchUsage(currentPage + 1)}
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
                        onClick={() => fetchUsage(page)}
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

      {/* Quota Edit Modal */}
      {showQuotaModal && selectedTenant && (
        <QuotaEditModal
          tenant={selectedTenant}
          onClose={() => setShowQuotaModal(false)}
          onUpdate={() => {
            fetchUsage(currentPage);
            setShowQuotaModal(false);
          }}
        />
      )}
    </AdminLayout>
  );
}

function QuotaEditModal({ tenant, onClose, onUpdate }: {
  tenant: TenantUsage;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [formData, setFormData] = useState({
    dailyLimit: tenant.dailyLimit,
    monthlyEmailLimit: tenant.monthlyEmailLimit,
    monthlyRecipientLimit: tenant.monthlyRecipientLimit,
    templateLimit: tenant.templateLimit,
    customDomainLimit: tenant.customDomainLimit
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.updateTenantQuota(tenant.tenantId, formData);
      toast.success('Quota updated successfully');
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update quota');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Edit Quota - {tenant.tenantName}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Daily Email Limit</label>
              <input
                type="number"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={formData.dailyLimit}
                onChange={(e) => setFormData({ ...formData, dailyLimit: parseInt(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Monthly Email Limit</label>
              <input
                type="number"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={formData.monthlyEmailLimit}
                onChange={(e) => setFormData({ ...formData, monthlyEmailLimit: parseInt(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Monthly Recipient Limit</label>
              <input
                type="number"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={formData.monthlyRecipientLimit}
                onChange={(e) => setFormData({ ...formData, monthlyRecipientLimit: parseInt(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Template Limit</label>
              <input
                type="number"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={formData.templateLimit}
                onChange={(e) => setFormData({ ...formData, templateLimit: parseInt(e.target.value) })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Custom Domain Limit</label>
              <input
                type="number"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={formData.customDomainLimit}
                onChange={(e) => setFormData({ ...formData, customDomainLimit: parseInt(e.target.value) })}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Update Quota
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}