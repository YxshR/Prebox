// User and Authentication Types
export interface User {
  id: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  tenantId: string;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  googleId?: string;
  auth0Id?: string;
  createdAt: Date;
  lastLoginAt: Date;
}

export interface UserRegistration {
  email: string;
  password: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  registrationMethod: 'email' | 'phone_google' | 'auth0';
  auth0Id?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface ApiKey {
  id: string;
  userId: string;
  key: string;
  name: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
}

export interface OTPVerification {
  id: string;
  userId: string;
  phone: string;
  code: string;
  type: 'registration' | 'login' | 'password_reset';
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}

export interface EmailVerification {
  id: string;
  userId: string;
  email: string;
  token: string;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}

export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  SUPER_ADMIN = 'super_admin'
}

export enum SubscriptionTier {
  FREE = 'free',
  PAID_STANDARD = 'paid_standard',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise'
}

// Campaign and Email Types
export interface Campaign {
  id: string;
  tenantId: string;
  name: string;
  templateId: string;
  listIds: string[];
  status: CampaignStatus;
  scheduledAt?: Date;
  sentAt?: Date;
  metrics: CampaignMetrics;
}

export enum CampaignStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  SENDING = 'sending',
  SENT = 'sent',
  PAUSED = 'paused',
  FAILED = 'failed'
}

export interface CampaignMetrics {
  totalRecipients: number;
  delivered: number;
  bounced: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  complained: number;
}

// Template Types
export interface EmailTemplate {
  id: string;
  tenantId: string;
  name: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  variables: TemplateVariable[];
  isAIGenerated: boolean;
  createdAt: Date;
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'boolean';
  defaultValue?: string;
  required: boolean;
}

// Contact Management Types
export interface Contact {
  id: string;
  tenantId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  customFields: Record<string, any>;
  subscriptionStatus: SubscriptionStatus;
  createdAt: Date;
}

export enum SubscriptionStatus {
  SUBSCRIBED = 'subscribed',
  UNSUBSCRIBED = 'unsubscribed',
  BOUNCED = 'bounced',
  COMPLAINED = 'complained'
}

// Billing subscription status
export enum BillingSubscriptionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CANCELLED = 'cancelled',
  PAST_DUE = 'past_due',
  TRIALING = 'trialing'
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// Subscription and Billing Types
export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  status: BillingSubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  usage: UsageMetrics;
  limits: TierLimits;
  rechargeBalance: number;
}

export interface UsageMetrics {
  dailyEmailsSent: number;
  monthlyEmailsSent: number;
  uniqueRecipients: number;
  templatesCreated: number;
  customDomainsUsed: number;
  lastResetDate: Date;
}

export interface TierLimits {
  dailyEmailLimit: number;
  monthlyRecipientLimit: number;
  monthlyEmailLimit: number;
  templateLimit: number;
  customDomainLimit: number;
  hasLogoCustomization: boolean;
  hasCustomDomains: boolean;
  hasAdvancedAnalytics: boolean;
}

// Branding and Logo Types
export interface BrandingSettings {
  id: string;
  tenantId: string;
  logoUrl?: string;
  logoPosition: LogoPosition;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  fontFamily: string;
  customCss?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface LogoUpload {
  id: string;
  tenantId: string;
  originalFilename: string;
  storedFilename: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  uploadStatus: UploadStatus;
  createdAt: Date;
}

export enum LogoPosition {
  HEADER = 'header',
  FOOTER = 'footer',
  SIDEBAR = 'sidebar'
}

export enum UploadStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// Scheduled Email Types
export enum ScheduledEmailStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SENT = 'sent',
  CANCELLED = 'cancelled',
  FAILED = 'failed'
}

// Auth0 Types
export interface Auth0Profile {
  id: string;
  userId: string;
  auth0Id: string;
  profileData: Auth0UserProfile;
  createdAt: Date;
  updatedAt: Date;
}

export interface Auth0UserProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
  updated_at?: string;
}

export interface Auth0SignupRequest {
  auth0Profile: Auth0UserProfile;
  phone?: string;
}

export interface Auth0CallbackResult {
  user: User;
  isNewUser: boolean;
  requiresPhoneVerification: boolean;
  otpId?: string;
}