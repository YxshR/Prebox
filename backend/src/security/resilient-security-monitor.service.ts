import { ThreatDetectionService } from './threat-detection.service';
import { AuditLogService } from '../compliance/audit-log.service';
import { FallbackLoggerService } from './fallback-logger.service';
import { MonitoringService } from '../monitoring/monitoring.service';
import { AlertingService } from '../monitoring/alerting.service';
import pool from '../config/database';
import redisClient from '../config/redis';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

export interface SecurityMonitoringHealth {
  threatDetection: boolean;
  auditLogging: boolean;
  database: boolean;
  redis: boolean;
  alerting: boolean;
  overall: boolean;
  lastCheck: Date;
  errors: string[];
}

export class ResilientSecurityMonitorService {
  private threatDetectionService: ThreatDetectionService;
  private auditLogService: AuditLogService;
  private fallbackLogger: FallbackLoggerService;
  private monitoringService?: MonitoringService;
  private alertingService?: AlertingService;
  private logger: winston.Logger;
  private isDemoMode: boolean;
  
  private healthStatus: SecurityMonitoringHealth;
  private healthCheckInterval: NodeJS.Timeout;
  private recoveryAttempts: Map<string, number> = new Map();
  private maxRecoveryAttempts = 3;
  private recoveryDelay = 5000; // 5 seconds
  private securityMonitoringRuleId?: string;

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.isDemoMode = process.env.DEMO_MODE === 'true';
    this.fallbackLogger = new FallbackLoggerService();
    this.threatDetectionService = new ThreatDetectionService();
    this.auditLogService = new AuditLogService();
    
    // Initialize health status based on demo mode
    this.healthStatus = {
      threatDetection: this.isDemoMode, // In demo mode, assume services are healthy
      auditLogging: this.isDemoMode,
      database: this.isDemoMode,
      redis: this.isDemoMode,
      alerting: this.isDemoMode,
      overall: this.isDemoMode,
      lastCheck: new Date(),
      errors: []
    };

