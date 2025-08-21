import { Pool } from 'pg';
import { createClient } from 'redis';
import winston from 'winston';
import { MonitoringService } from './monitoring.service';
import { PerformanceMetric, BusinessMetric, ErrorEvent } from './monitoring.types';

// Mock dependencies
jest.mock('pg');
jest.mock('redis');

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;
  let mockDb: jest.Mocked<Pool>;
  let mockRedis: jest.Mocked<Redis>;
  let mockLogger: jest.Mocked<winston.Logger>;

  beforeEach(() => {
    mockDb = {
      query: jest.fn(),
    } as any;

    mockRedis = {
      zadd: jest.fn(),
      expire: jest.fn(),
      incrbyfloat: jest.fn(),
      incr: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    monitoringService = new MonitoringService(mockDb, mockRedis, mockLogger);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recordPerformanceMetric', () => {
    it('should record performance metric successfully', async () => {
      const metric: PerformanceMetric = {
        endpoint: '/api/emails/send',
        method: 'POST',
        statusCode: 200,
        responseTime: 150,
        timestamp: new Date(),
        userId: 'user-123',
        tenantId: 'tenant-123'
      };

      mockDb.query.mockResolvedValueOnce({ rows: [] });
      mockRedis.zadd.mockResolvedValueOnce(1);
      mockRedis.expire.mockResolvedValueOnce(1);

      await monitoringService.recordPerformanceMetric(metric);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO performance_metrics'),
        expect.arrayContaining([
          metric.endpoint,
          metric.method,
          metric.statusCode,
          metric.responseTime,
          metric.timestamp,
          metric.userId,
          metric.tenantId,
          metric.errorMessage
        ])
      );

      expect(mockRedis.zadd).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalled();
    });

    it('should log warning for slow responses', async () => {
      const slowMetric: PerformanceMetric = {
        endpoint: '/api/emails/send',
        method: 'POST',
        statusCode: 200,
        responseTime: 3000, // 3 seconds - above threshold
        timestamp: new Date()
      };

      mockDb.query.mockResolvedValueOnce({ rows: [] });
      mockRedis.zadd.mockResolvedValueOnce(1);
      mockRedis.expire.mockResolvedValueOnce(1);

      await monitoringService.recordPerformanceMetric(slowMetric);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Slow response detected',
        expect.objectContaining({
          endpoint: slowMetric.endpoint,
          responseTime: slowMetric.responseTime
        })
      );
    });

    it('should handle database errors gracefully', async () => {
      const metric: PerformanceMetric = {
        endpoint: '/api/test',
        method: 'GET',
        statusCode: 200,
        responseTime: 100,
        timestamp: new Date()
      };

      const dbError = new Error('Database connection failed');
      mockDb.query.mockRejectedValueOnce(dbError);

      await monitoringService.recordPerformanceMetric(metric);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to record performance metric',
        expect.objectContaining({ error: dbError, metric })
      );
    });
  });

  describe('recordBusinessMetric', () => {
    it('should record business metric successfully', async () => {
      const metric: BusinessMetric = {
        name: 'emails_sent',
        value: 100,
        timestamp: new Date(),
        tenantId: 'tenant-123',
        userId: 'user-123',
        metadata: { campaign_id: 'campaign-456' }
      };

      mockDb.query.mockResolvedValueOnce({ rows: [] });
      mockRedis.incrbyfloat.mockResolvedValueOnce('100');
      mockRedis.expire.mockResolvedValueOnce(1);

      await monitoringService.recordBusinessMetric(metric);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO business_metrics'),
        expect.arrayContaining([
          metric.name,
          metric.value,
          metric.timestamp,
          metric.tenantId,
          metric.userId,
          JSON.stringify(metric.metadata)
        ])
      );

      expect(mockRedis.incrbyfloat).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith('Business metric recorded', metric);
    });
  });

  describe('recordError', () => {
    it('should record error event successfully', async () => {
      const error: ErrorEvent = {
        id: 'error-123',
        message: 'Database connection failed',
        stack: 'Error: Database connection failed\n    at ...',
        level: 'error',
        timestamp: new Date(),
        userId: 'user-123',
        tenantId: 'tenant-123',
        endpoint: '/api/emails/send',
        method: 'POST',
        metadata: { requestId: 'req-456' }
      };

      mockDb.query.mockResolvedValueOnce({ rows: [] });
      mockRedis.incr.mockResolvedValueOnce(1);
      mockRedis.expire.mockResolvedValueOnce(1);

      await monitoringService.recordError(error);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO error_events'),
        expect.arrayContaining([
          error.id,
          error.message,
          error.stack,
          error.level,
          error.timestamp,
          error.userId,
          error.tenantId,
          error.endpoint,
          error.method,
          JSON.stringify(error.metadata)
        ])
      );

      expect(mockRedis.incr).toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalledWith('Error event recorded', error);
    });
  });

  describe('getPerformanceMetrics', () => {
    it('should retrieve performance metrics successfully', async () => {
      const startTime = new Date('2023-01-01T00:00:00Z');
      const endTime = new Date('2023-01-01T23:59:59Z');
      const endpoint = '/api/emails/send';

      const mockRows = [
        {
          endpoint: '/api/emails/send',
          method: 'POST',
          status_code: 200,
          response_time: 150,
          timestamp: new Date(),
          user_id: 'user-123',
          tenant_id: 'tenant-123',
          error_message: null
        }
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockRows });

      const result = await monitoringService.getPerformanceMetrics(startTime, endTime, endpoint);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT endpoint, method, status_code'),
        [startTime, endTime, endpoint]
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        endpoint: mockRows[0].endpoint,
        method: mockRows[0].method,
        statusCode: mockRows[0].status_code,
        responseTime: mockRows[0].response_time,
        timestamp: mockRows[0].timestamp,
        userId: mockRows[0].user_id,
        tenantId: mockRows[0].tenant_id,
        errorMessage: mockRows[0].error_message
      });
    });

    it('should handle database errors and return empty array', async () => {
      const startTime = new Date();
      const endTime = new Date();

      mockDb.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await monitoringService.getPerformanceMetrics(startTime, endTime);

      expect(result).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to get performance metrics',
        expect.objectContaining({ error: expect.any(Error) })
      );
    });
  });

  describe('getBusinessMetricsSummary', () => {
    it('should retrieve business metrics summary successfully', async () => {
      const startTime = new Date('2023-01-01T00:00:00Z');
      const endTime = new Date('2023-01-01T23:59:59Z');
      const tenantId = 'tenant-123';

      const mockRows = [
        { name: 'emails_sent', total_value: '1500' },
        { name: 'subscriptions_created', total_value: '25' }
      ];

      mockDb.query.mockResolvedValueOnce({ rows: mockRows });

      const result = await monitoringService.getBusinessMetricsSummary(startTime, endTime, tenantId);

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT name, SUM(value)'),
        [startTime, endTime, tenantId]
      );

      expect(result).toEqual({
        emails_sent: 1500,
        subscriptions_created: 25
      });
    });
  });

  describe('getErrorRate', () => {
    it('should calculate error rate correctly', async () => {
      const startTime = new Date();
      const endTime = new Date();

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ error_count: '50' }] })
        .mockResolvedValueOnce({ rows: [{ total_requests: '1000' }] });

      const result = await monitoringService.getErrorRate(startTime, endTime);

      expect(result).toBe(0.05); // 50/1000 = 0.05 (5%)
    });

    it('should return 0 when no requests', async () => {
      const startTime = new Date();
      const endTime = new Date();

      mockDb.query
        .mockResolvedValueOnce({ rows: [{ error_count: '0' }] })
        .mockResolvedValueOnce({ rows: [{ total_requests: '0' }] });

      const result = await monitoringService.getErrorRate(startTime, endTime);

      expect(result).toBe(0);
    });
  });

  describe('getAverageResponseTime', () => {
    it('should calculate average response time correctly', async () => {
      const startTime = new Date();
      const endTime = new Date();

      mockDb.query.mockResolvedValueOnce({ 
        rows: [{ avg_response_time: '250.5' }] 
      });

      const result = await monitoringService.getAverageResponseTime(startTime, endTime);

      expect(result).toBe(250.5);
    });

    it('should return 0 when no data', async () => {
      const startTime = new Date();
      const endTime = new Date();

      mockDb.query.mockResolvedValueOnce({ 
        rows: [{ avg_response_time: null }] 
      });

      const result = await monitoringService.getAverageResponseTime(startTime, endTime);

      expect(result).toBe(0);
    });
  });

  describe('cleanupOldMetrics', () => {
    it('should cleanup old metrics successfully', async () => {
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await monitoringService.cleanupOldMetrics();

      expect(mockDb.query).toHaveBeenCalledTimes(3);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM performance_metrics'),
        expect.any(Array)
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM business_metrics'),
        expect.any(Array)
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM error_events'),
        expect.any(Array)
      );

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Old metrics data cleaned up',
        expect.objectContaining({ cutoffDate: expect.any(Date) })
      );
    });

    it('should handle cleanup errors gracefully', async () => {
      const dbError = new Error('Cleanup failed');
      mockDb.query.mockRejectedValueOnce(dbError);

      await monitoringService.cleanupOldMetrics();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to cleanup old metrics',
        expect.objectContaining({ error: dbError })
      );
    });
  });
});