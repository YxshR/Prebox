import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import winston from 'winston';
import { MonitoringService } from './monitoring.service';

export interface AuthEvent {
  id: string;
  eventType: 'login_attempt' | 'login_success' | 'login_failure' | 'signup_start' | 'signup_complete' | 'phone_verification' | 'email_verification' | 'password_reset' | 'logout';
  userId?: string;
  email?: string;
  phone?: string;
  ipAddress?: string;
  userAgent?: string;
  method: 'email_password' | 'phone_otp' | 'auth0' | 'google_oauth';
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  responseTime?: number;
}

export interface AuthMetrics {
  totalLogins: number;
  successfulLogins: number;
  failedLogins: number;
  signupAttempts: number;
  completedSignups: number;
  phoneVerifications: number;
  emailVerifications: number;
  averageResponseTime: number;
  errorRate: number;
  methodBreakdown: Record<string, number>;
}

export class AuthMonitoringService {
  private db: Pool;
  private redis: RedisClientType;
  private logger: winston.Logger;
  private monitoringService: MonitoringService;

  constructor(db: Pool, redis: RedisClientType, logger: winston.Logger, monitoringService: MonitoringService) {
    this.db = db;
    this.redis = redis;
    this.logger = logger;
    this.monitoringService = monitoringService;
  }

