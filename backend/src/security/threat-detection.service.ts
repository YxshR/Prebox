import pool from '../config/database';
import { AuditLogService } from '../compliance/audit-log.service';
import { EncryptionService } from './encryption.service';

export interface ThreatAlert {
  id: string;
  tenantId: string;
  userId?: string;
  threatType: ThreatType;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  status: 'ACTIVE' | 'INVESTIGATING' | 'RESOLVED' | 'FALSE_POSITIVE';
  createdAt: Date;
  resolvedAt?: Date;
}

export type ThreatType = 
  | 'BRUTE_FORCE_ATTACK'
  | 'SUSPICIOUS_LOGIN_PATTERN'
  | 'RATE_LIMIT_ABUSE'
  | 'UNUSUAL_API_USAGE'
  | 'POTENTIAL_ACCOUNT_TAKEOVER'
  | 'SPAM_BEHAVIOR'
  | 'DATA_EXFILTRATION_ATTEMPT'
  | 'PRIVILEGE_ESCALATION'
  | 'MALICIOUS_EMAIL_CONTENT'
  | 'SUSPICIOUS_DOMAIN_ACTIVITY';

export interface SecurityMetrics {
  failedLogins: number;
  rateLimitViolations: number;
  suspiciousIps: string[];
  threatAlerts: number;
  blockedRequests: number;
}

export class ThreatDetectionService {
  private auditLogService: AuditLogService;
  private encryptionService: EncryptionService;
  private alertThresholds: Map<ThreatType, number>;

  constructor() {
    this.auditLogService = new AuditLogService();
    this.encryptionService = new EncryptionService();
    this.initializeThresholds();
  }

  private initializeThresholds(): void {
    this.alertThresholds = new Map([
      ['BRUTE_FORCE_ATTACK', 5], // 5 failed attempts in 15 minutes
      ['RATE_LIMIT_ABUSE', 10], // 10 rate limit violations in 1 hour
      ['UNUSUAL_API_USAGE', 100], // 100 API calls in 1 minute
      ['SUSPICIOUS_LOGIN_PATTERN', 3], // 3 logins from different countries in 1 hour
      ['SPAM_BEHAVIOR', 50], // 50 emails with high spam score
    ]);
  }

  /**
   * Monitor authentication events for threats
   */
  async monitorAuthenticationEvents(
    tenantId: string,
    userId: string | null,
    ipAddress: string,
    userAgent: string,
    success: boolean
  ): Promise<void> {
    if (!success) {
      await this.checkBruteForceAttack(tenantId, userId, ipAddress, userAgent);
    } else if (userId) {
      await this.checkSuspiciousLoginPattern(tenantId, userId, ipAddress, userAgent);
    }
  }

  /**
   * Monitor API usage for threats
   */
  async monitorApiUsage(
    tenantId: string,
    userId: string,
    apiKeyId: string,
    endpoint: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    await this.checkUnusualApiUsage(tenantId, userId, apiKeyId, endpoint, ipAddress, userAgent);
    await this.checkRateLimitAbuse(tenantId, userId, ipAddress, userAgent);
  }

  /**
   * Monitor email sending for threats
   */
  async monitorEmailSending(
    tenantId: string,
    userId: string,
    campaignId: string,
    recipientCount: number,
    content: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    await this.checkSpamBehavior(tenantId, userId, campaignId, recipientCount, content, ipAddress, userAgent);
    await this.checkMaliciousContent(tenantId, userId, campaignId, content, ipAddress, userAgent);
  }

