import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import winston from 'winston';
import { 
  MetricData, 
  PerformanceMetric, 
  BusinessMetric, 
  ErrorEvent, 
  MonitoringConfig 
} from './monitoring.types';

export class MonitoringService {
  private db: Pool;
  private redis: RedisClientType;
  private logger: winston.Logger;
  private config: MonitoringConfig;

  constructor(db: Pool, redis: RedisClientType, logger: winston.Logger) {
    this.db = db;
    this.redis = redis;
    this.logger = logger;
    this.config = {
      metricsRetentionDays: 30,
      alertingEnabled: true,
      healthCheckInterval: 60000, // 1 minute
      performanceThresholds: {
        responseTime: 2000, // 2 seconds
        errorRate: 0.05, // 5%
        throughput: 1000 // requests per minute
      },
      businessMetrics: {
        emailsSentDaily: true,
        subscriptionChanges: true,
        apiUsage: true,
        revenueTracking: true
      }
    };
  }

  /**
   * Record a performance metric
   */
  async recordPerformanceMetric(metric: PerformanceMetric): Promise<void> {
    try {
      // Store in database for long-term analysis
      await this.db.query(`
        INSERT INTO performance_metrics 
        (endpoint, method, status_code, response_time, timestamp, user_id, tenant_id, error_message)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        metric.endpoint,
        metric.method,
        metric.statusCode,
        metric.responseTime,
        metric.timestamp,
        metric.userId,
        metric.tenantId,
        metric.errorMessage
      ]);

      // Store in Redis for real-time monitoring
      const key = `perf:${metric.endpoint}:${metric.method}`;
      await this.redis.zAdd(key, { score: Date.now(), value: JSON.stringify(metric) });
      await this.redis.expire(key, 3600); // 1 hour TTL

      // Log performance issues
      if (metric.responseTime > this.config.performanceThresholds.responseTime) {
        this.logger.warn('Slow response detected', {
          endpoint: metric.endpoint,
          responseTime: metric.responseTime,
          threshold: this.config.performanceThresholds.responseTime
        });
      }

    } catch (error) {
      this.logger.error('Failed to record performance metric', { error, metric });
    }
  }

  /**
   * Record a business metric
   */
  async recordBusinessMetric(metric: BusinessMetric): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO business_metrics 
        (name, value, timestamp, tenant_id, user_id, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        metric.name,
        metric.value,
        metric.timestamp,
        metric.tenantId,
        metric.userId,
        JSON.stringify(metric.metadata || {})
      ]);

      // Update real-time counters in Redis
      const dailyKey = `business:${metric.name}:${new Date().toISOString().split('T')[0]}`;
      await this.redis.incrByFloat(dailyKey, metric.value);
      await this.redis.expire(dailyKey, 86400 * 7); // 7 days TTL

      this.logger.info('Business metric recorded', metric);

    } catch (error) {
      this.logger.error('Failed to record business metric', { error, metric });
    }
  }

  /**
   * Record an error event
   */
  async recordError(error: ErrorEvent): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO error_events 
        (id, message, stack, level, timestamp, user_id, tenant_id, endpoint, method, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        error.id,
        error.message,
        error.stack,
        error.level,
        error.timestamp,
        error.userId,
        error.tenantId,
        error.endpoint,
        error.method,
        JSON.stringify(error.metadata || {})
      ]);

      // Track error rates in Redis
      const errorKey = `errors:${new Date().toISOString().split('T')[0]}`;
      await this.redis.incr(errorKey);
      await this.redis.expire(errorKey, 86400 * 7); // 7 days TTL

      this.logger.error('Error event recorded', error);

    } catch (dbError) {
      this.logger.error('Failed to record error event', { dbError, originalError: error });
    }
  }

  /**
   * Get performance metrics for a time range
   */
  async getPerformanceMetrics(
    startTime: Date, 
    endTime: Date, 
    endpoint?: string
  ): Promise<PerformanceMetric[]> {
    try {
      let query = `
        SELECT endpoint, method, status_code, response_time, timestamp, 
               user_id, tenant_id, error_message
        FROM performance_metrics 
        WHERE timestamp BETWEEN $1 AND $2
      `;
      const params: any[] = [startTime, endTime];

      if (endpoint) {
        query += ' AND endpoint = $3';
        params.push(endpoint);
      }

      query += ' ORDER BY timestamp DESC LIMIT 1000';

      const result = await this.db.query(query, params);
      return result.rows.map(row => ({
        endpoint: row.endpoint,
        method: row.method,
        statusCode: row.status_code,
        responseTime: row.response_time,
        timestamp: row.timestamp,
        userId: row.user_id,
        tenantId: row.tenant_id,
        errorMessage: row.error_message
      }));

    } catch (error) {
      this.logger.error('Failed to get performance metrics', { error });
      return [];
    }
  }

  /**
   * Get business metrics summary
   */
  async getBusinessMetricsSummary(
    startTime: Date, 
    endTime: Date, 
    tenantId?: string
  ): Promise<Record<string, number>> {
    try {
      let query = `
        SELECT name, SUM(value) as total_value
        FROM business_metrics 
        WHERE timestamp BETWEEN $1 AND $2
      `;
      const params: any[] = [startTime, endTime];

      if (tenantId) {
        query += ' AND tenant_id = $3';
        params.push(tenantId);
      }

      query += ' GROUP BY name';

      const result = await this.db.query(query, params);
      const summary: Record<string, number> = {};
      
      result.rows.forEach(row => {
        summary[row.name] = parseFloat(row.total_value);
      });

      return summary;

    } catch (error) {
      this.logger.error('Failed to get business metrics summary', { error });
      return {};
    }
  }

  /**
   * Get error rate for a time period
   */
  async getErrorRate(startTime: Date, endTime: Date): Promise<number> {
    try {
      const errorResult = await this.db.query(`
        SELECT COUNT(*) as error_count
        FROM error_events 
        WHERE timestamp BETWEEN $1 AND $2 AND level = 'error'
      `, [startTime, endTime]);

      const totalResult = await this.db.query(`
        SELECT COUNT(*) as total_requests
        FROM performance_metrics 
        WHERE timestamp BETWEEN $1 AND $2
      `, [startTime, endTime]);

      const errorCount = parseInt(errorResult.rows[0].error_count);
      const totalRequests = parseInt(totalResult.rows[0].total_requests);

      return totalRequests > 0 ? errorCount / totalRequests : 0;

    } catch (error) {
      this.logger.error('Failed to calculate error rate', { error });
      return 0;
    }
  }

  /**
   * Get average response time
   */
  async getAverageResponseTime(startTime: Date, endTime: Date): Promise<number> {
    try {
      const result = await this.db.query(`
        SELECT AVG(response_time) as avg_response_time
        FROM performance_metrics 
        WHERE timestamp BETWEEN $1 AND $2
      `, [startTime, endTime]);

      return parseFloat(result.rows[0].avg_response_time) || 0;

    } catch (error) {
      this.logger.error('Failed to calculate average response time', { error });
      return 0;
    }
  }

  /**
   * Clean up old metrics data
   */
  async cleanupOldMetrics(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.metricsRetentionDays);

      await this.db.query(`
        DELETE FROM performance_metrics WHERE timestamp < $1
      `, [cutoffDate]);

      await this.db.query(`
        DELETE FROM business_metrics WHERE timestamp < $1
      `, [cutoffDate]);

      await this.db.query(`
        DELETE FROM error_events WHERE timestamp < $1
      `, [cutoffDate]);

      this.logger.info('Old metrics data cleaned up', { cutoffDate });

    } catch (error) {
      this.logger.error('Failed to cleanup old metrics', { error });
    }
  }
}