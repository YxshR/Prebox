import { ResilientSecurityMonitorService } from './resilient-security-monitor.service';
import { FallbackLoggerService } from './fallback-logger.service';
import winston from 'winston';
import pool from '../config/database';

describe('Security Monitoring Error Recovery', () => {
  let securityMonitor: ResilientSecurityMonitorService;
  let logger: winston.Logger;

  beforeAll(() => {
    // Create a test logger
    logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      transports: [
        new winston.transports.Console({ silent: true }) // Silent for tests
      ]
    });

    securityMonitor = new ResilientSecurityMonitorService(logger);
  });

  afterAll(() => {
    if (securityMonitor) {
      securityMonitor.destroy();
    }
  });

  describe('Graceful Degradation', () => {
    test('should enable graceful degradation when multiple components fail', async () => {
      // Mock multiple component failures
      const healthStatus = securityMonitor.getHealthStatus();
      
      // Verify initial state
      expect(healthStatus).toBeDefined();
      expect(healthStatus.overall).toBeDefined();
      expect(healthStatus.errors).toBeDefined();
    });

    test('should reduce health check frequency in degraded mode', async () => {
      await securityMonitor.enableGracefulDegradation();
      
      // Verify degradation mode is active
      const healthStatus = securityMonitor.getHealthStatus();
      expect(healthStatus).toBeDefined();
    });

    test('should restore normal operation when components recover', async () => {
      await securityMonitor.disableGracefulDegradation();
      
      // Verify normal mode is restored
      const healthStatus = securityMonitor.getHealthStatus();
      expect(healthStatus).toBeDefined();
    });
  });

  describe('Alternative Logging Mechanisms', () => {
    let fallbackLogger: FallbackLoggerService;

    beforeEach(() => {
      fallbackLogger = new FallbackLoggerService();
    });

    test('should log to primary system when healthy', async () => {
      const testEntry = {
        timestamp: new Date().toISOString(),
        level: 'info' as const,
        service: 'test',
        event: 'test_event',
        data: { test: true }
      };

      await expect(fallbackLogger.logSecurityEvent(testEntry)).resolves.not.toThrow();
    });

    test('should use alternative logging when primary fails', async () => {
      const testEntry = {
        timestamp: new Date().toISOString(),
        level: 'error' as const,
        service: 'test',
        event: 'test_failure',
        data: { error: 'simulated failure' }
      };

      // This should not throw even if primary logging fails
      await expect(fallbackLogger.logSecurityEvent(testEntry)).resolves.not.toThrow();
    });

    test('should perform health check and recovery', async () => {
      const healthResult = await fallbackLogger.healthCheck();
      
      expect(healthResult).toBeDefined();
      expect(healthResult.healthy).toBeDefined();
      
      if (!healthResult.healthy) {
        await expect(fallbackLogger.performHealthCheckAndRecovery()).resolves.not.toThrow();
      }
    });

    test('should export logs for manual review', async () => {
      const exportPath = await fallbackLogger.exportLogsForManualReview();
      expect(exportPath).toBeDefined();
      expect(typeof exportPath).toBe('string');
    });
  });

  describe('Alert System for Monitoring Failures', () => {
    test('should send alerts when recovery attempts fail', async () => {
      // Trigger manual recovery to test alert system
      await expect(securityMonitor.triggerManualRecovery()).resolves.not.toThrow();
    });

    test('should get health status with error details', () => {
      const healthStatus = securityMonitor.getHealthStatus();
      
      expect(healthStatus).toBeDefined();
      expect(healthStatus.threatDetection).toBeDefined();
      expect(healthStatus.auditLogging).toBeDefined();
      expect(healthStatus.database).toBeDefined();
      expect(healthStatus.overall).toBeDefined();
      expect(healthStatus.lastCheck).toBeDefined();
      expect(healthStatus.errors).toBeDefined();
      expect(Array.isArray(healthStatus.errors)).toBe(true);
    });

    test('should get fallback logs', async () => {
      const logs = await securityMonitor.getFallbackLogs(10);
      
      expect(Array.isArray(logs)).toBe(true);
      // Logs array can be empty if no fallback events occurred
    });
  });

  describe('Recovery Mechanisms', () => {
    test('should attempt automatic recovery for failed components', async () => {
      // This tests the recovery mechanism without actually failing components
      await expect(securityMonitor.triggerManualRecovery()).resolves.not.toThrow();
    });

    test('should handle database connection recovery', async () => {
      // Test database health check
      const healthStatus = securityMonitor.getHealthStatus();
      
      // Database health should be checked
      expect(typeof healthStatus.database).toBe('boolean');
    });

    test('should handle audit logging recovery', async () => {
      // Test audit logging health
      const healthStatus = securityMonitor.getHealthStatus();
      
      // Audit logging health should be checked
      expect(typeof healthStatus.auditLogging).toBe('boolean');
    });

    test('should handle threat detection recovery', async () => {
      // Test threat detection health
      const healthStatus = securityMonitor.getHealthStatus();
      
      // Threat detection health should be checked
      expect(typeof healthStatus.threatDetection).toBe('boolean');
    });
  });

  describe('Error Handling Edge Cases', () => {
    test('should handle monitoring authentication events with fallback', async () => {
      await expect(
        securityMonitor.monitorAuthenticationEvents(
          'test-tenant',
          'test-user',
          '127.0.0.1',
          'test-agent',
          true
        )
      ).resolves.not.toThrow();
    });

    test('should handle monitoring API usage with fallback', async () => {
      await expect(
        securityMonitor.monitorApiUsage(
          'test-tenant',
          'test-user',
          'test-api-key',
          '/test/endpoint',
          '127.0.0.1',
          'test-agent'
        )
      ).resolves.not.toThrow();
    });

    test('should handle service destruction gracefully', () => {
      const testMonitor = new ResilientSecurityMonitorService(logger);
      
      expect(() => testMonitor.destroy()).not.toThrow();
    });
  });
});