  /**
   * Record an authentication event
   */
  async recordAuthEvent(event: Omit<AuthEvent, 'id' | 'timestamp'>): Promise<void> {
    const authEvent: AuthEvent = {
      ...event,
      id: require('uuid').v4(),
      timestamp: new Date()
    };

    try {
      // Store in database for long-term analysis
      await this.db.query(`
        INSERT INTO auth_events 
        (id, event_type, user_id, email, phone, ip_address, user_agent, method, success, error_code, error_message, metadata, timestamp, response_time)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        authEvent.id,
        authEvent.eventType,
        authEvent.userId,
        authEvent.email,
        authEvent.phone,
        authEvent.ipAddress,
        authEvent.userAgent,
        authEvent.method,
        authEvent.success,
        authEvent.errorCode,
        authEvent.errorMessage,
        JSON.stringify(authEvent.metadata || {}),
        authEvent.timestamp,
        authEvent.responseTime
      ]);

      // Update real-time counters in Redis
      const dateKey = new Date().toISOString().split('T')[0];
      await Promise.all([
        this.redis.incr(`auth:${authEvent.eventType}:${dateKey}`),
        this.redis.incr(`auth:method:${authEvent.method}:${dateKey}`),
        this.redis.incr(`auth:${authEvent.success ? 'success' : 'failure'}:${dateKey}`)
      ]);

      // Set TTL for Redis keys (7 days)
      await Promise.all([
        this.redis.expire(`auth:${authEvent.eventType}:${dateKey}`, 7 * 24 * 60 * 60),
        this.redis.expire(`auth:method:${authEvent.method}:${dateKey}`, 7 * 24 * 60 * 60),
        this.redis.expire(`auth:${authEvent.success ? 'success' : 'failure'}:${dateKey}`, 7 * 24 * 60 * 60)
      ]);

      // Record as business metric
      await this.monitoringService.recordBusinessMetric({
        name: `auth_${authEvent.eventType}`,
        value: 1,
        timestamp: authEvent.timestamp,
        userId: authEvent.userId,
        metadata: {
          method: authEvent.method,
          success: authEvent.success,
          ipAddress: authEvent.ipAddress
        }
      });

      // Log the event
      this.logger.info('Authentication event recorded', {
        eventType: authEvent.eventType,
        method: authEvent.method,
        success: authEvent.success,
        userId: authEvent.userId,
        ipAddress: authEvent.ipAddress,
        responseTime: authEvent.responseTime
      });

      // Check for suspicious activity
      await this.checkSuspiciousActivity(authEvent);

    } catch (error) {
      this.logger.error('Failed to record auth event', { error, event: authEvent });
    }
  }

  /**
   * Get authentication metrics for a time range
   */
  async getAuthMetrics(startTime: Date, endTime: Date): Promise<AuthMetrics> {
    try {
      const result = await this.db.query(`
        SELECT 
          event_type,
          method,
          success,
          COUNT(*) as count,
          AVG(response_time) as avg_response_time
        FROM auth_events 
        WHERE timestamp BETWEEN $1 AND $2
        GROUP BY event_type, method, success
      `, [startTime, endTime]);

      const metrics: AuthMetrics = {
        totalLogins: 0,
        successfulLogins: 0,
        failedLogins: 0,
        signupAttempts: 0,
        completedSignups: 0,
        phoneVerifications: 0,
        emailVerifications: 0,
        averageResponseTime: 0,
        errorRate: 0,
        methodBreakdown: {}
      };

      let totalResponseTime = 0;
      let totalEvents = 0;

      result.rows.forEach(row => {
        const count = parseInt(row.count);
        const eventType = row.event_type;
        const method = row.method;
        const success = row.success;

        totalEvents += count;
        if (row.avg_response_time) {
          totalResponseTime += parseFloat(row.avg_response_time) * count;
        }

        // Count by event type
        if (eventType.includes('login')) {
          metrics.totalLogins += count;
          if (success) {
            metrics.successfulLogins += count;
          } else {
            metrics.failedLogins += count;
          }
        } else if (eventType === 'signup_start') {
          metrics.signupAttempts += count;
        } else if (eventType === 'signup_complete') {
          metrics.completedSignups += count;
        } else if (eventType === 'phone_verification') {
          metrics.phoneVerifications += count;
        } else if (eventType === 'email_verification') {
          metrics.emailVerifications += count;
        }

        // Count by method
        if (!metrics.methodBreakdown[method]) {
          metrics.methodBreakdown[method] = 0;
        }
        metrics.methodBreakdown[method] += count;
      });

      metrics.averageResponseTime = totalEvents > 0 ? totalResponseTime / totalEvents : 0;
      metrics.errorRate = metrics.totalLogins > 0 ? metrics.failedLogins / metrics.totalLogins : 0;

      return metrics;

    } catch (error) {
      this.logger.error('Failed to get auth metrics', { error });
      return {
        totalLogins: 0,
        successfulLogins: 0,
        failedLogins: 0,
        signupAttempts: 0,
        completedSignups: 0,
        phoneVerifications: 0,
        emailVerifications: 0,
        averageResponseTime: 0,
        errorRate: 0,
        methodBreakdown: {}
      };
    }
  }

  /**
   * Check for suspicious authentication activity
   */
  private async checkSuspiciousActivity(event: AuthEvent): Promise<void> {
    try {
      // Check for multiple failed login attempts from same IP
      if (!event.success && event.eventType === 'login_failure' && event.ipAddress) {
        const failureCount = await this.redis.incr(`auth:failures:${event.ipAddress}`);
        await this.redis.expire(`auth:failures:${event.ipAddress}`, 15 * 60); // 15 minutes

        if (failureCount >= 5) {
          this.logger.warn('Suspicious login activity detected', {
            ipAddress: event.ipAddress,
            failureCount,
            event
          });

          // Record security event
          await this.monitoringService.recordError({
            id: require('uuid').v4(),
            message: `Multiple failed login attempts from IP: ${event.ipAddress}`,
            level: 'warn',
            timestamp: new Date(),
            endpoint: '/auth/login',
            method: 'POST',
            metadata: {
              ipAddress: event.ipAddress,
              failureCount,
              eventType: 'suspicious_activity'
            }
          });
        }
      }

      // Check for rapid signup attempts from same IP
      if (event.eventType === 'signup_start' && event.ipAddress) {
        const signupCount = await this.redis.incr(`auth:signups:${event.ipAddress}`);
        await this.redis.expire(`auth:signups:${event.ipAddress}`, 60 * 60); // 1 hour

        if (signupCount >= 10) {
          this.logger.warn('Suspicious signup activity detected', {
            ipAddress: event.ipAddress,
            signupCount,
            event
          });
        }
      }

    } catch (error) {
      this.logger.error('Failed to check suspicious activity', { error });
    }
  }

  /**
   * Get authentication events for a user
   */
  async getUserAuthEvents(userId: string, limit: number = 50): Promise<AuthEvent[]> {
    try {
      const result = await this.db.query(`
        SELECT * FROM auth_events 
        WHERE user_id = $1 
        ORDER BY timestamp DESC 
        LIMIT $2
      `, [userId, limit]);

      return result.rows.map(row => ({
        id: row.id,
        eventType: row.event_type,
        userId: row.user_id,
        email: row.email,
        phone: row.phone,
        ipAddress: row.ip_address,
        userAgent: row.user_agent,
        method: row.method,
        success: row.success,
        errorCode: row.error_code,
        errorMessage: row.error_message,
        metadata: row.metadata,
        timestamp: row.timestamp,
        responseTime: row.response_time
      }));

    } catch (error) {
      this.logger.error('Failed to get user auth events', { error, userId });
      return [];
    }
  }

  /**
   * Get real-time authentication statistics
   */
  async getRealTimeStats(): Promise<Record<string, number>> {
    try {
      const dateKey = new Date().toISOString().split('T')[0];
      const keys = [
        `auth:login_attempt:${dateKey}`,
        `auth:login_success:${dateKey}`,
        `auth:login_failure:${dateKey}`,
        `auth:signup_start:${dateKey}`,
        `auth:signup_complete:${dateKey}`,
        `auth:phone_verification:${dateKey}`,
        `auth:email_verification:${dateKey}`
      ];

      const values = await Promise.all(
        keys.map(key => this.redis.get(key).then(val => parseInt(val || '0')))
      );

      return {
        loginAttempts: values[0],
        loginSuccesses: values[1],
        loginFailures: values[2],
        signupStarts: values[3],
        signupCompletes: values[4],
        phoneVerifications: values[5],
        emailVerifications: values[6]
      };

    } catch (error) {
      this.logger.error('Failed to get real-time stats', { error });
      return {};
    }
  }
}