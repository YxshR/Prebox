export interface Domain {
  id: string;
  tenantId: string;
  domain: string;
  status: DomainStatus;
  dkimKey: string;
  verificationRecords: DNSRecord[];
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum DomainStatus {
  PENDING = 'pending',
  VERIFYING = 'verifying',
  VERIFIED = 'verified',
  FAILED = 'failed',
  SUSPENDED = 'suspended'
}

export interface DNSRecord {
  type: DNSRecordType;
  name: string;
  value: string;
  ttl?: number;
  priority?: number;
}

export enum DNSRecordType {
  TXT = 'TXT',
  CNAME = 'CNAME',
  MX = 'MX',
  A = 'A'
}

export interface DomainVerificationResult {
  domain: string;
  isVerified: boolean;
  records: DNSRecordVerification[];
  errors: string[];
}

export interface DNSRecordVerification {
  record: DNSRecord;
  isPresent: boolean;
  currentValue?: string;
  error?: string;
}

export interface DomainSetupWizard {
  domain: string;
  spfRecord: DNSRecord;
  dkimRecord: DNSRecord;
  dmarcRecord: DNSRecord;
  verificationRecord: DNSRecord;
  instructions: SetupInstructions;
}

export interface SetupInstructions {
  steps: SetupStep[];
  provider?: string;
  estimatedTime: string;
}

export interface SetupStep {
  title: string;
  description: string;
  record: DNSRecord;
  isCompleted: boolean;
}

export interface DomainReputation {
  domain: string;
  score: number;
  factors: ReputationFactor[];
  lastUpdated: Date;
  recommendations: string[];
}

export interface ReputationFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
  status: 'good' | 'warning' | 'critical';
}

export interface DomainAlert {
  id: string;
  domainId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  details: Record<string, any>;
  isResolved: boolean;
  createdAt: Date;
  resolvedAt?: Date;
}

export enum AlertType {
  VERIFICATION_FAILED = 'verification_failed',
  DNS_RECORD_MISSING = 'dns_record_missing',
  REPUTATION_DECLINE = 'reputation_decline',
  AUTHENTICATION_FAILURE = 'authentication_failure',
  DELIVERY_ISSUES = 'delivery_issues'
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface CreateDomainRequest {
  domain: string;
  tenantId: string;
}

export interface UpdateDomainRequest {
  id: string;
  status?: DomainStatus;
  verificationRecords?: DNSRecord[];
}

export interface DomainMonitoringConfig {
  checkInterval: number; // in minutes
  alertThresholds: {
    reputationScore: number;
    deliveryRate: number;
    bounceRate: number;
  };
  enabledChecks: {
    dnsRecords: boolean;
    reputation: boolean;
    deliverability: boolean;
  };
}