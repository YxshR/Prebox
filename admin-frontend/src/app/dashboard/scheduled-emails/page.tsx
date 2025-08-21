'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';
import AdminLayout from '@/components/layout/AdminLayout';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface ScheduledEmail {
  id: string;
  tenantId: string;
  tenantName: string;
  userEmail: string;
  campaignId: string;
  campaignName: string;
  subscriptionTier: string;
  userType: 'subscription' | 'recharge';
  scheduledAt: string;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  estimatedCost: number;
  recipientCount: number;
  rechargeBalance: number;
  subscriptionStatus: string;
  subscriptionEnd: string;
  createdAt: string;
  sentAt?: string;
  cancelledAt?: string;
  failureReason?: string;
}

interface ScheduledEmailStats {
  totalScheduled: number;
  pendingScheduled: number;
  sentScheduled: number;
  cancelledScheduled: number;
  failedScheduled: number;
  scheduledByTier: Record<string, number>;
  scheduledByUserType: {
    subscription: number;
    recharge: number;
  };
  upcomingIn24Hours: number;
  estimatedRevenue: number;
}

export default function ScheduledEmailsPage() {
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([]);
  const [stats, setStats] = useState<ScheduledEmailStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedTier, setSelectedTier] = useState('');
  const [selectedUserType, setSelectedUserType] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedEmail, setSelectedEmail] = useState<ScheduledEmail | null>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);

  const fetchScheduledEmails = async (page = 1) => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit: 20,
        search: searchTerm || undefined,
        status: selectedStatus || undefined,
        subscriptionTier: selectedTier || undefined,
        userType: selectedUserType || undefined
      };

      const response = await apiClient.getScheduledEmails(params);
      setScheduledEmails(response.data);
      setTotalPages(Math.ceil((response.meta?.total || 0) / (response.meta?.limit || 10)));
      setCurrentPage(page);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch scheduled emails');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.getScheduledEmailStats();
      setStats(response.data);
    } catch (error: any) {
      console.error('Failed to fetch scheduled email stats:', error);
    }
  };

  useEffect(() => {
    fetchScheduledEmails(1);
    fetchStats();
  }, [searchTerm, selectedStatus, selectedTier, selectedUserType]);

  const handleCancelEmail = async (scheduledEmailId: string) => {
    if (!confirm('Are you sure you want to cancel this scheduled email?')) {
      return;
    }

    try {
      await apiClient.cancelScheduledEmail(scheduledEmailId, 'Admin cancellation');
      toast.success('Scheduled email cancelled successfully');
      fetchScheduledEmails(currentPage);
      fetchStats();
    } catch (error: any) {
      toast.error(error.message || 'Failed to cancel scheduled email');
    }
  };

  const handleBulkCancel = async () => {
    const filters = {
      subscriptionTier: selectedTier || undefined,
      userType: selectedUserType || undefined
    };

    if (!confirm('Are you sure you want to cancel all filtered scheduled emails?')) {
      return;
    }

    try {
      const response = await apiClient.bulkCancelScheduledEmails(filters, 'Bulk admin cancellation');
      toast.success(`${response.data.cancelledCount} scheduled emails cancelled successfully`);
      fetchScheduledEmails(currentPage);
      fetchStats();
    } catch (error: any) {
      toast.error(error.message || 'Failed to bulk cancel scheduled emails');
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'sent': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case 'enterprise': return 'bg-purple-100 text-purple-800';
      case 'premium': return 'bg-blue-100 text-blue-800';
      case 'paid_standard': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUserTypeBadgeColor = (userType: string) => {
    return userType === 'subscription' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800';
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const isUpcoming = (scheduledAt: string) => {
    const now = new Date();
    const scheduled = new Date(scheduledAt);
    const diffHours = (scheduled.getTime() - now.getTime()) / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= 24;
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-gray-900">Scheduled Emails</h1>
            <p className="mt-2 text-sm text-gray-700">
              Monitor and manage scheduled email campaigns across all users.
            </p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <button
              type="button"
              onClick={handleBulkCancel}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:w-auto"
            >
              <XMarkIcon className="h-4 w-4 mr-2" />
              Bulk Cancel
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <ClockIcon className="h-6 w-6 text-yellow-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Pending
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.pendingScheduled}
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
                    <CheckCircleIcon className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Sent
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.sentScheduled}
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
                    <ExclamationTriangleIcon className="h-6 w-6 text-red-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Cancelled/Failed
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.cancelledScheduled + stats.failedScheduled}
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
                    <CalendarIcon className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Next 24h
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.upcomingIn24Hours}
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
                        Est. Revenue
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        ₹{stats.estimatedRevenue.toFixed(0)}
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
              <div>
                <label className="block text-sm font-medium text-gray-700">Search</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md"
                    placeholder="Search emails..."
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
                  <option value="pending">Pending</option>
                  <option value="sent">Sent</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="failed">Failed</option>
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

              <div>
                <label className="block text-sm font-medium text-gray-700">User Type</label>
                <select
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  value={selectedUserType}
                  onChange={(e) => setSelectedUserType(e.target.value)}
                >
                  <option value="">All Types</option>
                  <option value="subscription">Subscription</option>
                  <option value="recharge">Recharge</option>
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

        {/* Scheduled Emails Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {scheduledEmails.map((email, index) => (
                <motion.li
                  key={email.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={isUpcoming(email.scheduledAt) ? 'bg-yellow-50' : ''}
                >
                  <div className="px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center">
                          <span className="text-sm font-medium text-white">
                            {email.tenantName[0]?.toUpperCase() || email.userEmail[0].toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="flex items-center space-x-2">
                          <div className="text-sm font-medium text-gray-900">
                            {email.campaignName}
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(email.status)}`}>
                            {email.status}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTierBadgeColor(email.subscriptionTier)}`}>
                            {email.subscriptionTier.replace('_', ' ')}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getUserTypeBadgeColor(email.userType)}`}>
                            {email.userType}
                          </span>
                          {isUpcoming(email.scheduledAt) && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              Upcoming
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {email.userEmail} • {email.tenantName}
                        </div>
                        <div className="text-xs text-gray-400">
                          Scheduled: {formatDateTime(email.scheduledAt)} • Recipients: {email.recipientCount}
                          {email.estimatedCost > 0 && ` • Cost: ₹${email.estimatedCost}`}
                          {email.rechargeBalance > 0 && ` • Balance: ₹${email.rechargeBalance}`}
                        </div>
                        {email.failureReason && (
                          <div className="text-xs text-red-600 mt-1">
                            Reason: {email.failureReason}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="text-right text-xs text-gray-500">
                        {email.sentAt && <div>Sent: {formatDateTime(email.sentAt)}</div>}
                        {email.cancelledAt && <div>Cancelled: {formatDateTime(email.cancelledAt)}</div>}
                        <div>Created: {formatDateTime(email.createdAt)}</div>
                      </div>

                      {email.status === 'pending' && (
                        <div className="flex space-x-1">
                          <button
                            onClick={() => {
                              setSelectedEmail(email);
                              setShowRescheduleModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 text-xs px-2 py-1 border border-blue-300 rounded"
                          >
                            Reschedule
                          </button>
                          <button
                            onClick={() => handleCancelEmail(email.id)}
                            className="text-red-600 hover:text-red-900 text-xs px-2 py-1 border border-red-300 rounded"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
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
                onClick={() => fetchScheduledEmails(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => fetchScheduledEmails(currentPage + 1)}
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
                        onClick={() => fetchScheduledEmails(page)}
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

      {/* Reschedule Modal */}
      {showRescheduleModal && selectedEmail && (
        <RescheduleModal
          email={selectedEmail}
          onClose={() => setShowRescheduleModal(false)}
          onUpdate={() => {
            fetchScheduledEmails(currentPage);
            setShowRescheduleModal(false);
          }}
        />
      )}
    </AdminLayout>
  );
}

function RescheduleModal({ email, onClose, onUpdate }: {
  email: ScheduledEmail;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [newScheduledAt, setNewScheduledAt] = useState(
    new Date(email.scheduledAt).toISOString().slice(0, 16)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.rescheduleEmail(email.id, new Date(newScheduledAt));
      toast.success('Email rescheduled successfully');
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to reschedule email');
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Reschedule Email</h3>
          <div className="mb-4 p-3 bg-gray-50 rounded">
            <div className="text-sm font-medium">{email.campaignName}</div>
            <div className="text-xs text-gray-500">{email.userEmail}</div>
            <div className="text-xs text-gray-500">Recipients: {email.recipientCount}</div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">New Scheduled Time</label>
              <input
                type="datetime-local"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                value={newScheduledAt}
                onChange={(e) => setNewScheduledAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
                required
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
                Reschedule
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}