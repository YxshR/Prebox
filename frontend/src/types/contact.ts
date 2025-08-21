// Contact Management Types for Frontend

export interface Contact {
  id: string;
  tenantId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  customFields: Record<string, any>;
  subscriptionStatus: SubscriptionStatus;
  source: ContactSource;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactList {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  contactCount: number;
  isSuppressionList: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactEngagementSummary {
  contactId: string;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalBounced: number;
  totalComplaints: number;
  lastEngagement?: Date;
  engagementScore: number; // 0-100 based on engagement activity
}

export interface SuppressionEntry {
  id: string;
  tenantId: string;
  email: string;
  suppressionType: SuppressionType;
  reason?: string;
  sourceCampaignId?: string;
  createdAt: Date;
}

export interface EmailHistoryEntry {
  id: string;
  contactId: string;
  campaignId?: string;
  subject: string;
  sentAt: Date;
  status: EmailStatus;
  eventType: EngagementEventType;
  eventData?: Record<string, any>;
}

// Enums
export enum SubscriptionStatus {
  SUBSCRIBED = 'subscribed',
  UNSUBSCRIBED = 'unsubscribed',
  BOUNCED = 'bounced',
  COMPLAINED = 'complained'
}

export enum ContactSource {
  MANUAL = 'manual',
  IMPORT = 'import',
  API = 'api',
  FORM = 'form'
}

export enum EngagementEventType {
  SENT = 'sent',
  DELIVERED = 'delivered',
  OPENED = 'opened',
  CLICKED = 'clicked',
  BOUNCED = 'bounced',
  COMPLAINED = 'complained',
  UNSUBSCRIBED = 'unsubscribed'
}

export enum SuppressionType {
  BOUNCE = 'bounce',
  COMPLAINT = 'complaint',
  UNSUBSCRIBE = 'unsubscribe',
  MANUAL = 'manual'
}

export enum EmailStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  BOUNCED = 'bounced',
  FAILED = 'failed'
}

// Request/Response Types
export interface ContactSearchFilters {
  email?: string;
  firstName?: string;
  lastName?: string;
  subscriptionStatus?: SubscriptionStatus;
  tags?: string[];
  listIds?: string[];
  source?: ContactSource;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface ContactSearchResult {
  contacts: Contact[];
  total: number;
}

export interface CreateContactListRequest {
  name: string;
  description?: string;
  isSuppressionList?: boolean;
}

export interface UpdateContactRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  customFields?: Record<string, any>;
  tags?: string[];
  subscriptionStatus?: SubscriptionStatus;
}