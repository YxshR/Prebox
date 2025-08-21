import pool from '../config/database';
import { EncryptionService } from '../security/encryption.service';

export interface AuditLogEntry {
  tenantId: string;
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  details?: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp?: Date;
}

export interface AuditLogFilter {
  tenantId?: string;
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  limit?: number;
  offset?: number;
}

export class AuditLogService {
  private encryptionService: EncryptionService;

  constructor() {
    this.encryptionService = new EncryptionService();
  }

  /**
   * Log an audit event
   */
  async log(entry: AuditLogEntry): Promise<string> {
    const client = await pool.connect();
    
    try {
      const logId = this.encryptionService.generateSecureToken();
      const timestamp = entry.timestamp || new Date();

      // Mask sensitive data in details
      const maskedDetails = entry.details ? 
        this.encryptionService.maskSensitiveData(entry.details) : null;

      await client.query(`
        INSERT INTO audit_logs (
          id, tenant_id, user_id, action, resource_type, resource_id,
          details, ip_address, user_agent, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        logId,
        entry.tenantId,
        entry.userId,
        entry.action,
        entry.resourceType,
        entry.resourceId,
        maskedDetails ? JSON.stringify(maskedDetails) : null,
        entry.ipAddress,
        entry.userAgent,
        timestamp
      ]);

      return logId;
    } catch (error) {
      console.error('Failed to write audit log:', error);
      // Don't throw error to avoid breaking main functionality
      return '';
    } finally {
      client.release();
    }
  }

  /**
   * Get audit logs with filtering
   */
  async getLogs(filter: AuditLogFilter): Promise<{
    logs: AuditLogEntry[];
    total: number;
  }> {
    const client = await pool.connect();
    
    try {
      let whereClause = 'WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      // Build WHERE clause
      if (filter.tenantId) {
        whereClause += ` AND tenant_id = $${paramIndex}`;
        params.push(filter.tenantId);
        paramIndex++;
      }

      if (filter.userId) {
        whereClause += ` AND user_id = $${paramIndex}`;
        params.push(filter.userId);
        paramIndex++;
      }

      if (filter.action) {
        whereClause += ` AND action = $${paramIndex}`;
        params.push(filter.action);
        paramIndex++;
      }

      if (filter.resourceType) {
        whereClause += ` AND resource_type = $${paramIndex}`;
        params.push(filter.resourceType);
        paramIndex++;
      }

      if (filter.resourceId) {
        whereClause += ` AND resource_id = $${paramIndex}`;
        params.push(filter.resourceId);
        paramIndex++;
      }

      if (filter.startDate) {
        whereClause += ` AND created_at >= $${paramIndex}`;
        params.push(filter.startDate);
        paramIndex++;
      }

      if (filter.endDate) {
        whereClause += ` AND created_at <= $${paramIndex}`;
        params.push(filter.endDate);
        paramIndex++;
      }

      if (filter.ipAddress) {
        whereClause += ` AND ip_address = $${paramIndex}`;
        params.push(filter.ipAddress);
        paramIndex++;
      }

      // Get total count
      const countResult = await client.query(`
        SELECT COUNT(*) as total FROM audit_logs ${whereClause}
      `, params);
      const total = parseInt(countResult.rows[0].total);

      // Get logs with pagination
      const limit = filter.limit || 100;
      const offset = filter.offset || 0;

      const logsResult = await client.query(`
        SELECT 
          tenant_id, user_id, action, resource_type, resource_id,
          details, ip_address, user_agent, created_at
        FROM audit_logs 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `, [...params, limit, offset]);

      const logs = logsResult.rows.map(row => ({
        tenantId: row.tenant_id,
        userId: row.user_id,
        action: row.action,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        details: row.details ? JSON.parse(row.details) : null,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        timestamp: row.created_at
      }));

      return { logs, total };
    } finally {
      client.release();
    }
  }

  /**
   * Log authentication events
   */
  async logAuth(
    tenantId: string,
    userId: string | null,
    action: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGOUT' | 'PASSWORD_RESET' | 'ACCOUNT_LOCKED',
    ipAddress: string,
    userAgent: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      tenantId,
      userId,
      action,
      resourceType: 'authentication',
      resourceId: userId || 'anonymous',
      details,
      ipAddress,
      userAgent
    });
  }

  /**
   * Log data access events
   */
  async logDataAccess(
    tenantId: string,
    userId: string,
    action: 'READ' | 'CREATE' | 'UPDATE' | 'DELETE',
    resourceType: string,
    resourceId: string,
    ipAddress: string,
    userAgent: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      tenantId,
      userId,
      action: `DATA_${action.toUpperCase()}`,
      resourceType,
      resourceId,
      details,
      ipAddress,
      userAgent
    });
  }

  /**
   * Log email events
   */
  async logEmailEvent(
    tenantId: string,
    userId: string,
    action: 'EMAIL_SENT' | 'EMAIL_DELIVERED' | 'EMAIL_BOUNCED' | 'EMAIL_COMPLAINED' | 'EMAIL_OPENED' | 'EMAIL_CLICKED',
    campaignId: string,
    recipientEmail: string,
    ipAddress: string,
    userAgent: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      tenantId,
      userId,
      action,
      resourceType: 'email',
      resourceId: campaignId,
      details: {
        ...details,
        recipientEmail: this.encryptionService.maskSensitiveData({ email: recipientEmail }).email
      },
      ipAddress,
      userAgent
    });
  }

  /**
   * Log billing events
   */
  async logBillingEvent(
    tenantId: string,
    userId: string,
    action: 'PAYMENT_SUCCESS' | 'PAYMENT_FAILED' | 'SUBSCRIPTION_CREATED' | 'SUBSCRIPTION_CANCELLED' | 'REFUND_ISSUED',
    transactionId: string,
    ipAddress: string,
    userAgent: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      tenantId,
      userId,
      action,
      resourceType: 'billing',
      resourceId: transactionId,
      details,
      ipAddress,
      userAgent
    });
  }

  /**
   * Log API usage events
   */
  async logApiUsage(
    tenantId: string,
    userId: string,
    apiKeyId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTime: number,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    await this.log({
      tenantId,
      userId,
      action: 'API_REQUEST',
      resourceType: 'api',
      resourceId: apiKeyId,
      details: {
        endpoint,
        method,
        statusCode,
        responseTime
      },
      ipAddress,
      userAgent
    });
  }

  /**
   * Log security events
   */
  async logSecurityEvent(
    tenantId: string,
    userId: string | null,
    action: 'SUSPICIOUS_ACTIVITY' | 'RATE_LIMIT_EXCEEDED' | 'INVALID_TOKEN' | 'BRUTE_FORCE_ATTEMPT' | 'ACCOUNT_COMPROMISE' | 'THREAT_DETECTED',
    ipAddress: string,
    userAgent: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      tenantId,
      userId,
      action: `SECURITY_${action}`,
      resourceType: 'security',
      resourceId: ipAddress,
      details,
      ipAddress,
      userAgent
    });
  }

  /**
   * Log admin actions
   */
  async logAdminAction(
    tenantId: string,
    adminUserId: string,
    action: string,
    targetResourceType: string,
    targetResourceId: string,
    ipAddress: string,
    userAgent: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.log({
      tenantId,
      userId: adminUserId,
      action: `ADMIN_${action.toUpperCase()}`,
      resourceType: targetResourceType,
      resourceId: targetResourceId,
      details,
      ipAddress,
      userAgent
    });
  }

  /**
   * Get security summary for a tenant
   */
  async getSecuritySummary(tenantId: string, days: number = 7): Promise<{
    totalEvents: number;
    authenticationFailures: number;
    suspiciousActivities: number;
    rateLimitExceeded: number;
    topIpAddresses: Array<{ ip: string; count: number }>;
  }> {
    const client = await pool.connect();
    
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Total security events
      const totalResult = await client.query(`
        SELECT COUNT(*) as total FROM audit_logs 
        WHERE tenant_id = $1 AND action LIKE 'SECURITY_%' AND created_at >= $2
      `, [tenantId, startDate]);

      // Authentication failures
      const authFailuresResult = await client.query(`
        SELECT COUNT(*) as count FROM audit_logs 
        WHERE tenant_id = $1 AND action = 'LOGIN_FAILED' AND created_at >= $2
      `, [tenantId, startDate]);

      // Suspicious activities
      const suspiciousResult = await client.query(`
        SELECT COUNT(*) as count FROM audit_logs 
        WHERE tenant_id = $1 AND action = 'SECURITY_SUSPICIOUS_ACTIVITY' AND created_at >= $2
      `, [tenantId, startDate]);

      // Rate limit exceeded
      const rateLimitResult = await client.query(`
        SELECT COUNT(*) as count FROM audit_logs 
        WHERE tenant_id = $1 AND action = 'SECURITY_RATE_LIMIT_EXCEEDED' AND created_at >= $2
      `, [tenantId, startDate]);

      // Top IP addresses
      const topIpsResult = await client.query(`
        SELECT ip_address as ip, COUNT(*) as count FROM audit_logs 
        WHERE tenant_id = $1 AND created_at >= $2
        GROUP BY ip_address 
        ORDER BY count DESC 
        LIMIT 10
      `, [tenantId, startDate]);

      return {
        totalEvents: parseInt(totalResult.rows[0].total),
        authenticationFailures: parseInt(authFailuresResult.rows[0].count),
        suspiciousActivities: parseInt(suspiciousResult.rows[0].count),
        rateLimitExceeded: parseInt(rateLimitResult.rows[0].count),
        topIpAddresses: topIpsResult.rows
      };
    } finally {
      client.release();
    }
  }

  /**
   * Archive old audit logs (for compliance and performance)
   */
  async archiveOldLogs(retentionDays: number = 2555): Promise<number> { // 7 years default
    const client = await pool.connect();
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // In production, move to archive storage before deletion
      const result = await client.query(`
        DELETE FROM audit_logs WHERE created_at < $1
      `, [cutoffDate]);

      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }
}