    this.initializeServices();
    this.startHealthChecks();
  }

  private async initializeServices(): Promise<void> {
    try {
      // In demo mode, skip database-dependent service initialization
      if (this.isDemoMode) {
        this.logger.info('Security monitoring running in demo mode - database services disabled');
        return;
      }

      // Initialize monitoring and alerting services if available
      if (redisClient) {
        this.monitoringService = new MonitoringService(pool, redisClient, this.logger);
        this.alertingService = new AlertingService(pool, redisClient, this.logger);
      }
    } catch (error) {
      await this.fallbackLogger.logMonitoringFailure(
        'service-initialization',
        error instanceof Error ? error : new Error('Unknown initialization error'),
        'medium'
      );
    }
  }

  private startHealthChecks(): void {
    // Check health every 30 seconds
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck().catch(error => {
        this.logger.error('Health check failed:', error);
      });
    }, 30000);

    // Initial health check
    this.performHealthCheck().catch(error => {
      this.logger.error('Initial health check failed:', error);
    });
  }

  private async performHealthCheck(): Promise<void> {
    const errors: string[] = [];
    const startTime = Date.now();

    try {
      // In demo mode, all services are considered healthy
      if (this.isDemoMode) {
        this.healthStatus = {
          threatDetection: true,
          auditLogging: true,
          database: true,
          redis: true,
          alerting: true,
          overall: true,
          lastCheck: new Date(),
          errors: []
        };
        return;
      }

      // Check database connection
      const dbHealthy = await this.checkDatabaseHealth();
      this.healthStatus.database = dbHealthy;
      if (!dbHealthy) errors.push('Database connection failed');

      // Check Redis connection
      const redisHealthy = await this.checkRedisHealth();
      this.healthStatus.redis = redisHealthy;
      if (!redisHealthy) errors.push('Redis connection failed');

      // Check audit logging
      const auditHealthy = await this.checkAuditLoggingHealth();
      this.healthStatus.auditLogging = auditHealthy;
      if (!auditHealthy) errors.push('Audit logging failed');

      // Check threat detection
      const threatHealthy = await this.checkThreatDetectionHealth();
      this.healthStatus.threatDetection = threatHealthy;
      if (!threatHealthy) errors.push('Threat detection failed');

      // Check alerting system
      const alertingHealthy = await this.checkAlertingHealth();
      this.healthStatus.alerting = alertingHealthy;
      if (!alertingHealthy) errors.push('Alerting system failed');

      // Overall health
      this.healthStatus.overall = dbHealthy && auditHealthy && threatHealthy;
      this.healthStatus.errors = errors;
      this.healthStatus.lastCheck = new Date();

      // Check if graceful degradation should be enabled
      const shouldDegrade = this.shouldEnterGracefulDegradation();
      const currentlyDegraded = this.healthCheckInterval && 
        (this.healthCheckInterval as any)._idleTimeout === 120000;

      if (shouldDegrade && !currentlyDegraded) {
        await this.enableGracefulDegradation();
      } else if (!shouldDegrade && currentlyDegraded) {
        await this.disableGracefulDegradation();
      }

      // Trigger recovery if needed
      if (!this.healthStatus.overall) {
        await this.triggerRecovery(errors);
      }

      // Log health status
      if (errors.length > 0) {
        await this.fallbackLogger.logSecurityEvent({
          timestamp: new Date().toISOString(),
          level: 'warn',
          service: 'security-monitor',
          event: 'health_check_issues',
          data: {
            healthStatus: this.healthStatus,
            checkDuration: Date.now() - startTime
          }
        });
      }

    } catch (error) {
      await this.fallbackLogger.logMonitoringFailure(
        'health-check',
        error instanceof Error ? error : new Error('Unknown health check error'),
        'high'
      );
    }
  }

  private async checkDatabaseHealth(): Promise<boolean> {
    try {
      // In demo mode, skip actual database check
      if (this.isDemoMode) {
        return true;
      }

      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch (error) {
      await this.fallbackLogger.logDatabaseFailure(
        'health-check',
        error instanceof Error ? error : new Error('Database health check failed'),
        this.recoveryAttempts.get('database') || 0
      );
      return false;
    }
  }

  private async checkRedisHealth(): Promise<boolean> {
    try {
      if (!redisClient) return false;
      await redisClient.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkAuditLoggingHealth(): Promise<boolean> {
    try {
      // In demo mode, skip actual audit logging check
      if (this.isDemoMode) {
        return true;
      }

      // Try to write a test audit log
      await this.auditLogService.log({
        tenantId: uuidv4(), // Generate a proper UUID for health check
        action: 'HEALTH_CHECK',
        resourceType: 'system',
        resourceId: 'audit-logging',
        ipAddress: '127.0.0.1',
        userAgent: 'health-check'
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkThreatDetectionHealth(): Promise<boolean> {
    try {
      // In demo mode, skip actual threat detection check
      if (this.isDemoMode) {
        return true;
      }

      // Check if threat detection service can access database
      const metrics = await this.threatDetectionService.getSecurityMetrics(uuidv4(), 1);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async checkAlertingHealth(): Promise<boolean> {
    try {
      if (!this.alertingService) return false;
      const rules = await this.alertingService.getAlertRules();
      return true;
    } catch (error) {
      return false;
    }
  }

  private async triggerRecovery(errors: string[]): Promise<void> {
    for (const error of errors) {
      const component = this.extractComponentFromError(error);
      const attempts = this.recoveryAttempts.get(component) || 0;

      if (attempts < this.maxRecoveryAttempts) {
        this.recoveryAttempts.set(component, attempts + 1);
        
        await this.fallbackLogger.logSecurityEvent({
          timestamp: new Date().toISOString(),
          level: 'info',
          service: 'security-monitor',
          event: 'recovery_attempt',
          data: {
            component,
            attempt: attempts + 1,
            maxAttempts: this.maxRecoveryAttempts
          }
        });

        // Send alert for recovery attempt
        await this.sendSecurityMonitoringAlert(
          'recovery_attempt',
          'medium',
          `Attempting recovery for ${component} (attempt ${attempts + 1}/${this.maxRecoveryAttempts})`,
          { component, attempt: attempts + 1, error }
        );

        // Wait before recovery attempt
        await new Promise(resolve => setTimeout(resolve, this.recoveryDelay));

        try {
          await this.attemptRecovery(component);
          
          // Reset recovery attempts on success
          this.recoveryAttempts.delete(component);
          
          await this.fallbackLogger.logSystemRecovery(
            component,
            this.recoveryDelay,
            'automatic-recovery'
          );

          // Send success alert
          await this.sendSecurityMonitoringAlert(
            'recovery_success',
            'low',
            `Successfully recovered ${component} after ${attempts + 1} attempts`,
            { component, attempts: attempts + 1, downtime: this.recoveryDelay }
          );
        } catch (recoveryError) {
          await this.fallbackLogger.logMonitoringFailure(
            `recovery-${component}`,
            recoveryError instanceof Error ? recoveryError : new Error('Recovery failed'),
            'high'
          );

          // Send failure alert
          await this.sendSecurityMonitoringAlert(
            'recovery_failed',
            'high',
            `Failed to recover ${component} after ${attempts + 1} attempts: ${recoveryError instanceof Error ? recoveryError.message : 'Unknown error'}`,
            { component, attempts: attempts + 1, error: recoveryError instanceof Error ? recoveryError.message : 'Unknown error' }
          );

          // If max attempts reached, send critical alert
          if (attempts + 1 >= this.maxRecoveryAttempts) {
            await this.sendSecurityMonitoringAlert(
              'recovery_exhausted',
              'critical',
              `Security monitoring component ${component} has failed permanently after ${this.maxRecoveryAttempts} recovery attempts`,
              { component, maxAttempts: this.maxRecoveryAttempts, requiresManualIntervention: true }
            );
          }
        }
      } else {
        // Max attempts reached, log critical failure
        await this.fallbackLogger.logMonitoringFailure(
          `recovery-exhausted-${component}`,
          new Error(`Max recovery attempts (${this.maxRecoveryAttempts}) reached for ${component}`),
          'critical'
        );
      }
    }
  }

  private extractComponentFromError(error: string): string {
    if (error.includes('Database')) return 'database';
    if (error.includes('Redis')) return 'redis';
    if (error.includes('Audit')) return 'audit';
    if (error.includes('Threat')) return 'threat-detection';
    if (error.includes('Alerting')) return 'alerting';
    return 'unknown';
  }

  private async attemptRecovery(component: string): Promise<void> {
    switch (component) {
      case 'database':
        await this.recoverDatabase();
        break;
      case 'redis':
        await this.recoverRedis();
        break;
      case 'audit':
        await this.recoverAuditLogging();
        break;
      case 'threat-detection':
        await this.recoverThreatDetection();
        break;
      case 'alerting':
        await this.recoverAlerting();
        break;
      default:
        throw new Error(`Unknown component: ${component}`);
    }
  }

  private async recoverDatabase(): Promise<void> {
    // Try to reconnect to database
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
  }

  private async recoverRedis(): Promise<void> {
    // Try to reconnect to Redis
    if (redisClient) {
      await redisClient.ping();
    }
  }

  private async recoverAuditLogging(): Promise<void> {
    // Reinitialize audit log service
    this.auditLogService = new AuditLogService();
    
    // Test with a recovery log entry
    await this.auditLogService.log({
      tenantId: 'recovery',
      action: 'AUDIT_RECOVERY',
      resourceType: 'system',
      resourceId: 'audit-logging',
      ipAddress: '127.0.0.1',
      userAgent: 'recovery-system'
    });
  }

  private async recoverThreatDetection(): Promise<void> {
    // Reinitialize threat detection service
    this.threatDetectionService = new ThreatDetectionService();
    
    // Clean up expired restrictions
    await this.threatDetectionService.cleanupExpiredRestrictions();
  }

  private async recoverAlerting(): Promise<void> {
    // Reinitialize alerting service
    if (redisClient) {
      this.alertingService = new AlertingService(pool, redisClient, this.logger);
    }
  }

  /**
   * Monitor authentication events with error recovery
   */
  async monitorAuthenticationEvents(
    tenantId: string,
    userId: string | null,
    ipAddress: string,
    userAgent: string,
    success: boolean
  ): Promise<void> {
    try {
      // In demo mode, only use fallback logging
      if (this.isDemoMode) {
        await this.fallbackLogger.logSecurityEvent({
          timestamp: new Date().toISOString(),
          level: success ? 'info' : 'warn',
          service: 'authentication',
          event: success ? 'login_success' : 'login_failed',
          data: { tenantId, userId, ipAddress, userAgent }
        });
        return;
      }

      await this.threatDetectionService.monitorAuthenticationEvents(
        tenantId, userId, ipAddress, userAgent, success
      );
    } catch (error) {
      await this.fallbackLogger.logThreatDetectionFailure(
        'authentication-monitoring',
        error instanceof Error ? error : new Error('Authentication monitoring failed'),
        { tenantId, userId, ipAddress, success }
      );
      
      // Continue with fallback logging
      await this.fallbackLogger.logSecurityEvent({
        timestamp: new Date().toISOString(),
        level: success ? 'info' : 'warn',
        service: 'authentication',
        event: success ? 'login_success' : 'login_failed',
        data: { tenantId, userId, ipAddress, userAgent }
      });
    }
  }

  /**
   * Monitor API usage with error recovery
   */
  async monitorApiUsage(
    tenantId: string,
    userId: string,
    apiKeyId: string,
    endpoint: string,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    try {
      // In demo mode, only use fallback logging
      if (this.isDemoMode) {
        await this.fallbackLogger.logSecurityEvent({
          timestamp: new Date().toISOString(),
          level: 'info',
          service: 'api',
          event: 'api_request',
          data: { tenantId, userId, apiKeyId, endpoint, ipAddress, userAgent }
        });
        return;
      }

      await this.threatDetectionService.monitorApiUsage(
        tenantId, userId, apiKeyId, endpoint, ipAddress, userAgent
      );
    } catch (error) {
      await this.fallbackLogger.logThreatDetectionFailure(
        'api-monitoring',
        error instanceof Error ? error : new Error('API monitoring failed'),
        { tenantId, userId, apiKeyId, endpoint }
      );
      
      // Continue with fallback logging
      await this.fallbackLogger.logSecurityEvent({
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'api',
        event: 'api_request',
        data: { tenantId, userId, apiKeyId, endpoint, ipAddress, userAgent }
      });
    }
  }

  /**
   * Get health status
   */
  getHealthStatus(): SecurityMonitoringHealth {
    return { ...this.healthStatus };
  }

  /**
   * Get fallback logs
   */
  async getFallbackLogs(limit: number = 100): Promise<any[]> {
    return await this.fallbackLogger.getRecentLogs(limit);
  }

  /**
   * Manual recovery trigger
   */
  async triggerManualRecovery(): Promise<void> {
    this.recoveryAttempts.clear();
    await this.performHealthCheck();
  }

  /**
   * Ensure security monitoring alert rule exists
   */
  private async ensureSecurityMonitoringRule(): Promise<string> {
    if (this.securityMonitoringRuleId) {
      return this.securityMonitoringRuleId;
    }

    if (this.alertingService) {
      try {
        // Create a security monitoring alert rule
        const rule = await this.alertingService.createAlertRule({
          name: 'Security Monitoring System',
          description: 'Monitors security system health and issues',
          metric: 'security_health',
          threshold: 0,
          operator: 'less_than',
          severity: 'medium',
          enabled: true,
          metadata: {
            component: 'security-monitoring',
            type: 'system-health'
          }
        });
        this.securityMonitoringRuleId = rule.id;
        return rule.id;
      } catch (error) {
        // If rule creation fails, generate a UUID as fallback
        this.securityMonitoringRuleId = uuidv4();
        return this.securityMonitoringRuleId;
      }
    }

    // Generate UUID if no alerting service
    this.securityMonitoringRuleId = uuidv4();
    return this.securityMonitoringRuleId;
  }

  /**
   * Send security monitoring system alerts
   */
  private async sendSecurityMonitoringAlert(
    alertType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      // Temporarily disable alerting service to prevent database errors
      // TODO: Fix alert rule creation and database schema issues
      if (false && this.alertingService) {
        const ruleId = await this.ensureSecurityMonitoringRule();
        await this.alertingService.createAlert({
          ruleId,
          message: `Security Monitoring: ${message}`,
          severity,
          timestamp: new Date(),
          resolved: false,
          metadata: {
            alertType,
            component: 'security-monitoring',
            ...metadata
          }
        });
      } else {
        // Fallback to direct notification methods
        await this.sendFallbackAlert(alertType, severity, message, metadata);
      }
    } catch (error) {
      // If alerting fails, log to fallback system
      await this.fallbackLogger.logAlertDeliveryFailure(
        `security-monitoring-${alertType}`,
        'alerting-service',
        error instanceof Error ? error : new Error('Alert delivery failed'),
        0
      );
      
      // Try fallback alert methods
      await this.sendFallbackAlert(alertType, severity, message, metadata);
    }
  }

  /**
   * Send alerts using fallback methods when main alerting system fails
   */
  private async sendFallbackAlert(
    alertType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    metadata: Record<string, any>
  ): Promise<void> {
    try {
      // Log to fallback logger
      await this.fallbackLogger.logSecurityEvent({
        timestamp: new Date().toISOString(),
        level: severity === 'critical' ? 'critical' : severity === 'high' ? 'error' : 'warn',
        service: 'security-monitoring-alert',
        event: alertType,
        data: {
          message,
          severity,
          ...metadata
        }
      });

      // Send console alert for critical issues
      if (severity === 'critical') {
        console.error(`🚨 CRITICAL SECURITY MONITORING ALERT: ${message}`);
        console.error('Metadata:', JSON.stringify(metadata, null, 2));
      }

      // Try to send email alert if configured
      await this.sendEmergencyEmailAlert(severity, message, metadata);

    } catch (error) {
      // Last resort: console logging
      console.error('All alert methods failed:', error);
      console.error('Original alert:', { alertType, severity, message, metadata });
    }
  }

  /**
   * Send emergency email alerts for critical security monitoring failures
   */
  private async sendEmergencyEmailAlert(
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    metadata: Record<string, any>
  ): Promise<void> {
    // Only send email for high and critical alerts to avoid spam
    if (severity !== 'high' && severity !== 'critical') {
      return;
    }

    try {
      const nodemailer = require('nodemailer');
      
      const transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      const alertEmail = process.env.SECURITY_ALERT_EMAIL || process.env.ADMIN_EMAIL;
      
      if (alertEmail) {
        await transporter.sendMail({
          from: process.env.ALERT_FROM_EMAIL || 'security@bulkemail.com',
          to: alertEmail,
          subject: `[${severity.toUpperCase()}] Security Monitoring System Alert`,
          html: `
            <h2>Security Monitoring System Alert</h2>
            <p><strong>Severity:</strong> ${severity.toUpperCase()}</p>
            <p><strong>Message:</strong> ${message}</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            <h3>Details:</h3>
            <pre>${JSON.stringify(metadata, null, 2)}</pre>
            <hr>
            <p><em>This alert was sent by the security monitoring fallback system.</em></p>
          `
        });
      }
    } catch (error) {
      // Email failed, but don't throw - we've already logged the original issue
      console.error('Emergency email alert failed:', error);
    }
  }

  /**
   * Enable graceful degradation mode
   */
  async enableGracefulDegradation(): Promise<void> {
    await this.fallbackLogger.logSecurityEvent({
      timestamp: new Date().toISOString(),
      level: 'warn',
      service: 'security-monitor',
      event: 'graceful_degradation_enabled',
      data: {
        reason: 'Multiple component failures detected',
        healthStatus: this.healthStatus
      }
    });

    // Reduce health check frequency to avoid overwhelming failed systems
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = setInterval(() => {
        this.performHealthCheck().catch(error => {
          this.logger.error('Health check failed in degraded mode:', error);
        });
      }, 120000); // Check every 2 minutes instead of 30 seconds
    }

    // Send degradation alert
    await this.sendSecurityMonitoringAlert(
      'graceful_degradation',
      'high',
      'Security monitoring system has entered graceful degradation mode due to multiple component failures',
      {
        healthStatus: this.healthStatus,
        reducedFunctionality: true,
        fallbackLoggingActive: true
      }
    );
  }

  /**
   * Disable graceful degradation mode
   */
  async disableGracefulDegradation(): Promise<void> {
    await this.fallbackLogger.logSecurityEvent({
      timestamp: new Date().toISOString(),
      level: 'info',
      service: 'security-monitor',
      event: 'graceful_degradation_disabled',
      data: {
        reason: 'System components recovered',
        healthStatus: this.healthStatus
      }
    });

    // Restore normal health check frequency
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = setInterval(() => {
        this.performHealthCheck().catch(error => {
          this.logger.error('Health check failed:', error);
        });
      }, 30000); // Back to 30 seconds
    }

    // Send recovery alert
    await this.sendSecurityMonitoringAlert(
      'degradation_recovery',
      'low',
      'Security monitoring system has recovered from graceful degradation mode',
      {
        healthStatus: this.healthStatus,
        fullFunctionalityRestored: true
      }
    );
  }

  /**
   * Check if system should enter graceful degradation
   */
  private shouldEnterGracefulDegradation(): boolean {
    const failedComponents = this.healthStatus.errors.length;
    const criticalComponentsFailed = !this.healthStatus.database || !this.healthStatus.auditLogging;
    
    return failedComponents >= 3 || criticalComponentsFailed;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.threatDetectionService) {
      this.threatDetectionService.cleanupExpiredRestrictions();
    }
    
    if (this.alertingService) {
      this.alertingService.destroy();
    }
  }
}

export default ResilientSecurityMonitorService;