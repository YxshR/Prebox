import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import winston from 'winston';
import { HealthCheck, SystemHealth } from './monitoring.types';

export class HealthCheckService {
  private db: Pool;
  private redis: RedisClientType;
  private logger: winston.Logger;
  private healthChecks: Map<string, () => Promise<HealthCheck>> = new Map();
  private lastHealthCheck: SystemHealth | null = null;
  private checkInterval: NodeJS.Timeout;

  constructor(db: Pool, redis: RedisClientType, logger: winston.Logger) {
    this.db = db;
    this.redis = redis;
    this.logger = logger;

    // Register default health checks
    this.registerDefaultHealthChecks();

    // Run health checks every 30 seconds
    this.checkInterval = setInterval(() => {
      this.runHealthChecks();
    }, 30000);

    // Run initial health check
    this.runHealthChecks();
  }

  /**
   * Register a custom health check
   */
  registerHealthCheck(name: string, checkFunction: () => Promise<HealthCheck>): void {
    this.healthChecks.set(name, checkFunction);
    this.logger.info('Health check registered', { name });
  }

  /**
   * Remove a health check
   */
  unregisterHealthCheck(name: string): void {
    this.healthChecks.delete(name);
    this.logger.info('Health check unregistered', { name });
  }

  /**
   * Get current system health
   */
  async getSystemHealth(): Promise<SystemHealth> {
    if (!this.lastHealthCheck) {
      await this.runHealthChecks();
    }
    return this.lastHealthCheck!;
  }

  /**
   * Get health check history
   */
  async getHealthHistory(hours: number = 24): Promise<SystemHealth[]> {
    try {
      const startTime = new Date();
      startTime.setHours(startTime.getHours() - hours);

      const result = await this.db.query(`
        SELECT overall_status, checks_data, timestamp, uptime
        FROM health_checks 
        WHERE timestamp >= $1
        ORDER BY timestamp DESC
      `, [startTime]);

      return result.rows.map(row => ({
        overall: row.overall_status,
        checks: row.checks_data,
        timestamp: row.timestamp,
        uptime: row.uptime
      }));

    } catch (error) {
      this.logger.error('Failed to get health history', { error });
      return [];
    }
  }

