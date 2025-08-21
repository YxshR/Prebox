import pool from '../config/database';
import redisClient from '../config/redis';
import { SubscriptionTier } from '../shared/types';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number; // seconds until next allowed request
}

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (req: any) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

export class RateLimiterService {
  
  /**
   * Check if request is within rate limits for API key
   */
  async checkApiKeyRateLimit(apiKeyId: string, tenantId: string): Promise<RateLimitResult> {
    const client = await pool.connect();
    
    try {
      // Get current rate limits for this API key
      const limitsResult = await client.query(`
        SELECT limit_type, limit_value, current_usage, reset_at
        FROM rate_limits
        WHERE api_key_id = $1 AND tenant_id = $2
        ORDER BY limit_type
      `, [apiKeyId, tenantId]);

      if (limitsResult.rows.length === 0) {
        throw new Error('Rate limits not configured for API key');
      }

      // Check each limit type (hourly, daily, monthly)
      for (const limit of limitsResult.rows) {
        const now = new Date();
        const resetTime = new Date(limit.reset_at);

        // Reset counter if window has passed
        if (now >= resetTime) {
          const newResetTime = this.calculateNextResetTime(limit.limit_type);
          await client.query(`
            UPDATE rate_limits 
            SET current_usage = 0, reset_at = $1, updated_at = NOW()
            WHERE api_key_id = $2 AND tenant_id = $3 AND limit_type = $4
          `, [newResetTime, apiKeyId, tenantId, limit.limit_type]);
          
          limit.current_usage = 0;
          limit.reset_at = newResetTime;
        }

        // Check if limit exceeded
        if (limit.current_usage >= limit.limit_value) {
          const retryAfter = Math.ceil((resetTime.getTime() - now.getTime()) / 1000);
          
          return {
            allowed: false,
            limit: limit.limit_value,
            remaining: 0,
            resetTime: resetTime,
            retryAfter: retryAfter > 0 ? retryAfter : 0
          };
        }
      }

      // All limits passed, increment counters
      await client.query(`
        UPDATE rate_limits 
        SET current_usage = current_usage + 1, updated_at = NOW()
        WHERE api_key_id = $1 AND tenant_id = $2
      `, [apiKeyId, tenantId]);

      // Return the most restrictive limit info (daily limit)
      const dailyLimit = limitsResult.rows.find(l => l.limit_type === 'daily');
      if (dailyLimit) {
        return {
          allowed: true,
          limit: dailyLimit.limit_value,
          remaining: Math.max(0, dailyLimit.limit_value - (dailyLimit.current_usage + 1)),
          resetTime: new Date(dailyLimit.reset_at)
        };
      }

      return {
        allowed: true,
        limit: 1000, // Default fallback
        remaining: 999,
        resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000)
      };

    } finally {
      client.release();
    }
  }

  /**
   * Check rate limit for tenant (general API usage)
   */
  async checkTenantRateLimit(tenantId: string, subscriptionTier: SubscriptionTier): Promise<RateLimitResult> {
    const limits = this.getTenantRateLimits(subscriptionTier);
    const key = `tenant_rate_limit:${tenantId}:hourly`;
    
    try {
      const current = await redisClient.get(key);
      const currentCount = current ? parseInt(current) : 0;
      
      if (currentCount >= limits.hourly) {
        const ttl = await redisClient.ttl(key);
        return {
          allowed: false,
          limit: limits.hourly,
          remaining: 0,
          resetTime: new Date(Date.now() + (ttl * 1000)),
          retryAfter: ttl > 0 ? ttl : 3600
        };
      }

      // Increment counter with expiration
      const pipeline = redisClient.multi();
      pipeline.incr(key);
      if (currentCount === 0) {
        pipeline.expire(key, 3600); // 1 hour
      }
      await pipeline.exec();

      return {
        allowed: true,
        limit: limits.hourly,
        remaining: Math.max(0, limits.hourly - (currentCount + 1)),
        resetTime: new Date(Date.now() + 3600 * 1000)
      };

    } catch (error) {
      console.error('Redis rate limiting error:', error);
      // Fallback to allowing request if Redis is down
      return {
        allowed: true,
        limit: limits.hourly,
        remaining: limits.hourly - 1,
        resetTime: new Date(Date.now() + 3600 * 1000)
      };
    }
  }

  /**
   * Check IP-based rate limiting for unauthenticated requests
   */
  async checkIpRateLimit(ipAddress: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const key = `ip_rate_limit:${ipAddress}`;
    
    try {
      const current = await redisClient.get(key);
      const currentCount = current ? parseInt(current) : 0;
      
      if (currentCount >= config.maxRequests) {
        const ttl = await redisClient.ttl(key);
        const resetTime = new Date(Date.now() + (ttl * 1000));
        
        return {
          allowed: false,
          limit: config.maxRequests,
          remaining: 0,
          resetTime,
          retryAfter: ttl > 0 ? ttl : Math.ceil(config.windowMs / 1000)
        };
      }

      // Increment counter with expiration
      const pipeline = redisClient.multi();
      pipeline.incr(key);
      if (currentCount === 0) {
        pipeline.expire(key, Math.ceil(config.windowMs / 1000));
      }
      await pipeline.exec();

      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: Math.max(0, config.maxRequests - (currentCount + 1)),
        resetTime: new Date(Date.now() + config.windowMs)
      };

    } catch (error) {
      console.error('Redis IP rate limiting error:', error);
      // Fallback to allowing request if Redis is down
      return {
        allowed: true,
        limit: config.maxRequests,
        remaining: config.maxRequests - 1,
        resetTime: new Date(Date.now() + config.windowMs)
      };
    }
  }

  /**
   * Record API usage for analytics
   */
  async recordApiUsage(
    apiKeyId: string,
    tenantId: string,
    endpoint: string,
    method: string,
    statusCode: number,
    responseTimeMs: number,
    requestSizeBytes?: number,
    responseSizeBytes?: number,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      // Insert usage record
      await pool.query(`
        INSERT INTO api_usage (
          api_key_id, tenant_id, endpoint, method, status_code, 
          response_time_ms, request_size_bytes, response_size_bytes,
          ip_address, user_agent, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      `, [
        apiKeyId,
        tenantId,
        endpoint,
        method,
        statusCode,
        responseTimeMs,
        requestSizeBytes || null,
        responseSizeBytes || null,
        ipAddress || null,
        userAgent || null
      ]);

      // Update daily analytics (upsert)
      const today = new Date().toISOString().split('T')[0];
      await pool.query(`
        INSERT INTO api_analytics (
          tenant_id, api_key_id, date, total_requests, 
          successful_requests, failed_requests, avg_response_time_ms,
          total_data_transferred_bytes, unique_endpoints
        ) VALUES ($1, $2, $3, 1, $4, $5, $6, $7, 1)
        ON CONFLICT (tenant_id, api_key_id, date) 
        DO UPDATE SET
          total_requests = api_analytics.total_requests + 1,
          successful_requests = api_analytics.successful_requests + $4,
          failed_requests = api_analytics.failed_requests + $5,
          avg_response_time_ms = (
            (api_analytics.avg_response_time_ms * api_analytics.total_requests + $6) / 
            (api_analytics.total_requests + 1)
          ),
          total_data_transferred_bytes = api_analytics.total_data_transferred_bytes + $7,
          updated_at = NOW()
      `, [
        tenantId,
        apiKeyId,
        today,
        statusCode < 400 ? 1 : 0, // successful_requests
        statusCode >= 400 ? 1 : 0, // failed_requests
        responseTimeMs,
        (requestSizeBytes || 0) + (responseSizeBytes || 0)
      ]);

    } catch (error) {
      console.error('Error recording API usage:', error);
      // Don't throw error to avoid breaking the main request
    }
  }

  /**
   * Get API analytics for a tenant
   */
  async getApiAnalytics(tenantId: string, apiKeyId?: string, days: number = 30): Promise<any> {
    const whereClause = apiKeyId 
      ? 'WHERE tenant_id = $1 AND api_key_id = $2 AND date >= $3'
      : 'WHERE tenant_id = $1 AND date >= $2';
    
    const params = apiKeyId 
      ? [tenantId, apiKeyId, new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]]
      : [tenantId, new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]];

    const result = await pool.query(`
      SELECT 
        date,
        SUM(total_requests) as total_requests,
        SUM(successful_requests) as successful_requests,
        SUM(failed_requests) as failed_requests,
        AVG(avg_response_time_ms) as avg_response_time,
        SUM(total_data_transferred_bytes) as data_transferred,
        SUM(unique_endpoints) as unique_endpoints
      FROM api_analytics
      ${whereClause}
      GROUP BY date
      ORDER BY date DESC
    `, params);

    return result.rows.map(row => ({
      date: row.date,
      totalRequests: parseInt(row.total_requests),
      successfulRequests: parseInt(row.successful_requests),
      failedRequests: parseInt(row.failed_requests),
      avgResponseTime: parseFloat(row.avg_response_time) || 0,
      dataTransferred: parseInt(row.data_transferred),
      uniqueEndpoints: parseInt(row.unique_endpoints)
    }));
  }

  /**
   * Clean up old usage records (for data retention)
   */
  async cleanupOldUsageRecords(retentionDays: number = 90): Promise<void> {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    await pool.query(`
      DELETE FROM api_usage 
      WHERE created_at < $1
    `, [cutoffDate]);

    await pool.query(`
      DELETE FROM api_analytics 
      WHERE date < $1
    `, [cutoffDate.toISOString().split('T')[0]]);
  }

  /**
   * Get tenant rate limits based on subscription tier
   */
  private getTenantRateLimits(tier: SubscriptionTier): { hourly: number; daily: number; monthly: number } {
    switch (tier) {
      case SubscriptionTier.FREE:
        return { hourly: 100, daily: 200, monthly: 2000 };
      case SubscriptionTier.PAID_STANDARD:
        return { hourly: 1000, daily: 2000, monthly: 50000 };
      case SubscriptionTier.PREMIUM:
        return { hourly: 5000, daily: 10000, monthly: 200000 };
      case SubscriptionTier.ENTERPRISE:
        return { hourly: 20000, daily: 50000, monthly: 1000000 };
      default:
        return { hourly: 100, daily: 200, monthly: 2000 };
    }
  }

  /**
   * Calculate next reset time based on limit type
   */
  private calculateNextResetTime(limitType: string): Date {
    const now = new Date();
    
    switch (limitType) {
      case 'hourly':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
      case 'daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
      default:
        return new Date(now.getTime() + 60 * 60 * 1000); // 1 hour default
    }
  }
}