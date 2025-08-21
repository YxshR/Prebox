import request from 'supertest';
import express from 'express';
import securityRoutes from './security.routes';
import { ResilientSecurityMonitorService } from './resilient-security-monitor.service';
import winston from 'winston';

describe('Security Monitoring Routes Integration', () => {
  let app: express.Application;
  let securityMonitor: ResilientSecurityMonitorService;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Create a test logger
    const logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({ silent: true })
      ]
    });

    // Initialize security monitor
    securityMonitor = new ResilientSecurityMonitorService(logger);
    app.locals.resilientSecurityMonitor = securityMonitor;

    // Mock authentication middleware for testing
    app.use((req: any, res, next) => {
      req.user = {
        userId: 'test-user',
        tenantId: 'test-tenant',
        role: 'SUPER_ADMIN'
      };
      next();
    });

    app.use('/api/security', securityRoutes);
  });

  afterAll(() => {
    if (securityMonitor) {
      securityMonitor.destroy();
    }
  });

  describe('GET /api/security/health', () => {
    test('should return security monitoring health status', async () => {
      const response = await request(app)
        .get('/api/security/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.health).toBeDefined();
      expect(response.body.data.health.overall).toBeDefined();
      expect(response.body.data.health.lastCheck).toBeDefined();
      expect(response.body.data.recentFallbackLogs).toBeDefined();
      expect(Array.isArray(response.body.data.recentFallbackLogs)).toBe(true);
    });
  });

  describe('GET /api/security/fallback-logger/status', () => {
    test('should return fallback logger status', async () => {
      const response = await request(app)
        .get('/api/security/fallback-logger/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.loggerHealth).toBeDefined();
      expect(response.body.data.recentLogs).toBeDefined();
      expect(Array.isArray(response.body.data.recentLogs)).toBe(true);
    });
  });

  describe('POST /api/security/recover', () => {
    test('should trigger manual recovery', async () => {
      const response = await request(app)
        .post('/api/security/recover')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('recovery triggered');
    });
  });

  describe('POST /api/security/fallback-logger/recover', () => {
    test('should trigger fallback logger recovery', async () => {
      const response = await request(app)
        .post('/api/security/fallback-logger/recover')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('recovery triggered');
    });
  });

  describe('POST /api/security/graceful-degradation/enable', () => {
    test('should enable graceful degradation mode', async () => {
      const response = await request(app)
        .post('/api/security/graceful-degradation/enable')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('enabled');
    });
  });

  describe('POST /api/security/graceful-degradation/disable', () => {
    test('should disable graceful degradation mode', async () => {
      const response = await request(app)
        .post('/api/security/graceful-degradation/disable')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('disabled');
    });
  });

  describe('Error Handling', () => {
    test('should handle missing security monitor gracefully', async () => {
      // Temporarily remove the security monitor
      const originalMonitor = app.locals.resilientSecurityMonitor;
      delete app.locals.resilientSecurityMonitor;

      const response = await request(app)
        .get('/api/security/health')
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MONITORING_UNAVAILABLE');

      // Restore the monitor
      app.locals.resilientSecurityMonitor = originalMonitor;
    });
  });
});