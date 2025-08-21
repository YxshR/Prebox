import { RateLimiterService } from './rate-limiter.service';
import { SubscriptionTier } from '../shared/types';
import pool from '../config/database';
import redisClient from '../config/redis';

// Mock dependencies
jest.mock('../config/database', () => ({
  connect: jest.fn(),
  query: jest.fn()
}));

jest.mock('../config/redis', () => ({
  get: jest.fn(),
  set: jest.fn(),
  setEx: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn(),
  multi: jest.fn(),
  exec: jest.fn(),
  del: jest.fn()
}));

describe('RateLimiterService', () => {
  let rateLimiterService: RateLimiterService;
  let mockClient: any;
  let mockPipeline: any;

  beforeEach(() => {
    rateLimiterService = new RateLimiterService();
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    mockPipeline = {
      incr: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([])
    };

    (pool.connect as jest.Mock).mockResolvedValue(mockClient);
    (redisClient.multi as jest.Mock).mockReturnValue(mockPipeline);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('checkApiKeyRateLimit', () => {
    const apiKeyId = 'key-123';
    const tenantId = 'tenant-123';

    it('should allow request within rate limits', async () => {
      const mockLimits = [
        {
          limit_type: 'hourly',
          limit_value: 100,
          current_usage: 50,
          reset_at: new Date(Date.now() + 3600000) // 1 hour from now
        },
        {
          limit_type: 'daily',
          limit_value: 1000,
          current_usage: 200,
          reset_at: new Date(Date.now() + 86400000) // 1 day from now
        }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: mockLimits })
        .mockResolvedValueOnce({ rowCount: 1 });

      const result = await rateLimiterService.checkApiKeyRateLimit(apiKeyId, tenantId);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(1000); // Daily limit
      expect(result.remaining).toBe(799); // 1000 - 200 - 1
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE rate_limits'),
        [apiKeyId, tenantId]
      );
    });

    it('should deny request when rate limit exceeded', async () => {
      const mockLimits = [
        {
          limit_type: 'hourly',
          limit_value: 100,
          current_usage: 100, // At limit
          reset_at: new Date(Date.now() + 3600000)
        }
      ];

      mockClient.query.mockResolvedValueOnce({ rows: mockLimits });

      const result = await rateLimiterService.checkApiKeyRateLimit(apiKeyId, tenantId);

      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(100);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should reset counters when window has passed', async () => {
      const mockLimits = [
        {
          limit_type: 'hourly',
          limit_value: 100,
          current_usage: 50,
          reset_at: new Date(Date.now() - 1000) // 1 second ago (expired)
        }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: mockLimits })
        .mockResolvedValueOnce({ rowCount: 1 }) // Reset query
        .mockResolvedValueOnce({ rowCount: 1 }); // Increment query

      const result = await rateLimiterService.checkApiKeyRateLimit(apiKeyId, tenantId);

      expect(result.allowed).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE rate_limits'),
        expect.arrayContaining([expect.any(Date), apiKeyId, tenantId, 'hourly'])
      );
    });

    it('should throw error when rate limits not configured', async () => {
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        rateLimiterService.checkApiKeyRateLimit(apiKeyId, tenantId)
      ).rejects.toThrow('Rate limits not configured for API key');
    });
  });

  describe('checkTenantRateLimit', () => {
    const tenantId = 'tenant-123';

    it('should allow request for free tier within limits', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue('50'); // Current count
      (redisClient.ttl as jest.Mock).mockResolvedValue(1800); // 30 minutes left

      const result = await rateLimiterService.checkTenantRateLimit(tenantId, SubscriptionTier.FREE);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(100); // Free tier hourly limit
      expect(result.remaining).toBe(49); // 100 - 50 - 1
      expect(mockPipeline.incr).toHaveBeenCalled();
    });

    it('should deny request when tenant limit exceeded', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue('100'); // At limit
      (redisClient.ttl as jest.Mock).mockResolvedValue(1800);

      const result = await rateLimiterService.checkTenantRateLimit(tenantId, SubscriptionTier.FREE);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBe(1800);
    });

    it('should handle Redis errors gracefully', async () => {
      (redisClient.get as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));

      const result = await rateLimiterService.checkTenantRateLimit(tenantId, SubscriptionTier.FREE);

      expect(result.allowed).toBe(true); // Fallback to allowing request
    });

    it('should set expiration for new counters', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue(null); // No existing counter

      await rateLimiterService.checkTenantRateLimit(tenantId, SubscriptionTier.FREE);

      expect(mockPipeline.incr).toHaveBeenCalled();
      expect(mockPipeline.expire).toHaveBeenCalledWith(expect.any(String), 3600);
    });
  });

  describe('checkIpRateLimit', () => {
    const ipAddress = '192.168.1.1';
    const config = {
      windowMs: 60000, // 1 minute
      maxRequests: 10
    };

    it('should allow request within IP rate limits', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue('5');
      (redisClient.ttl as jest.Mock).mockResolvedValue(30);

      const result = await rateLimiterService.checkIpRateLimit(ipAddress, config);

      expect(result.allowed).toBe(true);
      expect(result.limit).toBe(10);
      expect(result.remaining).toBe(4); // 10 - 5 - 1
    });

    it('should deny request when IP limit exceeded', async () => {
      (redisClient.get as jest.Mock).mockResolvedValue('10');
      (redisClient.ttl as jest.Mock).mockResolvedValue(30);

      const result = await rateLimiterService.checkIpRateLimit(ipAddress, config);

      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBe(30);
    });
  });

  describe('recordApiUsage', () => {
    const apiKeyId = 'key-123';
    const tenantId = 'tenant-123';
    const endpoint = 'POST /api/emails/send';
    const method = 'POST';
    const statusCode = 200;
    const responseTimeMs = 150;

    it('should record API usage successfully', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rowCount: 1 }) // Insert usage
        .mockResolvedValueOnce({ rowCount: 1 }); // Upsert analytics

      await rateLimiterService.recordApiUsage(
        apiKeyId,
        tenantId,
        endpoint,
        method,
        statusCode,
        responseTimeMs
      );

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO api_usage'),
        expect.arrayContaining([apiKeyId, tenantId, endpoint, method, statusCode, responseTimeMs])
      );

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO api_analytics'),
        expect.any(Array)
      );
    });

    it('should handle database errors gracefully', async () => {
      (pool.query as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Should not throw error
      await expect(
        rateLimiterService.recordApiUsage(apiKeyId, tenantId, endpoint, method, statusCode, responseTimeMs)
      ).resolves.toBeUndefined();
    });
  });

  describe('getApiAnalytics', () => {
    const tenantId = 'tenant-123';

    it('should return analytics data for tenant', async () => {
      const mockAnalytics = [
        {
          date: '2024-01-01',
          total_requests: '100',
          successful_requests: '95',
          failed_requests: '5',
          avg_response_time: '150.5',
          data_transferred: '1024000',
          unique_endpoints: '10'
        }
      ];

      (pool.query as jest.Mock).mockResolvedValue({ rows: mockAnalytics });

      const result = await rateLimiterService.getApiAnalytics(tenantId, undefined, 7);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        date: '2024-01-01',
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        avgResponseTime: 150.5,
        dataTransferred: 1024000,
        uniqueEndpoints: 10
      });
    });

    it('should filter by API key when provided', async () => {
      const apiKeyId = 'key-123';
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await rateLimiterService.getApiAnalytics(tenantId, apiKeyId, 30);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE tenant_id = $1 AND api_key_id = $2'),
        expect.arrayContaining([tenantId, apiKeyId])
      );
    });
  });

  describe('cleanupOldUsageRecords', () => {
    it('should delete old usage records', async () => {
      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rowCount: 100 })
        .mockResolvedValueOnce({ rowCount: 50 });

      await rateLimiterService.cleanupOldUsageRecords(90);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM api_usage'),
        expect.any(Array)
      );

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM api_analytics'),
        expect.any(Array)
      );
    });
  });
});