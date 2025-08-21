import axios from 'axios';
import { 
  ScheduledEmail, 
  ScheduledEmailRequest, 
  ScheduleValidationResult,
  ScheduledEmailStats,
  ProcessScheduledEmailsResult
} from '../types/scheduledEmail';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api/emails`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const scheduledEmailApi = {
  /**
   * Schedule an email for future delivery
   */
  async scheduleEmail(emailData: ScheduledEmailRequest): Promise<ScheduledEmail> {
    const response = await api.post('/schedule', emailData);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to schedule email');
    }
    const email = response.data.data;
    return {
      ...email,
      scheduledAt: new Date(email.scheduledAt),
      createdAt: new Date(email.createdAt),
      updatedAt: new Date(email.updatedAt),
      cancelledAt: email.cancelledAt ? new Date(email.cancelledAt) : undefined,
      sentAt: email.sentAt ? new Date(email.sentAt) : undefined,
    };
  },

  /**
   * Cancel a scheduled email
   */
  async cancelScheduledEmail(scheduleId: string): Promise<void> {
    const response = await api.delete(`/schedule/${scheduleId}`);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to cancel scheduled email');
    }
  },

  /**
   * Get all scheduled emails for the current tenant
   */
  async getScheduledEmails(): Promise<ScheduledEmail[]> {
    // Get tenantId from auth context - for now using a placeholder
    const tenantId = 'current-tenant'; // This should come from auth context
    const response = await api.get(`/schedule?tenantId=${tenantId}`);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to fetch scheduled emails');
    }
    return response.data.data.map((email: any) => ({
      ...email,
      scheduledAt: new Date(email.scheduledAt),
      createdAt: new Date(email.createdAt),
      updatedAt: new Date(email.updatedAt),
      cancelledAt: email.cancelledAt ? new Date(email.cancelledAt) : undefined,
      sentAt: email.sentAt ? new Date(email.sentAt) : undefined,
    }));
  },

  /**
   * Get scheduled email statistics
   */
  async getStats(): Promise<ScheduledEmailStats> {
    // Get tenantId from auth context - for now using a placeholder
    const tenantId = 'current-tenant'; // This should come from auth context
    const response = await api.get(`/schedule/stats?tenantId=${tenantId}`);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to fetch stats');
    }
    return response.data.data;
  },

  /**
   * Validate scheduling request
   */
  async validateScheduling(data: {
    tenantId: string;
    scheduledAt: Date;
    userType: 'subscription' | 'recharge';
    recipientCount: number;
  }): Promise<ScheduleValidationResult> {
    const response = await api.post('/schedule/validate', data);
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to validate scheduling');
    }
    return response.data.data;
  },

  /**
   * Manually trigger scheduled emails (admin/system use)
   */
  async triggerScheduledEmails(scheduleIds?: string[]): Promise<ProcessScheduledEmailsResult> {
    const response = await api.post('/schedule/trigger', { scheduleIds });
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to trigger scheduled emails');
    }
    return response.data.data;
  },

  /**
   * Process scheduled emails (system endpoint)
   */
  async processScheduledEmails(): Promise<ProcessScheduledEmailsResult> {
    const response = await api.post('/schedule/process');
    if (!response.data.success) {
      throw new Error(response.data.error?.message || 'Failed to process scheduled emails');
    }
    return response.data.data;
  }
};