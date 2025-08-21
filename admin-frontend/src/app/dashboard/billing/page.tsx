'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CurrencyRupeeIcon,
  DocumentTextIcon,
  ArrowTrendingUpIcon
} from '@heroicons/react/24/outline';
import AdminLayout from '@/components/layout/AdminLayout';
import { apiClient } from '@/lib/api';
import toast from 'react-hot-toast';

interface Invoice {
  id: string;
  tenantId: string;
  tenantName: string;
  userEmail: string;
  subscriptionId: string;
  subscriptionTier: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  paymentMethod: string;
  transactionId?: string;
  invoiceNumber: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  dueDate: string;
  paidAt?: string;
  createdAt: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

interface RechargeTransaction {
  id: string;
  tenantId: string;
  tenantName: string;
  userEmail: string;
  amount: number;
  recipientCount: number;
  pricePerRecipient: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  paymentMethod: string;
  transactionId?: string;
  createdAt: string;
  completedAt?: string;
}

interface BillingStats {
  totalRevenue: number;
  monthlyRevenue: number;
  rechargeRevenue: number;
  subscriptionRevenue: number;
  totalInvoices: number;
  paidInvoices: number;
  pendingInvoices: number;
  failedInvoices: number;
  totalRechargeTransactions: number;
  averageInvoiceAmount: number;
  averageRechargeAmount: number;
  revenueByTier: Record<string, number>;
  monthlyRevenueGrowth: number;
}

export default function BillingPage() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'recharge' | 'stats'>('invoices');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [rechargeTransactions, setRechargeTransactions] = useState<RechargeTransaction[]>([]);
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedTier, setSelectedTier] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchInvoices = async (page = 1) => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit: 20,
        search: searchTerm || undefined,
        status: selectedStatus || undefined,
        subscriptionTier: selectedTier || undefined
      };

      const response = await apiClient.getInvoices(params);
      setInvoices(response.data);
      setTotalPages(Math.ceil((response.meta?.total || 0) / (response.meta?.limit || 10)));
      setCurrentPage(page);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const fetchRechargeTransactions = async (page = 1) => {
    try {
      setLoading(true);
      const params: any = {
        page,
        limit: 20,
        search: searchTerm || undefined,
        status: selectedStatus || undefined,
        subscriptionTier: selectedTier || undefined
      };

      const response = await apiClient.getRechargeTransactions(params);
      setRechargeTransactions(response.data);
      setTotalPages(Math.ceil((response.meta?.total || 0) / (response.meta?.limit || 10)));
      setCurrentPage(page);
    } catch (error: any) {
      toast.error(error.message || 'Failed to fetch recharge transactions');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await apiClient.getBillingStats();
      setStats(response.data);
    } catch (error: any) {
      console.error('Failed to fetch billing stats:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'invoices') {
      fetchInvoices(1);
    } else if (activeTab === 'recharge') {
      fetchRechargeTransactions(1);
    }
    fetchStats();
  }, [activeTab, searchTerm, selectedStatus, selectedTier]);

  const handleMarkAsPaid = async (invoiceId: string) => {
    const transactionId = prompt('Enter transaction ID (optional):');
    
    try {
      await apiClient.markInvoiceAsPaid(invoiceId, transactionId || undefined);
      toast.success('Invoice marked as paid successfully');
      fetchInvoices(currentPage);
      fetchStats();
    } catch (error: any) {
      toast.error(error.message || 'Failed to mark invoice as paid');
    }
  };

  const handleRefundInvoice = async (invoiceId: string) => {
    const reason = prompt('Enter refund reason:');
    if (!reason) return;

    if (!confirm('Are you sure you want to refund this invoice?')) {
      return;
    }

    try {
      await apiClient.refundInvoice(invoiceId, reason);
      toast.success('Invoice refunded successfully');
      fetchInvoices(currentPage);
      fetchStats();
    } catch (error: any) {
      toast.error(error.message || 'Failed to refund invoice');
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'refunded': return 'bg-gray-100 text-gray-800';
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

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatCurrency = (amount: number, currency = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0
    }).format(amount);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-gray-900">Billing Management</h1>
            <p className="mt-2 text-sm text-gray-700">
              Manage invoices, recharge transactions, and billing oversight.
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
                    <CurrencyRupeeIcon className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Revenue
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatCurrency(stats.totalRevenue)}
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
                    <ArrowTrendingUpIcon className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Monthly Revenue
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatCurrency(stats.monthlyRevenue)}
                      </dd>
                      <dd className="text-xs text-gray-500">
                        {stats.monthlyRevenueGrowth > 0 ? '+' : ''}{stats.monthlyRevenueGrowth.toFixed(1)}% growth
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
                    <DocumentTextIcon className="h-6 w-6 text-indigo-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Invoices
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {stats.totalInvoices}
                      </dd>
                      <dd className="text-xs text-gray-500">
                        {stats.paidInvoices} paid, {stats.pendingInvoices} pending
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
                    <span className="text-2xl">🔄</span>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Recharge Revenue
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {formatCurrency(stats.rechargeRevenue)}
                      </dd>
                      <dd className="text-xs text-gray-500">
                        {stats.totalRechargeTransactions} transactions
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('invoices')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'invoices'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Invoices
            </button>
            <button
              onClick={() => setActiveTab('recharge')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'recharge'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Recharge Transactions
            </button>
            <button
              onClick={() => setActiveTab('stats')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'stats'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Revenue Analytics
            </button>
          </nav>
        </div>

        {/* Filters */}
        {(activeTab === 'invoices' || activeTab === 'recharge') && (
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
                      placeholder="Search..."
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
                    {activeTab === 'invoices' ? (
                      <>
                        <option value="paid">Paid</option>
                        <option value="pending">Pending</option>
                        <option value="failed">Failed</option>
                        <option value="refunded">Refunded</option>
                      </>
                    ) : (
                      <>
                        <option value="completed">Completed</option>
                        <option value="pending">Pending</option>
                        <option value="failed">Failed</option>
                        <option value="refunded">Refunded</option>
                      </>
                    )}
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
        )}

        {/* Content */}
        {activeTab === 'invoices' && (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {invoices.map((invoice, index) => (
                  <motion.li
                    key={invoice.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="px-4 py-4 flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {invoice.tenantName[0]?.toUpperCase() || invoice.userEmail[0].toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center space-x-2">
                            <div className="text-sm font-medium text-gray-900">
                              {invoice.invoiceNumber}
                            </div>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(invoice.status)}`}>
                              {invoice.status}
                            </span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTierBadgeColor(invoice.subscriptionTier)}`}>
                              {invoice.subscriptionTier.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {invoice.userEmail} • {invoice.tenantName}
                          </div>
                          <div className="text-xs text-gray-400">
                            Amount: {formatCurrency(invoice.amount)} • Due: {formatDateTime(invoice.dueDate)}
                            {invoice.paidAt && ` • Paid: ${formatDateTime(invoice.paidAt)}`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(invoice.amount)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {invoice.paymentMethod}
                          </div>
                        </div>

                        {invoice.status === 'pending' && (
                          <div className="flex space-x-1">
                            <button
                              onClick={() => handleMarkAsPaid(invoice.id)}
                              className="text-green-600 hover:text-green-900 text-xs px-2 py-1 border border-green-300 rounded"
                            >
                              Mark Paid
                            </button>
                          </div>
                        )}

                        {invoice.status === 'paid' && (
                          <div className="flex space-x-1">
                            <button
                              onClick={() => handleRefundInvoice(invoice.id)}
                              className="text-red-600 hover:text-red-900 text-xs px-2 py-1 border border-red-300 rounded"
                            >
                              Refund
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
        )}

        {activeTab === 'recharge' && (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {rechargeTransactions.map((transaction, index) => (
                  <motion.li
                    key={transaction.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="px-4 py-4 flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-green-600 flex items-center justify-center">
                            <span className="text-sm font-medium text-white">
                              {transaction.tenantName[0]?.toUpperCase() || transaction.userEmail[0].toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center space-x-2">
                            <div className="text-sm font-medium text-gray-900">
                              Recharge Transaction
                            </div>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(transaction.status)}`}>
                              {transaction.status}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {transaction.userEmail} • {transaction.tenantName}
                          </div>
                          <div className="text-xs text-gray-400">
                            Recipients: {transaction.recipientCount} • Rate: {formatCurrency(transaction.pricePerRecipient)}/recipient
                            {transaction.completedAt && ` • Completed: ${formatDateTime(transaction.completedAt)}`}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">
                            {formatCurrency(transaction.amount)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {transaction.paymentMethod}
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatDateTime(transaction.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        )}

        {activeTab === 'stats' && stats && (
          <div className="space-y-6">
            {/* Revenue by Tier */}
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Revenue by Subscription Tier</h3>
                <div className="space-y-3">
                  {Object.entries(stats.revenueByTier).map(([tier, revenue]) => (
                    <div key={tier} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTierBadgeColor(tier)}`}>
                          {tier.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(revenue)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Average Transaction Values</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Average Invoice</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(stats.averageInvoiceAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Average Recharge</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(stats.averageRechargeAmount)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Revenue Breakdown</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Subscription Revenue</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(stats.subscriptionRevenue)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-500">Recharge Revenue</span>
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(stats.rechargeRevenue)}
                      </span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-medium">
                      <span className="text-sm text-gray-900">Total Revenue</span>
                      <span className="text-sm text-gray-900">
                        {formatCurrency(stats.totalRevenue)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pagination */}
        {(activeTab === 'invoices' || activeTab === 'recharge') && totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => activeTab === 'invoices' ? fetchInvoices(currentPage - 1) : fetchRechargeTransactions(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => activeTab === 'invoices' ? fetchInvoices(currentPage + 1) : fetchRechargeTransactions(currentPage + 1)}
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
                        onClick={() => activeTab === 'invoices' ? fetchInvoices(page) : fetchRechargeTransactions(page)}
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