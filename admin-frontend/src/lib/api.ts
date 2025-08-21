import axios, { AxiosInstance } from 'axios';
import { authService } from './auth';

// Type definitions
interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt?: string;
  subscriptionTier: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
}

interface Subscription {
  id: string;
  userId: string;
  tier: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  current_period_start: string;
  current_period_end: string;
  email: string;
  tenant_name: string;
  plan_name: string;
  plan_price: number;
  recharge_balance: number;
}

interface UsageData {
  tenantId: string;
  emailsSent: number;
  recipientsReached: number;
  templatesUsed: number;
}

interface AnalyticsData {
  totalUsers: number;
  activeUsers: number;
  totalEmailsSent: number;
  deliveryRate: number;
}

interface ScheduledEmail {
  id: string;
  tenantId: string;
  campaignId: string;
  scheduledAt: string;
  status: 'pending' | 'sent' | 'cancelled' | 'failed';
  tenantName: string;
  userEmail: string;
  campaignName: string;
  subscriptionTier: string;
  userType: 'subscription' | 'recharge';
  recipientCount: number;
  emailSubject: string;
  estimatedCost: number;
  rechargeBalance: number;
  subscriptionStatus: string;
  subscriptionEnd: string;
  createdAt: string;
  lastModified: string;
  priority: string;
  retryCount: number;
  errorMessage?: string;
  failureReason?: string;
  sentAt?: string;
  cancelledAt?: string;
}

interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
  meta?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: `${API_BASE_URL}/admin`,
      timeout: 30000,
    });

    // Request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = authService.getAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor to handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            await authService.refreshAccessToken();
            const token = authService.getAccessToken();
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            authService.logout();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // User Management
  async getUsers(params?: { page?: number; limit?: number; search?: string; role?: string }) {
    const response = await this.client.get('/users', { params });
    return response.data as ApiResponse<User[]>;
  }

  async getUserStats() {
    const response = await this.client.get('/users/stats');
    return response.data;
  }

  async getUserById(userId: string) {
    const response = await this.client.get(`/users/${userId}`);
    return response.data;
  }

  async updateUser(userId: string, updates: Partial<User>) {
    const response = await this.client.put(`/users/${userId}`, updates);
    return response.data as ApiResponse<User>;
  }

  async deleteUser(userId: string) {
    const response = await this.client.delete(`/users/${userId}`);
    return response.data;
  }

  // Subscription Management
  async getSubscriptions(params?: { page?: number; limit?: number; tier?: string; status?: string }) {
    const response = await this.client.get('/subscriptions', { params });
    return response.data as ApiResponse<Subscription[]>;
  }

  async getSubscriptionStats() {
    const response = await this.client.get('/subscriptions/stats');
    return response.data;
  }

  async getRevenueHistory(months?: number) {
    const response = await this.client.get('/subscriptions/revenue-history', {
      params: { months }
    });
    return response.data;
  }

  async getSubscriptionById(subscriptionId: string) {
    const response = await this.client.get(`/subscriptions/${subscriptionId}`);
    return response.data;
  }

  async updateSubscription(subscriptionId: string, updates: Partial<Subscription>) {
    const response = await this.client.put(`/subscriptions/${subscriptionId}`, updates);
    return response.data as ApiResponse<Subscription>;
  }

  async cancelSubscription(subscriptionId: string, reason?: string) {
    const response = await this.client.post(`/subscriptions/${subscriptionId}/cancel`, { reason });
    return response.data;
  }

  // Analytics
  async getSystemMetrics() {
    const response = await this.client.get('/analytics/system-metrics');
    return response.data;
  }

  async getEmailVolumeData(days?: number) {
    const response = await this.client.get('/analytics/email-volume', {
      params: { days }
    });
    return response.data;
  }

  async getTopCampaigns(limit?: number) {
    const response = await this.client.get('/analytics/top-campaigns', {
      params: { limit }
    });
    return response.data;
  }

  async getSystemHealth() {
    const response = await this.client.get('/analytics/system-health');
    return response.data;
  }

  async getTenantUsage(limit?: number) {
    const response = await this.client.get('/analytics/tenant-usage', {
      params: { limit }
    });
    return response.data;
  }

  async getDeliverabilityTrends(days?: number) {
    const response = await this.client.get('/analytics/deliverability-trends', {
      params: { days }
    });
    return response.data;
  }

  // Usage Monitoring
  async getUsageByTenant(params?: { tenantId?: string; startDate?: string; endDate?: string }) {
    const response = await this.client.get('/usage', { params });
    return response.data as ApiResponse<UsageData[]>;
  }

  async getUsageStats() {
    const response = await this.client.get('/usage/stats');
    return response.data;
  }

  async updateTenantQuota(tenantId: string, quotaUpdates: { 
    dailyLimit?: number; 
    monthlyEmailLimit?: number; 
    monthlyRecipientLimit?: number; 
    templateLimit?: number; 
    customDomainLimit?: number; 
  }) {
    const response = await this.client.put(`/usage/${tenantId}/quota`, quotaUpdates);
    return response.data as ApiResponse<void>;
  }

  async resetTenantUsage(tenantId: string, resetType: 'daily' | 'monthly' | 'all') {
    const response = await this.client.post(`/usage/${tenantId}/reset`, { resetType });
    return response.data;
  }

  // Scheduled Email Monitoring
  async getScheduledEmails(params?: { page?: number; limit?: number; status?: string; tenantId?: string }) {
    const response = await this.client.get('/scheduled-emails', { params });
    return response.data as ApiResponse<ScheduledEmail[]>;
  }

  async getScheduledEmailStats() {
    const response = await this.client.get('/scheduled-emails/stats');
    return response.data;
  }

  async getScheduledEmailById(scheduledEmailId: string) {
    const response = await this.client.get(`/scheduled-emails/${scheduledEmailId}`);
    return response.data;
  }

  async cancelScheduledEmail(scheduledEmailId: string, reason?: string) {
    const response = await this.client.post(`/scheduled-emails/${scheduledEmailId}/cancel`, { reason });
    return response.data;
  }

  async rescheduleEmail(scheduledEmailId: string, newScheduledAt: Date) {
    const response = await this.client.post(`/scheduled-emails/${scheduledEmailId}/reschedule`, { newScheduledAt });
    return response.data;
  }

  async bulkCancelScheduledEmails(filters: { tenantId?: string; status?: string; subscriptionTier?: string; userType?: string }, reason?: string) {
    const response = await this.client.post('/scheduled-emails/bulk-cancel', { filters, reason });
    return response.data as ApiResponse<{ cancelledCount: number }>;
  }

  // Enhanced Billing
  async getInvoices(params?: { page?: number; limit?: number; status?: string; userId?: string }) {
    const response = await this.client.get('/billing/invoices', { params });
    return response.data as ApiResponse<any[]>;
  }

  async getRechargeTransactions(params?: { page?: number; limit?: number; userId?: string; startDate?: string; endDate?: string }) {
    const response = await this.client.get('/billing/recharge-transactions', { params });
    return response.data as ApiResponse<any[]>;
  }

  async getBillingStats() {
    const response = await this.client.get('/billing/stats');
    return response.data;
  }

  async markInvoiceAsPaid(invoiceId: string, transactionId?: string) {
    const response = await this.client.post(`/billing/invoices/${invoiceId}/mark-paid`, { transactionId });
    return response.data;
  }

  async refundInvoice(invoiceId: string, reason?: string) {
    const response = await this.client.post(`/billing/invoices/${invoiceId}/refund`, { reason });
    return response.data;
  }

  async generateInvoiceReport(filters?: { startDate?: string; endDate?: string; status?: string }) {
    const response = await this.client.get('/billing/reports/invoices', { params: filters });
    return response.data as ApiResponse<any>;
  }
}

export const apiClient = new ApiClient();