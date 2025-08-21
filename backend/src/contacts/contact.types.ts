// Contact Management Types and Interfaces

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

export interface ContactListMembership {
  id: string;
  contactId: string;
  listId: string;
  addedAt: Date;
  addedBy: string;
}

export interface ContactEngagementEvent {
  id: string;
  contactId: string;
  campaignId?: string;
  eventType: EngagementEventType;
  eventData: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

export interface ContactImportJob {
  id: string;
  tenantId: string;
  filename: string;
  fileSize: number;
  totalRows: number;
  processedRows: number;
  successfulImports: number;
  failedImports: number;
  status: ImportJobStatus;
  errorDetails?: Record<string, any>;
  listId?: string;
  createdAt: Date;
  completedAt?: Date;
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

export interface ContactSegment {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  conditions: SegmentConditions;
  contactCount: number;
  lastCalculatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
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

export enum ImportJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export enum SuppressionType {
  BOUNCE = 'bounce',
  COMPLAINT = 'complaint',
  UNSUBSCRIBE = 'unsubscribe',
  MANUAL = 'manual'
}

// Request/Response Types
export interface CreateContactRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  customFields?: Record<string, any>;
  tags?: string[];
  listIds?: string[];
}

export interface UpdateContactRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  customFields?: Record<string, any>;
  tags?: string[];
  subscriptionStatus?: SubscriptionStatus;
}

export interface CreateContactListRequest {
  name: string;
  description?: string;
  isSuppressionList?: boolean;
}

export interface UpdateContactListRequest {
  name?: string;
  description?: string;
}

export interface ImportContactsRequest {
  listId?: string;
  createNewList?: boolean;
  newListName?: string;
  skipDuplicates?: boolean;
  updateExisting?: boolean;
}

export interface ContactImportResult {
  jobId: string;
  totalRows: number;
  successfulImports: number;
  failedImports: number;
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  email?: string;
  error: string;
  details?: Record<string, any>;
}

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

// Segmentation Types
export interface SegmentConditions {
  rules: SegmentRule[];
  operator: 'AND' | 'OR';
}

export interface SegmentRule {
  field: string; // email, firstName, lastName, customFields.fieldName, engagement.opens, etc.
  operator: SegmentOperator;
  value: any;
}

export enum SegmentOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  IN = 'in',
  NOT_IN = 'not_in',
  IS_NULL = 'is_null',
  IS_NOT_NULL = 'is_not_null'
}

// CSV Import Types
export interface CSVImportMapping {
  email: string; // Required field mapping
  firstName?: string;
  lastName?: string;
  phone?: string;
  customFields?: Record<string, string>; // CSV column -> custom field mapping
}

export interface CSVValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  totalRows: number;
  validRows: number;
  duplicateEmails: string[];
  invalidEmails: string[];
}

// Export Types
export interface ContactExportRequest {
  listIds?: string[];
  segmentIds?: string[];
  filters?: ContactSearchFilters;
  includeEngagementData?: boolean;
  format: 'csv' | 'json';
}

export interface ContactExportResult {
  downloadUrl: string;
  filename: string;
  totalContacts: number;
  expiresAt: Date;
}