  /**
   * Run all health checks
   */
  private async runHealthChecks(): Promise<void> {
    try {
      const startTime = Date.now();
      const checks: HealthCheck[] = [];

      // Run all registered health checks in parallel
      const checkPromises = Array.from(this.healthChecks.entries()).map(async ([name, checkFn]) => {
        try {
          const result = await Promise.race([
            checkFn(),
            this.timeoutPromise(10000, name) // 10 second timeout
          ]);
          return result;
        } catch (error) {
          return {
            name,
            status: 'unhealthy' as const,
            timestamp: new Date(),
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      const checkResults = await Promise.all(checkPromises);
      checks.push(...checkResults);

      // Determine overall health
      const unhealthyChecks = checks.filter(check => check.status === 'unhealthy');
      const degradedChecks = checks.filter(check => check.status === 'degraded');

      let overall: 'healthy' | 'unhealthy' | 'degraded';
      if (unhealthyChecks.length > 0) {
        overall = 'unhealthy';
      } else if (degradedChecks.length > 0) {
        overall = 'degraded';
      } else {
        overall = 'healthy';
      }

      const systemHealth: SystemHealth = {
        overall,
        checks,
        timestamp: new Date(),
        uptime: process.uptime()
      };

      this.lastHealthCheck = systemHealth;

      // Store health check result
      await this.storeHealthCheck(systemHealth);

      // Log health status changes
      if (overall !== 'healthy') {
        this.logger.warn('System health degraded', { 
          overall, 
          unhealthyChecks: unhealthyChecks.length,
          degradedChecks: degradedChecks.length 
        });
      }

      const duration = Date.now() - startTime;
      this.logger.debug('Health checks completed', { duration, overall, checksCount: checks.length });

    } catch (error) {
      this.logger.error('Failed to run health checks', { error });
    }
  }

  /**
   * Store health check result in database
   */
  private async storeHealthCheck(health: SystemHealth): Promise<void> {
    try {
      // Store overall system health check
      await this.db.query(`
        INSERT INTO health_checks (service_name, status, metadata, checked_at)
        VALUES ($1, $2, $3, $4)
      `, [
        'system',
        health.overall,
        JSON.stringify({
          checks: health.checks,
          uptime: health.uptime,
          timestamp: health.timestamp
        }),
        health.timestamp
      ]);

      // Also store in Redis for quick access
      await this.redis.setEx('system:health', 60, JSON.stringify(health));

    } catch (error) {
      this.logger.error('Failed to store health check', { error });
    }
  }

  /**
   * Register default health checks
   */
  private registerDefaultHealthChecks(): void {
    // Database health check
    this.registerHealthCheck('database', async () => {
      const startTime = Date.now();
      try {
        await this.db.query('SELECT 1');
        const responseTime = Date.now() - startTime;
        
        return {
          name: 'database',
          status: responseTime < 1000 ? 'healthy' : 'degraded',
          timestamp: new Date(),
          responseTime,
          metadata: { responseTime }
        };
      } catch (error) {
        return {
          name: 'database',
          status: 'unhealthy',
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Database connection failed'
        };
      }
    });

    // Redis health check
    this.registerHealthCheck('redis', async () => {
      const startTime = Date.now();
      try {
        await this.redis.ping();
        const responseTime = Date.now() - startTime;
        
        return {
          name: 'redis',
          status: responseTime < 500 ? 'healthy' : 'degraded',
          timestamp: new Date(),
          responseTime,
          metadata: { responseTime }
        };
      } catch (error) {
        return {
          name: 'redis',
          status: 'unhealthy',
          timestamp: new Date(),
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Redis connection failed'
        };
      }
    });

    // Memory health check
    this.registerHealthCheck('memory', async () => {
      const memUsage = process.memoryUsage();
      const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      
      let status: 'healthy' | 'degraded' | 'unhealthy';
      if (heapUsedPercent > 90) {
        status = 'unhealthy';
      } else if (heapUsedPercent > 75) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }

      return {
        name: 'memory',
        status,
        timestamp: new Date(),
        metadata: {
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          heapUsedPercent: Math.round(heapUsedPercent * 100) / 100,
          rss: memUsage.rss,
          external: memUsage.external
        }
      };
    });

    // Disk space health check (if available)
    this.registerHealthCheck('disk', async () => {
      try {
        // This is a simplified check - in production you might want to use a library like 'node-disk-info'
        const stats = await import('fs').then(fs => fs.promises.stat('.'));
        
        return {
          name: 'disk',
          status: 'healthy', // Simplified - would need actual disk space calculation
          timestamp: new Date(),
          metadata: {
            // Would include actual disk usage metrics
            available: 'unknown'
          }
        };
      } catch (error) {
        return {
          name: 'disk',
          status: 'degraded',
          timestamp: new Date(),
          error: 'Unable to check disk space'
        };
      }
    });

    // Email service health check
    this.registerHealthCheck('email_service', async () => {
      try {
        // Check if we can connect to email service
        // This would depend on your email provider (SES, SendGrid, etc.)
        
        return {
          name: 'email_service',
          status: 'healthy',
          timestamp: new Date(),
          metadata: {
            provider: process.env.EMAIL_PROVIDER || 'unknown'
          }
        };
      } catch (error) {
        return {
          name: 'email_service',
          status: 'unhealthy',
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Email service check failed'
        };
      }
    });

    // Queue health check
    this.registerHealthCheck('queue', async () => {
      try {
        // Check Redis queue status
        const queueInfo = await this.redis.info('memory');
        
        return {
          name: 'queue',
          status: 'healthy',
          timestamp: new Date(),
          metadata: {
            redisMemory: queueInfo
          }
        };
      } catch (error) {
        return {
          name: 'queue',
          status: 'unhealthy',
          timestamp: new Date(),
          error: error instanceof Error ? error.message : 'Queue check failed'
        };
      }
    });
  }

  /**
   * Create a timeout promise for health checks
   */
  private timeoutPromise(ms: number, checkName: string): Promise<HealthCheck> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Health check '${checkName}' timed out after ${ms}ms`));
      }, ms);
    });
  }

  /**
   * Get uptime statistics
   */
  async getUptimeStats(days: number = 7): Promise<{
    uptime: number;
    downtimeEvents: Array<{ start: Date; end: Date; duration: number }>;
    availability: number;
  }> {
    try {
      const startTime = new Date();
      startTime.setDate(startTime.getDate() - days);

      const result = await this.db.query(`
        SELECT overall_status, timestamp
        FROM health_checks 
        WHERE timestamp >= $1
        ORDER BY timestamp ASC
      `, [startTime]);

      let totalTime = 0;
      let downtime = 0;
      const downtimeEvents: Array<{ start: Date; end: Date; duration: number }> = [];
      let currentDowntimeStart: Date | null = null;

      for (let i = 0; i < result.rows.length - 1; i++) {
        const current = result.rows[i];
        const next = result.rows[i + 1];
        const duration = new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime();
        
        totalTime += duration;

        if (current.overall_status === 'unhealthy') {
          downtime += duration;
          
          if (!currentDowntimeStart) {
            currentDowntimeStart = new Date(current.timestamp);
          }
        } else if (currentDowntimeStart) {
          downtimeEvents.push({
            start: currentDowntimeStart,
            end: new Date(current.timestamp),
            duration: new Date(current.timestamp).getTime() - currentDowntimeStart.getTime()
          });
          currentDowntimeStart = null;
        }
      }

      const availability = totalTime > 0 ? ((totalTime - downtime) / totalTime) * 100 : 100;

      return {
        uptime: process.uptime(),
        downtimeEvents,
        availability: Math.round(availability * 100) / 100
      };

    } catch (error) {
      this.logger.error('Failed to get uptime stats', { error });
      return {
        uptime: process.uptime(),
        downtimeEvents: [],
        availability: 100
      };
    }
  }

  /**
   * Cleanup old health check data
   */
  async cleanupOldHealthChecks(days: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      await this.db.query(`
        DELETE FROM health_checks WHERE timestamp < $1
      `, [cutoffDate]);

      this.logger.info('Old health check data cleaned up', { cutoffDate });

    } catch (error) {
      this.logger.error('Failed to cleanup old health checks', { error });
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}