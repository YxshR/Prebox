import { apiClient } from './api-client';

export interface SecurityMetrics {
  failedLogins: number;
  rateLimitViolations: number;
  suspiciousIps: string[];
  threatAlerts: number;
  blockedRequests: number;
  auditSummary: {
    totalEvents: number;
    authenticationFailures: number;
    suspiciousActivities: number;
    rateLimitExceeded: number;
    topIpAddresses: Array<{ ip: string; count: number }>;
  };
}

export interface ThreatAlert {
  id: string;
  tenantId: string;
  userId?: string;
  threatType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  status: 'ACTIVE' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';
  createdAt: string;
  resolvedAt?: string;
}

export interface AuditLogEntry {
  tenantId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
}

export interface ConsentRecord {
  userId: string;
  tenantId: string;
  consentType: 'marketing' | 'analytics' | 'functional' | 'necessary';
  granted: boolean;
  grantedAt?: string;
  revokedAt?: string;
  ipAddress: string;
  userAgent: string;
  version: string;
}

export class SecurityMonitoringApi {
  /**
   * Get security metrics for dashboard
   */
  static async getSecurityMetrics(hours: number = 24): Promise<SecurityMetrics> {
    const response = await apiClient.get(`/security/metrics?hours=${hours}`);
    return response.data as SecurityMetrics;
  }

  /**
   * Get threat alerts
   */
  static async getThreatAlerts(params: {
    status?: string;
    severity?: string;
    threatType?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    alerts: ThreatAlert[];
    total: number;
    pagination: { limit: number; offset: number };
  }> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value.toString());
      }
    });

    const response = await apiClient.get(`/security/threats?${queryParams}`);
    return response.data as { alerts: ThreatAlert[]; total: number; pagination: { limit: number; offset: number; } };
  }

  /**
   * Get audit logs
   */
  static async getAuditLogs(params: {
    action?: string;
    resourceType?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    logs: AuditLogEntry[];
    total: number;
    pagination: { limit: number; offset: number };
  }> {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value.toString());
      }
    });

    const response = await apiClient.get(`/security/audit-logs?${queryParams}`);
    return response.data as { logs: AuditLogEntry[]; total: number; pagination: { limit: number; offset: number; } };
  }

  /**
   * Request GDPR data export
   */
  static async requestDataExport(targetUserId?: string): Promise<{
    requestId: string;
    message: string;
  }> {
    const response = await apiClient.post('/security/gdpr/export', {
      targetUserId
    });
    return response.data as { requestId: string; message: string; };
  }

  /**
   * Request GDPR data deletion
   */
  static async requestDataDeletion(params: {
    targetUserId?: string;
    retentionPeriod?: number;
  } = {}): Promise<{
    requestId: string;
    message: string;
  }> {
    const response = await apiClient.post('/security/gdpr/delete', params);
    return response.data as { requestId: string; message: string; };
  }

  /**
   * Record user consent
   */
  static async recordConsent(params: {
    consentType: 'marketing' | 'analytics' | 'functional' | 'necessary';
    granted: boolean;
  }): Promise<{ message: string }> {
    const response = await apiClient.post('/security/gdpr/consent', params);
    return response.data as { message: string; };
  }

  /**
   * Get user consent status
   */
  static async getConsentStatus(targetUserId?: string): Promise<{
    consentRecords: ConsentRecord[];
  }> {
    const queryParams = targetUserId ? `?targetUserId=${targetUserId}` : '';
    const response = await apiClient.get(`/security/gdpr/consent${queryParams}`);
    return response.data as { consentRecords: ConsentRecord[]; };
  }

  /**
   * Block IP address (admin only)
   */
  static async blockIpAddress(params: {
    ipAddress: string;
    reason: string;
    durationHours?: number;
  }): Promise<{ message: string }> {
    const response = await apiClient.post('/security/block-ip', params);
    return response.data as { message: string; };
  }

  /**
   * Clean up expired security data (super admin only)
   */
  static async cleanupSecurityData(): Promise<{
    message: string;
    archivedLogs: number;
  }> {
    const response = await apiClient.post('/security/cleanup');
    return response.data as { message: string; archivedLogs: number; };
  }
}

export default SecurityMonitoringApi;