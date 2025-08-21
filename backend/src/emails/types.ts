// Email Service Types
export interface EmailJob {
  id: string;
  tenantId: string;
  campaignId?: string;
  to: string;
  from: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  metadata?: Record<string, any>;
  priority: EmailPriority;
  scheduledAt?: Date;
  retryCount?: number;
  maxRetries?: number;
}

export enum EmailPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface EmailProvider {
  name: string;
  sendEmail(job: EmailJob): Promise<EmailSendResult>;
  sendBatch(jobs: EmailJob[]): Promise<BatchSendResult>;
  verifyConfiguration(): Promise<boolean>;
}

export interface EmailSendResult {
  messageId: string;
  status: EmailStatus;
  provider: string;
  timestamp: Date;
  error?: string;
}

export interface BatchSendResult {
  totalJobs: number;
  successful: number;
  failed: number;
  results: EmailSendResult[];
}

export enum EmailStatus {
  QUEUED = 'queued',
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  BOUNCED = 'bounced',
  COMPLAINED = 'complained',
  UNSUBSCRIBED = 'unsubscribed',
  FAILED = 'failed'
}

export interface EmailEvent {
  id: string;
  messageId: string;
  campaignId?: string;
  tenantId: string;
  contactEmail: string;
  eventType: EmailEventType;
  timestamp: Date;
  provider: string;
  metadata?: Record<string, any>;
}

export enum EmailEventType {
  SENT = 'sent',
  DELIVERED = 'delivered',
  BOUNCED = 'bounced',
  COMPLAINED = 'complained',
  OPENED = 'opened',
  CLICKED = 'clicked',
  UNSUBSCRIBED = 'unsubscribed'
}

export interface BounceEvent {
  messageId: string;
  bounceType: BounceType;
  bounceSubType: string;
  timestamp: Date;
  recipients: string[];
  feedbackId?: string;
}

export enum BounceType {
  PERMANENT = 'permanent',
  TRANSIENT = 'transient',
  UNDETERMINED = 'undetermined'
}

export interface ComplaintEvent {
  messageId: string;
  timestamp: Date;
  recipients: string[];
  feedbackId?: string;
  complaintSubType?: string;
}

export interface WebhookPayload {
  provider: string;
  eventType: string;
  timestamp: Date;
  data: any;
  signature?: string;
}

export interface QueueConfig {
  name: string;
  concurrency: number;
  retryAttempts: number;
  retryDelay: number;
  removeOnComplete: number;
  removeOnFail: number;
}