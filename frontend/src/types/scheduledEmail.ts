export interface ScheduledEmail {
  id: string;
  tenantId: string;
  campaignId?: string;
  emailJob: ScheduledEmailJob;
  scheduledAt: Date;
  status: ScheduleStatus;
  userType: 'subscription' | 'recharge';
  estimatedCost?: number;
  createdAt: Date;
  updatedAt: Date;
  cancelledAt?: Date;
  sentAt?: Date;
  failureReason?: string;
  retryCount: number;
  maxRetries: number;
}

export interface ScheduledEmailJob {
  to: string[];
  from: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  metadata?: Record<string, any>;
}

export enum ScheduleStatus {
  PENDING = 'pending',
  CANCELLED = 'cancelled',
  SENT = 'sent',
  FAILED = 'failed',
  PROCESSING = 'processing'
}

export interface ScheduleValidationResult {
  isValid: boolean;
  reason?: string;
  maxScheduleDate?: Date;
  estimatedCost?: number;
}

export interface ScheduledEmailRequest {
  tenantId: string;
  campaignId?: string;
  emailJob: ScheduledEmailJob;
  scheduledAt: Date;
  userType: 'subscription' | 'recharge';
}

export interface ProcessScheduledEmailsResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  cancelled: number;
  errors: Array<{
    scheduleId: string;
    error: string;
  }>;
}

export interface SchedulingLimits {
  maxDaysInAdvance: number;
  requiresActiveSubscription: boolean;
  requiresSufficientBalance: boolean;
}

export interface ScheduledEmailStats {
  total: number;
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  cancelled: number;
}