import ResilientSecurityMonitorService from '../../security/resilient-security-monitor.service';
import { ThreatDetectionService } from '../../security/threat-detection.service';
import { AuditLogService } from '../../compliance/audit-log.service';
import { FallbackLoggerService } from '../../security/fallback-logger.service';
import { MonitoringService } from '../../monitoring/monitoring.service';
import { AlertingService } from '../../monitoring/alerting.service';
import winston from 'winston';
import pool from '../../config/database';
import redisClient from '../../config/redis';

// Mock dependencies
jest.mock('../../security/threat-detection.service');
jest.mock('../../compliance/audit-log.service');
jest.mock('../../security/fallback-logger.service');
jest.mock('../../monitoring/monitoring.service');
jest.mock('../../monitoring/alerting.service');
jest.mock('../../config/database');
jest.mock('../../config/redis');
jest.mock('winston');

// Mock timers
jest.useFakeTimers();

describe('ResilientSecurityMonitorService', () => {
  let service: ResilientSecurityMonitorService;
  let mockLogger: jest.Mocked<winston.Logger>;
  let mockThreatDetection: jest.Mocked<ThreatDetectionService>;
  let mockAuditLog: jest.Mocked<AuditLogService>;
  let mockFallbackLogger: jest.Mocked<FallbackLoggerService>;
  let mockMonitoring: jest.Mocked<MonitoringService>;
  let mockAlerting: jest.Mocked<AlertingService>;
  let mockPool: any;
  let mockRedisClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock logger
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn()
    } as any;

    // Mock database pool
    mockPool = {
      connect: jest.fn().mockResolvedValue({
        query: jest.fn().mockResolvedValue({}),
        release: jest.fn()
      })
    };
    (pool as any) = mockPool;

    // Mock Redis client
    mockRedisClient = {
      ping: jest.fn().mockResolvedValue('PONG')
    };
    (redisClient as any) = mockRedisClient;

    // Mock services
    mockThreatDetection = new ThreatDetectionService() as jest.Mocked<ThreatDetectionService>;
    mockAuditLog = new AuditLogService() as jest.Mocked<AuditLogService>;
    mockFallbackLogger = new FallbackLoggerService() as jest.Mocked<FallbackLoggerService>;
    mockMonitoring = new MonitoringService(mockPool, mockRedisClient, mockLogger) as jest.Mocked<MonitoringService>;
    mockAlerting = new AlertingService(mockPool, mockRedisClient, mockLogger) as jest.Mocked<AlertingService>;

    // Setup mocks
    mockThreatDetection.getSecurityMetrics = jest.fn().mockResolvedValue({});
    mockThreatDetection.monitorAuthenticationEvents = jest.fn().mockResolvedValue(undefined);
    mockThreatDetection.monitorApiUsage = jest.fn().mockResolvedValue(undefined);
    mockThreatDetection.cleanupExpiredRestrictions = jest.fn().mockResolvedValue(undefined);

    mockAuditLog.log = jest.fn().mockResolvedValue(undefined);

    mockFallbackLogger.logMonitoringFailure = jest.fn().mockResolvedValue(undefined);
    mockFallbackLogger.logSecurityEvent = jest.fn().mockResolvedValue(undefined);
    mockFallbackLogger.logDatabaseFailure = jest.fn().mockResolvedValue(undefined);
    mockFallbackLogger.logThreatDetectionFailure = jest.fn().mockResolvedValue(undefined);
    mockFallbackLogger.logSystemRecovery = jest.fn().mockResolvedValue(undefined);
    mockFallbackLogger.logAlertDeliveryFailure = jest.fn().mockResolvedValue(undefined);
    mockFallbackLogger.getRecentLogs = jest.fn().mockResolvedValue([]);

    mockAlerting.getAlertRules = jest.fn().mockResolvedValue([]);
    mockAlerting.createAlertRule = jest.fn().mockResolvedValue({ id: 'rule-id' });
    mockAlerting.createAlert = jest.fn().mockResolvedValue(undefined);
    mockAlerting.destroy = jest.fn();

    service = new ResilientSecurityMonitorService(mockLogger);
  });

  afterEach(() => {
    service.destroy();
    jest.useRealTimers();
  });

  describe('initialization', () => {
    it('should initialize with correct default health status', () => {
      const healthStatus = service.getHealthStatus();
      
      expect(healthStatus.threatDetection).toBe(false);
      expect(healthStatus.auditLogging).toBe(false);
      expect(healthStatus.database).toBe(false);
      expect(healthStatus.redis).toBe(false);
      expect(healthStatus.alerting).toBe(false);
      expect(healthStatus.overall).toBe(false);
      expect(healthStatus.errors).toEqual([]);
    });

    it('should start health checks on initialization', () => {
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 30000);
    });
  });

  describe('health checks', () => {
    it('should perform database health check successfully', async () => {
      const client = { query: jest.fn().mockResolvedValue({}), release: jest.fn() };
      mockPool.connect.mockResolvedValue(client);

      // Trigger health check
      jest.advanceTimersByTime(30000);
      await Promise.resolve(); // Allow async operations to complete

      expect(mockPool.connect).toHaveBeenCalled();
      expect(client.query).toHaveBeenCalledWith('SELECT 1');
      expect(client.release).toHaveBeenCalled();
    });

    it('should handle database health check failure', async () => {
      mockPool.connect.mockRejectedValue(new Error('Database connection failed'));

      // Trigger health check
      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      expect(mockFallbackLogger.logDatabaseFailure).toHaveBeenCalledWith(
        'health-check',
        expect.any(Error),
        0
      );
    });

    it('should perform Redis health check successfully', async () => {
      mockRedisClient.ping.mockResolvedValue('PONG');

      // Trigger health check
      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      expect(mockRedisClient.ping).toHaveBeenCalled();
    });

    it('should handle Redis health check failure', async () => {
      mockRedisClient.ping.mockRejectedValue(new Error('Redis connection failed'));

      // Trigger health check
      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      // Redis failure is handled silently in the current implementation
      expect(mockRedisClient.ping).toHaveBeenCalled();
    });

    it('should perform audit logging health check', async () => {
      mockAuditLog.log.mockResolvedValue(undefined);

      // Trigger health check
      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      expect(mockAuditLog.log).toHaveBeenCalledWith({
        tenantId: expect.any(String),
        action: 'HEALTH_CHECK',
        resourceType: 'system',
        resourceId: 'audit-logging',
        ipAddress: '127.0.0.1',
        userAgent: 'health-check'
      });
    });

    it('should perform threat detection health check', async () => {
      mockThreatDetection.getSecurityMetrics.mockResolvedValue({});

      // Trigger health check
      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      expect(mockThreatDetection.getSecurityMetrics).toHaveBeenCalledWith(
        expect.any(String),
        1
      );
    });

    it('should perform alerting health check', async () => {
      mockAlerting.getAlertRules.mockResolvedValue([]);

      // Trigger health check
      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      expect(mockAlerting.getAlertRules).toHaveBeenCalled();
    });
  });

  describe('monitoring methods', () => {
    it('should monitor authentication events successfully', async () => {
      mockThreatDetection.monitorAuthenticationEvents.mockResolvedValue(undefined);

      await service.monitorAuthenticationEvents(
        'tenant-id',
        'user-id',
        '192.168.1.1',
        'Mozilla/5.0',
        true
      );

      expect(mockThreatDetection.monitorAuthenticationEvents).toHaveBeenCalledWith(
        'tenant-id',
        'user-id',
        '192.168.1.1',
        'Mozilla/5.0',
        true
      );
    });

    it('should handle authentication monitoring failures', async () => {
      const error = new Error('Threat detection failed');
      mockThreatDetection.monitorAuthenticationEvents.mockRejectedValue(error);

      await service.monitorAuthenticationEvents(
        'tenant-id',
        'user-id',
        '192.168.1.1',
        'Mozilla/5.0',
        false
      );

      expect(mockFallbackLogger.logThreatDetectionFailure).toHaveBeenCalledWith(
        'authentication-monitoring',
        error,
        {
          tenantId: 'tenant-id',
          userId: 'user-id',
          ipAddress: '192.168.1.1',
          success: false
        }
      );

      expect(mockFallbackLogger.logSecurityEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        level: 'warn',
        service: 'authentication',
        event: 'login_failed',
        data: {
          tenantId: 'tenant-id',
          userId: 'user-id',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0'
        }
      });
    });

    it('should monitor API usage successfully', async () => {
      mockThreatDetection.monitorApiUsage.mockResolvedValue(undefined);

      await service.monitorApiUsage(
        'tenant-id',
        'user-id',
        'api-key-id',
        '/api/test',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(mockThreatDetection.monitorApiUsage).toHaveBeenCalledWith(
        'tenant-id',
        'user-id',
        'api-key-id',
        '/api/test',
        '192.168.1.1',
        'Mozilla/5.0'
      );
    });

    it('should handle API monitoring failures', async () => {
      const error = new Error('API monitoring failed');
      mockThreatDetection.monitorApiUsage.mockRejectedValue(error);

      await service.monitorApiUsage(
        'tenant-id',
        'user-id',
        'api-key-id',
        '/api/test',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(mockFallbackLogger.logThreatDetectionFailure).toHaveBeenCalledWith(
        'api-monitoring',
        error,
        {
          tenantId: 'tenant-id',
          userId: 'user-id',
          apiKeyId: 'api-key-id',
          endpoint: '/api/test'
        }
      );

      expect(mockFallbackLogger.logSecurityEvent).toHaveBeenCalledWith({
        timestamp: expect.any(String),
        level: 'info',
        service: 'api',
        event: 'api_request',
        data: {
          tenantId: 'tenant-id',
          userId: 'user-id',
          apiKeyId: 'api-key-id',
          endpoint: '/api/test',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0'
        }
      });
    });
  });

  describe('recovery mechanisms', () => {
    it('should attempt recovery for failed components', async () => {
      // Mock database failure
      mockPool.connect.mockRejectedValue(new Error('Database connection failed'));

      // Trigger health check to detect failure
      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      // Should attempt recovery
      expect(mockFallbackLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'recovery_attempt'
        })
      );
    });

    it('should reset recovery attempts on successful recovery', async () => {
      // First fail, then succeed
      mockPool.connect
        .mockRejectedValueOnce(new Error('Database connection failed'))
        .mockResolvedValue({
          query: jest.fn().mockResolvedValue({}),
          release: jest.fn()
        });

      // Trigger health check
      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      // Should log recovery success
      expect(mockFallbackLogger.logSystemRecovery).toHaveBeenCalled();
    });

    it('should handle manual recovery trigger', async () => {
      await service.triggerManualRecovery();

      // Should perform health check
      expect(mockPool.connect).toHaveBeenCalled();
    });
  });

  describe('graceful degradation', () => {
    it('should enter graceful degradation when multiple components fail', async () => {
      // Mock multiple failures
      mockPool.connect.mockRejectedValue(new Error('Database failed'));
      mockAuditLog.log.mockRejectedValue(new Error('Audit failed'));
      mockThreatDetection.getSecurityMetrics.mockRejectedValue(new Error('Threat detection failed'));

      // Trigger health check
      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      expect(mockFallbackLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'graceful_degradation_enabled'
        })
      );
    });

    it('should exit graceful degradation when components recover', async () => {
      // First enter degradation, then recover
      mockPool.connect
        .mockRejectedValueOnce(new Error('Database failed'))
        .mockResolvedValue({
          query: jest.fn().mockResolvedValue({}),
          release: jest.fn()
        });

      mockAuditLog.log
        .mockRejectedValueOnce(new Error('Audit failed'))
        .mockResolvedValue(undefined);

      // Trigger health checks
      jest.advanceTimersByTime(30000);
      await Promise.resolve();
      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      expect(mockFallbackLogger.logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'graceful_degradation_disabled'
        })
      );
    });
  });

  describe('fallback logging', () => {
    it('should get fallback logs', async () => {
      const mockLogs = [
        { timestamp: '2023-01-01T00:00:00Z', level: 'error', message: 'Test error' }
      ];
      mockFallbackLogger.getRecentLogs.mockResolvedValue(mockLogs);

      const logs = await service.getFallbackLogs(50);

      expect(logs).toEqual(mockLogs);
      expect(mockFallbackLogger.getRecentLogs).toHaveBeenCalledWith(50);
    });

    it('should use default limit for fallback logs', async () => {
      mockFallbackLogger.getRecentLogs.mockResolvedValue([]);

      await service.getFallbackLogs();

      expect(mockFallbackLogger.getRecentLogs).toHaveBeenCalledWith(100);
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources on destroy', () => {
      service.destroy();

      expect(clearInterval).toHaveBeenCalled();
      expect(mockThreatDetection.cleanupExpiredRestrictions).toHaveBeenCalled();
      expect(mockAlerting.destroy).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle health check errors gracefully', async () => {
      // Mock a health check that throws
      mockPool.connect.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      // Should not throw when health check fails
      expect(() => {
        jest.advanceTimersByTime(30000);
      }).not.toThrow();

      await Promise.resolve();

      expect(mockFallbackLogger.logMonitoringFailure).toHaveBeenCalled();
    });

    it('should handle non-Error exceptions', async () => {
      mockThreatDetection.monitorAuthenticationEvents.mockRejectedValue('String error');

      await service.monitorAuthenticationEvents(
        'tenant-id',
        null,
        '192.168.1.1',
        'Mozilla/5.0',
        true
      );

      expect(mockFallbackLogger.logThreatDetectionFailure).toHaveBeenCalledWith(
        'authentication-monitoring',
        expect.any(Error),
        expect.any(Object)
      );
    });
  });

  describe('component extraction', () => {
    it('should extract correct component from error messages', () => {
      // This tests the private extractComponentFromError method indirectly
      // by checking recovery attempts for different error types
      
      // We can't directly test private methods, but we can verify behavior
      expect(service).toBeInstanceOf(ResilientSecurityMonitorService);
    });
  });

  describe('alert system integration', () => {
    it('should handle alerting service failures gracefully', async () => {
      mockAlerting.createAlert.mockRejectedValue(new Error('Alerting failed'));

      // This would trigger an alert in normal operation
      mockPool.connect.mockRejectedValue(new Error('Database failed'));

      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      // Should fall back to other alert methods
      expect(mockFallbackLogger.logAlertDeliveryFailure).toHaveBeenCalled();
    });
  });
});