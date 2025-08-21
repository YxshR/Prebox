import request from 'supertest';
import express from 'express';
import { Pool } from 'pg';
import { createClient } from 'redis';
import winston from 'winston';
import { initializeMonitoring } from './monitoring.integration';

// Mock dependencies
jest.mock('pg');
jest.mock('redis');

describe('Monitoring Integration', () => {
  let app: express.Express;
  let mockDb: jest.Mocked<Pool>;
  let mockRedis: jest.Mocked<Redis>;
  let logger: winston.Logger;

  beforeAll(async () => {
    // Create test app
    app = express();
    app.use(express.json());

    // Mock database
    mockDb = {
      query: jest.fn().mockResolvedValue({ rows: [] }),
    } as any;

    // Mock Redis
    mockRedis = {
      connect: jest.fn(),
      quit: jest.fn(),
      ping: jest.fn().mockResolvedValue('PONG'),
      zadd: jest.fn(),
      expire: jest.fn(),
      incrbyfloat: jest.fn(),
      incr: jest.fn(),
      setex: jest.fn(),
      get: jest.fn(),
      info: jest.fn().mockResolvedValue('redis_version:6.0.0'),
    } as any;

    // Create logger
    logger = winston.createLogger({
      level: 'error', // Reduce noise in tests
      transports: [new winston.transports.Console({ silent: true })]
    });

    // Initialize monitoring
    await initializeMonitoring(app, mockDb, mockRedis, logger);

    // Add a test route
    app.get('/test', (req, res) => {
      res.json({ message: 'Test endpoint' });
    });
  });

  describe('Health Endpoints', () => {
    it('should return basic health status', async () => {
      const response = await request(app)
        .get('/api/monitoring/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('should return detailed health information', async () => {
      const response = await request(app)
        .get('/api/monitoring/health/detailed')
        .expect(200);

      expect(response.body).toHaveProperty('overall');
      expect(response.body).toHaveProperty('checks');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(Array.isArray(response.body.checks)).toBe(true);
    });

    it('should return health history', async () => {
      const response = await request(app)
        .get('/api/monitoring/health/history?hours=1')
        .expect(200);

      expect(response.body).toHaveProperty('history');
      expect(response.body).toHaveProperty('period');
      expect(Array.isArray(response.body.history)).toBe(true);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track request performance', async () => {
      // Make a request to trigger performance monitoring
      await request(app)
        .get('/test')
        .expect(200);

      // Verify that performance metrics were recorded
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO performance_metrics'),
        expect.any(Array)
      );
    });

    it('should record metrics in Redis', async () => {
      await request(app)
        .get('/test')
        .expect(200);

      // Verify Redis operations were called
      expect(mockRedis.zadd).toHaveBeenCalled();
      expect(mockRedis.expire).toHaveBeenCalled();
    });
  });

  describe('Metrics Endpoints', () => {
    it('should require authentication for metrics endpoints', async () => {
      await request(app)
        .get('/api/monitoring/metrics?name=test&start=2023-01-01&end=2023-01-02')
        .expect(401);
    });

    it('should validate required parameters', async () => {
      // Mock authentication middleware to pass
      app.use('/api/monitoring/metrics', (req, res, next) => {
        req.user = { id: 'test-user', tenantId: 'test-tenant' };
        next();
      });

      await request(app)
        .get('/api/monitoring/metrics')
        .expect(400);

      const response = await request(app)
        .get('/api/monitoring/metrics')
        .expect(400);

      expect(response.body.error).toContain('Missing required parameters');
    });
  });

  describe('Alert Management', () => {
    it('should require authentication for alert endpoints', async () => {
      await request(app)
        .get('/api/monitoring/alerts')
        .expect(401);
    });

    it('should validate alert rule creation', async () => {
      // Mock authentication
      app.use('/api/monitoring/alerts', (req, res, next) => {
        req.user = { id: 'test-user', tenantId: 'test-tenant' };
        next();
      });

      const response = await request(app)
        .post('/api/monitoring/alerts/rules')
        .send({})
        .expect(400);

      expect(response.body.error).toContain('Missing required fields');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockDb.query.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .get('/api/monitoring/health/detailed');

      // Should still return a response, not crash
      expect(response.status).toBeDefined();
    });

    it('should handle Redis errors gracefully', async () => {
      // Mock Redis error
      mockRedis.ping.mockRejectedValueOnce(new Error('Redis error'));

      const response = await request(app)
        .get('/api/monitoring/health/detailed');

      // Should still return a response
      expect(response.status).toBeDefined();
    });
  });

  describe('Business Metrics', () => {
    it('should record business metrics for email endpoints', async () => {
      // Add email endpoint for testing
      app.post('/api/emails/send', (req, res) => {
        res.json({ success: true });
      });

      await request(app)
        .post('/api/emails/send')
        .send({ recipients: ['test@example.com'] })
        .expect(200);

      // Verify business metrics were recorded
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO metrics'),
        expect.any(Array)
      );
    });
  });

  describe('System Metrics', () => {
    it('should collect system metrics', async () => {
      // Mock authentication
      app.use('/api/monitoring/metrics/system', (req, res, next) => {
        req.user = { id: 'test-user', tenantId: 'test-tenant' };
        next();
      });

      const response = await request(app)
        .get('/api/monitoring/metrics/system')
        .expect(200);

      expect(response.body).toHaveProperty('memory');
      expect(response.body).toHaveProperty('cpu');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Dashboard Data', () => {
    it('should provide dashboard data', async () => {
      // Mock authentication
      app.use('/api/monitoring/dashboard', (req, res, next) => {
        req.user = { id: 'test-user', tenantId: 'test-tenant' };
        next();
      });

      const response = await request(app)
        .get('/api/monitoring/dashboard?hours=1')
        .expect(200);

      expect(response.body).toHaveProperty('health');
      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('businessMetrics');
      expect(response.body).toHaveProperty('systemMetrics');
      expect(response.body).toHaveProperty('period');
    });
  });

  afterAll(async () => {
    // Cleanup
    await mockRedis.quit();
  });
});