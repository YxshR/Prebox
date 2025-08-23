import { Pool } from 'pg';
import { RedisClientType } from 'redis';
import winston from 'winston';
import { MetricData } from './monitoring.types';

export class MetricsService {
  private db: Pool;
  private redis: RedisClientType;
  private logger: winston.Logger;
  private metricsBuffer: MetricData[] = [];
  private flushInterval: NodeJS.Timeout;

  constructor(db: Pool, redis: RedisClientType, logger: winston.Logger) {
    this.db = db;
    this.redis = redis;
    this.logger = logger;
    
    // Flush metrics every 10 seconds
    this.flushInterval = setInterval(() => {
      this.flushMetrics();
    }, 10000);
  }

  /**
   * Record a metric
   */
  async recordMetric(metric: MetricData): Promise<void> {
    this.metricsBuffer.push(metric);
    
    // Flush immediately if buffer is getting large
    if (this.metricsBuffer.length >= 100) {
      await this.flushMetrics();
    }
  }

  /**
   * Increment a counter metric
   */
  async incrementCounter(name: string, value: number = 1, tags?: Record<string, string>): Promise<void> {
    await this.recordMetric({
      name,
      value,
      timestamp: new Date(),
      tags,
      type: 'counter'
    });
  }

  /**
   * Set a gauge metric
   */
  async setGauge(name: string, value: number, tags?: Record<string, string>): Promise<void> {
    await this.recordMetric({
      name,
      value,
      timestamp: new Date(),
      tags,
      type: 'gauge'
    });
  }

  /**
   * Record a timer metric
   */
  async recordTimer(name: string, duration: number, tags?: Record<string, string>): Promise<void> {
    await this.recordMetric({
      name,
      value: duration,
      timestamp: new Date(),
      tags,
      type: 'timer'
    });
  }

  /**
   * Record a histogram metric
   */
  async recordHistogram(name: string, value: number, tags?: Record<string, string>): Promise<void> {
    await this.recordMetric({
      name,
      value,
      timestamp: new Date(),
      tags,
      type: 'histogram'
    });
  }

  /**
   * Get metric values for a time range
   */
  async getMetrics(
    name: string, 
    startTime: Date, 
    endTime: Date, 
    tags?: Record<string, string>
  ): Promise<MetricData[]> {
    try {
      let query = `
        SELECT name, value, timestamp, tags, type
        FROM metrics 
        WHERE name = $1 AND timestamp BETWEEN $2 AND $3
      `;
      const params: any[] = [name, startTime, endTime];

      if (tags) {
        query += ' AND tags @> $4';
        params.push(JSON.stringify(tags));
      }

      query += ' ORDER BY timestamp ASC';

      const result = await this.db.query(query, params);
      return result.rows.map(row => ({
        name: row.name,
        value: row.value,
        timestamp: row.timestamp,
        tags: row.tags,
        type: row.type
      }));

    } catch (error) {
      this.logger.error('Failed to get metrics', { error, name });
      return [];
    }
  }

  /**
   * Get aggregated metric data
   */
  async getAggregatedMetrics(
    name: string,
    startTime: Date,
    endTime: Date,
    aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count',
    interval: '1m' | '5m' | '15m' | '1h' | '1d' = '5m'
  ): Promise<Array<{ timestamp: Date; value: number }>> {
    try {
      const intervalMap = {
        '1m': '1 minute',
        '5m': '5 minutes',
        '15m': '15 minutes',
        '1h': '1 hour',
        '1d': '1 day'
      };

      const query = `
        SELECT 
          date_trunc('${intervalMap[interval]}', timestamp) as bucket,
          ${aggregation.toUpperCase()}(value) as value
        FROM metrics 
        WHERE name = $1 AND timestamp BETWEEN $2 AND $3
        GROUP BY bucket
        ORDER BY bucket ASC
      `;

      const result = await this.db.query(query, [name, startTime, endTime]);
      return result.rows.map(row => ({
        timestamp: row.bucket,
        value: parseFloat(row.value)
      }));

    } catch (error) {
      this.logger.error('Failed to get aggregated metrics', { error, name });
      return [];
    }
  }

  /**
   * Get real-time metric from Redis
   */
  async getRealTimeMetric(name: string): Promise<number | null> {
    try {
      const value = await this.redis.get(`metric:${name}`);
      return value ? parseFloat(value) : null;
    } catch (error) {
      this.logger.error('Failed to get real-time metric', { error, name });
      return null;
    }
  }

  /**
   * Set real-time metric in Redis
   */
  async setRealTimeMetric(name: string, value: number, ttl: number = 300): Promise<void> {
    try {
      await this.redis.setEx(`metric:${name}`, ttl, value.toString());
    } catch (error) {
      this.logger.error('Failed to set real-time metric', { error, name });
    }
  }

  /**
   * Flush buffered metrics to database
   */
  private async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const metrics = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      const values = metrics.map((metric, index) => {
        const baseIndex = index * 5;
        return `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5})`;
      }).join(', ');

      const params = metrics.flatMap(metric => [
        metric.name,
        metric.value,
        metric.timestamp,
        JSON.stringify(metric.tags || {}),
        metric.type
      ]);

      await this.db.query(`
        INSERT INTO metrics (name, value, timestamp, tags, type)
        VALUES ${values}
      `, params);

      this.logger.debug(`Flushed ${metrics.length} metrics to database`);

    } catch (error) {
      this.logger.error('Failed to flush metrics', { error, metricsCount: metrics.length });
      // Put metrics back in buffer for retry
      this.metricsBuffer.unshift(...metrics);
    }
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<Record<string, any>> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      uptime: process.uptime(),
      timestamp: new Date()
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    // Flush any remaining metrics
    this.flushMetrics();
  }
}