  /**
   * Monitor pricing access for suspicious patterns
   */
  async monitorPricingAccess(
    tenantId: string,
    userId: string,
    endpoint: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    const client = await pool.connect();
    
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Count pricing access requests from this user in the last hour
      const result = await client.query(`
        SELECT COUNT(*) as count FROM audit_logs 
        WHERE action = 'PRICING_ACCESS' 
        AND user_id = $1 
        AND created_at >= $2
      `, [userId, oneHourAgo]);

      const accessCount = parseInt(result.rows[0].count);
      
      // Check for excessive pricing access (potential scraping or tampering attempts)
      if (accessCount > 50) { // More than 50 pricing requests per hour
        await this.createThreatAlert({
          tenantId,
          userId,
          threatType: 'UNUSUAL_API_USAGE',
          severity: accessCount > 100 ? 'HIGH' : 'MEDIUM',
          description: `Excessive pricing access: ${accessCount} requests in 1 hour`,
          ipAddress,
          userAgent,
          details: {
            accessCount,
            endpoint,
            timeWindow: '1 hour',
            suspiciousActivity: 'pricing_scraping_attempt'
          }
        });
      }

      // Check for pricing validation failures (potential tampering)
      const validationFailures = await client.query(`
        SELECT COUNT(*) as count FROM security_events 
        WHERE event_type = 'pricing_tampering_attempt' 
        AND user_id = $1 
        AND created_at >= $2
      `, [userId, oneHourAgo]);

      const failureCount = parseInt(validationFailures.rows[0]?.count || 0);
      
      if (failureCount > 3) { // More than 3 tampering attempts per hour
        await this.createThreatAlert({
          tenantId,
          userId,
          threatType: 'PRIVILEGE_ESCALATION',
          severity: 'CRITICAL',
          description: `Multiple pricing tampering attempts: ${failureCount} in 1 hour`,
          ipAddress,
          userAgent,
          details: {
            tamperingAttempts: failureCount,
            timeWindow: '1 hour',
            suspiciousActivity: 'pricing_manipulation_attempt'
          }
        });

        // Temporarily block user from pricing endpoints
        await this.blockUserPricingAccess(userId, 3600); // 1 hour
      }
    } finally {
      client.release();
    }
  }

  /**
   * Check for brute force attacks
   */
  private async checkBruteForceAttack(
    tenantId: string,
    userId: string | null,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    const client = await pool.connect();
    
    try {
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
      
      // Count failed login attempts from this IP in the last 15 minutes
      const result = await client.query(`
        SELECT COUNT(*) as count FROM audit_logs 
        WHERE action = 'LOGIN_FAILED' 
        AND ip_address = $1 
        AND created_at >= $2
      `, [ipAddress, fifteenMinutesAgo]);

      const failedAttempts = parseInt(result.rows[0].count);
      const threshold = this.alertThresholds.get('BRUTE_FORCE_ATTACK') || 5;

      if (failedAttempts >= threshold) {
        await this.createThreatAlert({
          tenantId,
          userId,
          threatType: 'BRUTE_FORCE_ATTACK',
          severity: failedAttempts > 10 ? 'HIGH' : 'MEDIUM',
          description: `${failedAttempts} failed login attempts from IP ${ipAddress} in 15 minutes`,
          ipAddress,
          userAgent,
          details: {
            failedAttempts,
            timeWindow: '15 minutes',
            threshold
          }
        });

        // Block IP temporarily
        await this.blockIpAddress(ipAddress, 'BRUTE_FORCE_ATTACK', 3600); // 1 hour
      }
    } finally {
      client.release();
    }
  }

  /**
   * Check for suspicious login patterns
   */
  private async checkSuspiciousLoginPattern(
    tenantId: string,
    userId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    const client = await pool.connect();
    
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Get unique IP addresses for this user in the last hour
      const result = await client.query(`
        SELECT DISTINCT ip_address FROM audit_logs 
        WHERE action = 'LOGIN_SUCCESS' 
        AND user_id = $1 
        AND created_at >= $2
      `, [userId, oneHourAgo]);

      const uniqueIps = result.rows.length;
      const threshold = this.alertThresholds.get('SUSPICIOUS_LOGIN_PATTERN') || 3;

      if (uniqueIps >= threshold) {
        // Check if IPs are from different geographical locations (mock implementation)
        const suspiciousLocations = await this.checkGeographicalDistribution(
          result.rows.map(row => row.ip_address)
        );

        if (suspiciousLocations) {
          await this.createThreatAlert({
            tenantId,
            userId,
            threatType: 'SUSPICIOUS_LOGIN_PATTERN',
            severity: 'MEDIUM',
            description: `User logged in from ${uniqueIps} different IP addresses in 1 hour`,
            ipAddress,
            userAgent,
            details: {
              uniqueIps,
              ipAddresses: result.rows.map(row => row.ip_address),
              timeWindow: '1 hour'
            }
          });
        }
      }
    } finally {
      client.release();
    }
  }

  /**
   * Check for unusual API usage
   */
  private async checkUnusualApiUsage(
    tenantId: string,
    userId: string,
    apiKeyId: string,
    endpoint: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    const client = await pool.connect();
    
    try {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      
      // Count API requests from this API key in the last minute
      const result = await client.query(`
        SELECT COUNT(*) as count FROM audit_logs 
        WHERE action = 'API_REQUEST' 
        AND resource_id = $1 
        AND created_at >= $2
      `, [apiKeyId, oneMinuteAgo]);

      const requestCount = parseInt(result.rows[0].count);
      const threshold = this.alertThresholds.get('UNUSUAL_API_USAGE') || 100;

      if (requestCount >= threshold) {
        await this.createThreatAlert({
          tenantId,
          userId,
          threatType: 'UNUSUAL_API_USAGE',
          severity: requestCount > 200 ? 'HIGH' : 'MEDIUM',
          description: `${requestCount} API requests in 1 minute from API key`,
          ipAddress,
          userAgent,
          details: {
            requestCount,
            apiKeyId,
            endpoint,
            timeWindow: '1 minute'
          }
        });

        // Temporarily throttle this API key
        await this.throttleApiKey(apiKeyId, 300); // 5 minutes
      }
    } finally {
      client.release();
    }
  }

  /**
   * Check for rate limit abuse
   */
  private async checkRateLimitAbuse(
    tenantId: string,
    userId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    const client = await pool.connect();
    
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Count rate limit violations from this IP in the last hour
      const result = await client.query(`
        SELECT COUNT(*) as count FROM audit_logs 
        WHERE action = 'SECURITY_RATE_LIMIT_EXCEEDED' 
        AND ip_address = $1 
        AND created_at >= $2
      `, [ipAddress, oneHourAgo]);

      const violations = parseInt(result.rows[0].count);
      const threshold = this.alertThresholds.get('RATE_LIMIT_ABUSE') || 10;

      if (violations >= threshold) {
        await this.createThreatAlert({
          tenantId,
          userId,
          threatType: 'RATE_LIMIT_ABUSE',
          severity: 'MEDIUM',
          description: `${violations} rate limit violations from IP ${ipAddress} in 1 hour`,
          ipAddress,
          userAgent,
          details: {
            violations,
            timeWindow: '1 hour',
            threshold
          }
        });

        // Block IP for longer period
        await this.blockIpAddress(ipAddress, 'RATE_LIMIT_ABUSE', 7200); // 2 hours
      }
    } finally {
      client.release();
    }
  }

  /**
   * Check for spam behavior
   */
  private async checkSpamBehavior(
    tenantId: string,
    userId: string,
    campaignId: string,
    recipientCount: number,
    content: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    // Calculate spam score (mock implementation)
    const spamScore = this.calculateSpamScore(content);
    
    if (spamScore > 0.7) { // High spam probability
      await this.createThreatAlert({
        tenantId,
        userId,
        threatType: 'SPAM_BEHAVIOR',
        severity: spamScore > 0.9 ? 'HIGH' : 'MEDIUM',
        description: `High spam score (${spamScore.toFixed(2)}) detected in email campaign`,
        ipAddress,
        userAgent,
        details: {
          campaignId,
          spamScore,
          recipientCount,
          contentLength: content.length
        }
      });

      // Quarantine the campaign
      await this.quarantineCampaign(campaignId, 'SPAM_CONTENT');
    }
  }

  /**
   * Check for malicious email content
   */
  private async checkMaliciousContent(
    tenantId: string,
    userId: string,
    campaignId: string,
    content: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    // Check for malicious patterns
    const maliciousPatterns = [
      /javascript:/gi,
      /data:text\/html/gi,
      /vbscript:/gi,
      /<script/gi,
      /onclick=/gi,
      /onerror=/gi,
      /onload=/gi
    ];

    const foundPatterns = maliciousPatterns.filter(pattern => pattern.test(content));

    if (foundPatterns.length > 0) {
      await this.createThreatAlert({
        tenantId,
        userId,
        threatType: 'MALICIOUS_EMAIL_CONTENT',
        severity: 'HIGH',
        description: `Malicious content patterns detected in email campaign`,
        ipAddress,
        userAgent,
        details: {
          campaignId,
          patternsFound: foundPatterns.length,
          contentLength: content.length
        }
      });

      // Block the campaign immediately
      await this.quarantineCampaign(campaignId, 'MALICIOUS_CONTENT');
    }
  }

  /**
   * Create a threat alert
   */
  private async createThreatAlert(alert: Omit<ThreatAlert, 'id' | 'status' | 'createdAt'>): Promise<string> {
    const client = await pool.connect();
    
    try {
      const alertId = this.encryptionService.generateSecureToken();
      
      await client.query(`
        INSERT INTO threat_alerts (
          id, tenant_id, user_id, threat_type, severity, description,
          ip_address, user_agent, details, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE', NOW())
      `, [
        alertId,
        alert.tenantId,
        alert.userId,
        alert.threatType,
        alert.severity,
        alert.description,
        alert.ipAddress,
        alert.userAgent,
        JSON.stringify(alert.details)
      ]);

      // Log the security event
      await this.auditLogService.logSecurityEvent(
        alert.tenantId,
        alert.userId,
        'THREAT_DETECTED',
        alert.ipAddress,
        alert.userAgent,
        {
          alertId,
          threatType: alert.threatType,
          severity: alert.severity
        }
      );

      // Send notification to security team (implement based on requirements)
      await this.notifySecurityTeam(alert);

      return alertId;
    } finally {
      client.release();
    }
  }

  /**
   * Block IP address temporarily
   */
  private async blockIpAddress(ipAddress: string, reason: string, durationSeconds: number): Promise<void> {
    const client = await pool.connect();
    
    try {
      const expiresAt = new Date(Date.now() + durationSeconds * 1000);
      
      await client.query(`
        INSERT INTO blocked_ips (ip_address, reason, expires_at, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (ip_address) DO UPDATE SET
          reason = $2, expires_at = $3, created_at = NOW()
      `, [ipAddress, reason, expiresAt]);
    } finally {
      client.release();
    }
  }

  /**
   * Check if IP address is blocked
   */
  async isIpBlocked(ipAddress: string): Promise<boolean> {
    const client = await pool.connect();
    
    try {
      const result = await client.query(`
        SELECT id FROM blocked_ips 
        WHERE ip_address = $1 AND expires_at > NOW()
      `, [ipAddress]);

      return result.rows.length > 0;
    } finally {
      client.release();
    }
  }

  /**
   * Throttle API key
   */
  private async throttleApiKey(apiKeyId: string, durationSeconds: number): Promise<void> {
    const client = await pool.connect();
    
    try {
      const expiresAt = new Date(Date.now() + durationSeconds * 1000);
      
      await client.query(`
        INSERT INTO throttled_api_keys (api_key_id, expires_at, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (api_key_id) DO UPDATE SET
          expires_at = $2, created_at = NOW()
      `, [apiKeyId, expiresAt]);
    } finally {
      client.release();
    }
  }

  /**
   * Block user from pricing access temporarily
   */
  private async blockUserPricingAccess(userId: string, durationSeconds: number): Promise<void> {
    const client = await pool.connect();
    
    try {
      const expiresAt = new Date(Date.now() + durationSeconds * 1000);
      
      await client.query(`
        INSERT INTO blocked_user_pricing (user_id, expires_at, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          expires_at = $2, created_at = NOW()
      `, [userId, expiresAt]);
    } finally {
      client.release();
    }
  }

  /**
   * Quarantine campaign
   */
  private async quarantineCampaign(campaignId: string, reason: string): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query(`
        UPDATE campaigns SET 
          status = 'quarantined',
          quarantine_reason = $2,
          quarantined_at = NOW()
        WHERE id = $1
      `, [campaignId, reason]);
    } finally {
      client.release();
    }
  }

  /**
   * Get security metrics for dashboard
   */
  async getSecurityMetrics(tenantId: string, hours: number = 24): Promise<SecurityMetrics> {
    const client = await pool.connect();
    
    try {
      const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

      // Failed logins
      const failedLoginsResult = await client.query(`
        SELECT COUNT(*) as count FROM audit_logs 
        WHERE tenant_id = $1 AND action = 'LOGIN_FAILED' AND created_at >= $2
      `, [tenantId, startTime]);

      // Rate limit violations
      const rateLimitResult = await client.query(`
        SELECT COUNT(*) as count FROM audit_logs 
        WHERE tenant_id = $1 AND action = 'SECURITY_RATE_LIMIT_EXCEEDED' AND created_at >= $2
      `, [tenantId, startTime]);

      // Suspicious IPs
      const suspiciousIpsResult = await client.query(`
        SELECT DISTINCT ip_address FROM threat_alerts 
        WHERE tenant_id = $1 AND created_at >= $2 AND status = 'ACTIVE'
      `, [tenantId, startTime]);

      // Threat alerts
      const threatAlertsResult = await client.query(`
        SELECT COUNT(*) as count FROM threat_alerts 
        WHERE tenant_id = $1 AND created_at >= $2 AND status = 'ACTIVE'
      `, [tenantId, startTime]);

      // Blocked requests (approximate)
      const blockedRequestsResult = await client.query(`
        SELECT COUNT(*) as count FROM audit_logs 
        WHERE tenant_id = $1 AND action LIKE '%BLOCKED%' AND created_at >= $2
      `, [tenantId, startTime]);

      return {
        failedLogins: parseInt(failedLoginsResult.rows[0].count),
        rateLimitViolations: parseInt(rateLimitResult.rows[0].count),
        suspiciousIps: suspiciousIpsResult.rows.map(row => row.ip_address),
        threatAlerts: parseInt(threatAlertsResult.rows[0].count),
        blockedRequests: parseInt(blockedRequestsResult.rows[0].count)
      };
    } finally {
      client.release();
    }
  }

  /**
   * Calculate spam score (mock implementation)
   */
  private calculateSpamScore(content: string): number {
    let score = 0;
    
    // Check for spam indicators
    const spamWords = ['free', 'urgent', 'limited time', 'act now', 'guaranteed', 'no risk'];
    const spamWordCount = spamWords.filter(word => 
      content.toLowerCase().includes(word)
    ).length;
    
    score += spamWordCount * 0.1;
    
    // Check for excessive capitalization
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsRatio > 0.3) score += 0.2;
    
    // Check for excessive exclamation marks
    const exclamationCount = (content.match(/!/g) || []).length;
    if (exclamationCount > 5) score += 0.1;
    
    return Math.min(score, 1.0);
  }

  /**
   * Check geographical distribution (mock implementation)
   */
  private async checkGeographicalDistribution(ipAddresses: string[]): Promise<boolean> {
    // In production, use a GeoIP service
    // For now, return true if more than 2 different IP ranges
    const uniqueRanges = new Set(
      ipAddresses.map(ip => ip.split('.').slice(0, 2).join('.'))
    );
    
    return uniqueRanges.size > 2;
  }

  /**
   * Notify security team (mock implementation)
   */
  private async notifySecurityTeam(alert: Omit<ThreatAlert, 'id' | 'status' | 'createdAt'>): Promise<void> {
    // In production, send notifications via email, Slack, PagerDuty, etc.
    console.log(`🚨 Security Alert: ${alert.threatType} - ${alert.severity} - ${alert.description}`);
  }

  /**
   * Clean up expired blocks and throttles
   */
  async cleanupExpiredRestrictions(): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('DELETE FROM blocked_ips WHERE expires_at <= NOW()');
      await client.query('DELETE FROM throttled_api_keys WHERE expires_at <= NOW()');
    } finally {
      client.release();
    }
  }
}