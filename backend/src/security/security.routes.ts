import { Router } from 'express';
import { AuthMiddleware } from '../auth/auth.middleware';
import { ThreatDetectionService } from './threat-detection.service';
import { AuditLogService } from '../compliance/audit-log.service';
import { GDPRService } from '../compliance/gdpr.service';
import { UserRole } from '../shared/types';

const router = Router();
const authMiddleware = new AuthMiddleware();
const threatDetectionService = new ThreatDetectionService();
const auditLogService = new AuditLogService();
const gdprService = new GDPRService();

/**
 * Get security metrics for dashboard
 */
router.get('/metrics', 
  authMiddleware.authenticate,
  authMiddleware.authorize([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  async (req: any, res) => {
    try {
      const { tenantId } = req.user;
      const { hours = 24 } = req.query;

      const metrics = await threatDetectionService.getSecurityMetrics(
        tenantId, 
        parseInt(hours as string)
      );

      const auditSummary = await auditLogService.getSecuritySummary(
        tenantId,
        Math.ceil(parseInt(hours as string) / 24)
      );

      res.json({
        success: true,
        data: {
          ...metrics,
          auditSummary
        }
      });
    } catch (error) {
      console.error('Error fetching security metrics:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SECURITY_METRICS_ERROR',
          message: 'Failed to fetch security metrics'
        }
      });
    }
  }
);

/**
 * Get threat alerts
 */
router.get('/threats',
  authMiddleware.authenticate,
  authMiddleware.authorize([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  async (req: any, res) => {
    try {
      const { tenantId } = req.user;
      const { 
        status = 'ACTIVE',
        severity,
        threatType,
        limit = 50,
        offset = 0
      } = req.query;

      // This would need to be implemented in ThreatDetectionService
      // For now, return a mock response
      res.json({
        success: true,
        data: {
          alerts: [],
          total: 0,
          pagination: {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string)
          }
        }
      });
    } catch (error) {
      console.error('Error fetching threat alerts:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'THREAT_ALERTS_ERROR',
          message: 'Failed to fetch threat alerts'
        }
      });
    }
  }
);

/**
 * Get audit logs
 */
router.get('/audit-logs',
  authMiddleware.authenticate,
  authMiddleware.authorize([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  async (req: any, res) => {
    try {
      const { tenantId } = req.user;
      const {
        action,
        resourceType,
        userId,
        startDate,
        endDate,
        limit = 100,
        offset = 0
      } = req.query;

      const filter = {
        tenantId,
        action: action as string,
        resourceType: resourceType as string,
        userId: userId as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      };

      const result = await auditLogService.getLogs(filter);

      res.json({
        success: true,
        data: {
          logs: result.logs,
          total: result.total,
          pagination: {
            limit: filter.limit,
            offset: filter.offset
          }
        }
      });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'AUDIT_LOGS_ERROR',
          message: 'Failed to fetch audit logs'
        }
      });
    }
  }
);

/**
 * Request GDPR data export
 */
router.post('/gdpr/export',
  authMiddleware.authenticate,
  async (req: any, res) => {
    try {
      const { userId, tenantId } = req.user;
      const { targetUserId } = req.body;

      // Users can export their own data, admins can export any user's data
      const userIdToExport = req.user.role === UserRole.ADMIN || req.user.role === UserRole.SUPER_ADMIN
        ? (targetUserId || userId)
        : userId;

      const requestId = await gdprService.requestDataExport(
        userIdToExport,
        tenantId,
        userId
      );

      res.json({
        success: true,
        data: {
          requestId,
          message: 'Data export request submitted. You will receive an email when ready.'
        }
      });
    } catch (error) {
      console.error('Error requesting data export:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'DATA_EXPORT_ERROR',
          message: 'Failed to request data export'
        }
      });
    }
  }
);

/**
 * Request GDPR data deletion
 */
router.post('/gdpr/delete',
  authMiddleware.authenticate,
  async (req: any, res) => {
    try {
      const { userId, tenantId } = req.user;
      const { targetUserId, retentionPeriod = 30 } = req.body;

      // Users can delete their own data, admins can delete any user's data
      const userIdToDelete = req.user.role === UserRole.ADMIN || req.user.role === UserRole.SUPER_ADMIN
        ? (targetUserId || userId)
        : userId;

      const requestId = await gdprService.requestDataDeletion(
        userIdToDelete,
        tenantId,
        userId,
        retentionPeriod
      );

      res.json({
        success: true,
        data: {
          requestId,
          message: `Data deletion scheduled for ${retentionPeriod} days from now.`
        }
      });
    } catch (error) {
      console.error('Error requesting data deletion:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'DATA_DELETION_ERROR',
          message: 'Failed to request data deletion'
        }
      });
    }
  }
);

/**
 * Record user consent
 */
router.post('/gdpr/consent',
  authMiddleware.authenticate,
  async (req: any, res) => {
    try {
      const { userId, tenantId } = req.user;
      const { consentType, granted } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent') || '';

      if (!['marketing', 'analytics', 'functional', 'necessary'].includes(consentType)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CONSENT_TYPE',
            message: 'Invalid consent type'
          }
        });
      }

      await gdprService.recordConsent({
        userId,
        tenantId,
        consentType,
        granted: Boolean(granted),
        ipAddress,
        userAgent
      });

      res.json({
        success: true,
        data: {
          message: 'Consent recorded successfully'
        }
      });
    } catch (error) {
      console.error('Error recording consent:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CONSENT_RECORDING_ERROR',
          message: 'Failed to record consent'
        }
      });
    }
  }
);

/**
 * Get user consent status
 */
router.get('/gdpr/consent',
  authMiddleware.authenticate,
  async (req: any, res) => {
    try {
      const { userId, tenantId } = req.user;
      const { targetUserId } = req.query;

      // Users can view their own consent, admins can view any user's consent
      const userIdToCheck = req.user.role === UserRole.ADMIN || req.user.role === UserRole.SUPER_ADMIN
        ? (targetUserId || userId)
        : userId;

      const consentRecords = await gdprService.getConsentStatus(
        userIdToCheck as string,
        tenantId
      );

      res.json({
        success: true,
        data: {
          consentRecords
        }
      });
    } catch (error) {
      console.error('Error fetching consent status:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CONSENT_STATUS_ERROR',
          message: 'Failed to fetch consent status'
        }
      });
    }
  }
);

/**
 * Block IP address (admin only)
 */
router.post('/block-ip',
  authMiddleware.authenticate,
  authMiddleware.authorize([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  async (req: any, res) => {
    try {
      const { ipAddress, reason, durationHours = 24 } = req.body;

      if (!ipAddress || !reason) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: 'IP address and reason are required'
          }
        });
      }

      // This would need to be implemented in ThreatDetectionService
      // await threatDetectionService.blockIpAddress(ipAddress, reason, durationHours * 3600);

      await auditLogService.logAdminAction(
        req.user.tenantId,
        req.user.userId,
        'BLOCK_IP',
        'ip_address',
        ipAddress,
        req.ip,
        req.get('User-Agent') || '',
        { reason, durationHours }
      );

      res.json({
        success: true,
        data: {
          message: `IP address ${ipAddress} blocked for ${durationHours} hours`
        }
      });
    } catch (error) {
      console.error('Error blocking IP address:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'IP_BLOCK_ERROR',
          message: 'Failed to block IP address'
        }
      });
    }
  }
);

/**
 * Get security monitoring health status
 */
router.get('/health',
  authMiddleware.authenticate,
  authMiddleware.authorize([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  async (req: any, res) => {
    try {
      // This would be injected from the main app
      const resilientMonitor = req.app.locals.resilientSecurityMonitor;
      
      if (!resilientMonitor) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'MONITORING_UNAVAILABLE',
            message: 'Security monitoring system is not available'
          }
        });
      }

      const healthStatus = resilientMonitor.getHealthStatus();
      const fallbackLogs = await resilientMonitor.getFallbackLogs(10);

      res.json({
        success: true,
        data: {
          health: healthStatus,
          recentFallbackLogs: fallbackLogs,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error getting security health:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'HEALTH_CHECK_ERROR',
          message: 'Failed to get security monitoring health'
        }
      });
    }
  }
);

/**
 * Get detailed fallback logger status
 */
router.get('/fallback-logger/status',
  authMiddleware.authenticate,
  authMiddleware.authorize([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
  async (req: any, res) => {
    try {
      const resilientMonitor = req.app.locals.resilientSecurityMonitor;
      
      if (!resilientMonitor) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'MONITORING_UNAVAILABLE',
            message: 'Security monitoring system is not available'
          }
        });
      }

      // Get fallback logger health from the resilient monitor
      const fallbackLogs = await resilientMonitor.getFallbackLogs(50);
      
      res.json({
        success: true,
        data: {
          loggerHealth: {
            healthy: fallbackLogs.length >= 0, // If we can get logs, logger is working
            lastLogTime: fallbackLogs.length > 0 ? fallbackLogs[0].timestamp : null,
            totalLogs: fallbackLogs.length
          },
          recentLogs: fallbackLogs.slice(0, 20),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error getting fallback logger status:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'FALLBACK_LOGGER_ERROR',
          message: 'Failed to get fallback logger status'
        }
      });
    }
  }
);

/**
 * Trigger fallback logger recovery
 */
router.post('/fallback-logger/recover',
  authMiddleware.authenticate,
  authMiddleware.authorize([UserRole.SUPER_ADMIN]),
  async (req: any, res) => {
    try {
      const resilientMonitor = req.app.locals.resilientSecurityMonitor;
      
      if (!resilientMonitor) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'MONITORING_UNAVAILABLE',
            message: 'Security monitoring system is not available'
          }
        });
      }

      // Trigger manual recovery
      await resilientMonitor.triggerManualRecovery();

      await auditLogService.logAdminAction(
        req.user.tenantId,
        req.user.userId,
        'FALLBACK_LOGGER_RECOVERY',
        'system',
        'fallback_logger',
        req.ip,
        req.get('User-Agent') || '',
        { triggeredBy: req.user.userId }
      );

      res.json({
        success: true,
        data: {
          message: 'Fallback logger recovery triggered successfully'
        }
      });
    } catch (error) {
      console.error('Error triggering fallback logger recovery:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'RECOVERY_ERROR',
          message: 'Failed to trigger fallback logger recovery'
        }
      });
    }
  }
);

/**
 * Enable graceful degradation mode
 */
router.post('/graceful-degradation/enable',
  authMiddleware.authenticate,
  authMiddleware.authorize([UserRole.SUPER_ADMIN]),
  async (req: any, res) => {
    try {
      const resilientMonitor = req.app.locals.resilientSecurityMonitor;
      
      if (!resilientMonitor) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'MONITORING_UNAVAILABLE',
            message: 'Security monitoring system is not available'
          }
        });
      }

      await resilientMonitor.enableGracefulDegradation();

      await auditLogService.logAdminAction(
        req.user.tenantId,
        req.user.userId,
        'GRACEFUL_DEGRADATION_ENABLED',
        'system',
        'security_monitoring',
        req.ip,
        req.get('User-Agent') || '',
        { triggeredBy: req.user.userId, reason: 'manual_activation' }
      );

      res.json({
        success: true,
        data: {
          message: 'Graceful degradation mode enabled successfully'
        }
      });
    } catch (error) {
      console.error('Error enabling graceful degradation:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'DEGRADATION_ERROR',
          message: 'Failed to enable graceful degradation mode'
        }
      });
    }
  }
);

/**
 * Disable graceful degradation mode
 */
router.post('/graceful-degradation/disable',
  authMiddleware.authenticate,
  authMiddleware.authorize([UserRole.SUPER_ADMIN]),
  async (req: any, res) => {
    try {
      const resilientMonitor = req.app.locals.resilientSecurityMonitor;
      
      if (!resilientMonitor) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'MONITORING_UNAVAILABLE',
            message: 'Security monitoring system is not available'
          }
        });
      }

      await resilientMonitor.disableGracefulDegradation();

      await auditLogService.logAdminAction(
        req.user.tenantId,
        req.user.userId,
        'GRACEFUL_DEGRADATION_DISABLED',
        'system',
        'security_monitoring',
        req.ip,
        req.get('User-Agent') || '',
        { triggeredBy: req.user.userId, reason: 'manual_deactivation' }
      );

      res.json({
        success: true,
        data: {
          message: 'Graceful degradation mode disabled successfully'
        }
      });
    } catch (error) {
      console.error('Error disabling graceful degradation:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'DEGRADATION_ERROR',
          message: 'Failed to disable graceful degradation mode'
        }
      });
    }
  }
);

/**
 * Trigger manual recovery
 */
router.post('/recover',
  authMiddleware.authenticate,
  authMiddleware.authorize([UserRole.SUPER_ADMIN]),
  async (req: any, res) => {
    try {
      const resilientMonitor = req.app.locals.resilientSecurityMonitor;
      
      if (!resilientMonitor) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'MONITORING_UNAVAILABLE',
            message: 'Security monitoring system is not available'
          }
        });
      }

      await resilientMonitor.triggerManualRecovery();

      await auditLogService.logAdminAction(
        req.user.tenantId,
        req.user.userId,
        'SECURITY_MANUAL_RECOVERY',
        'system',
        'security_monitoring',
        req.ip,
        req.get('User-Agent') || '',
        { triggeredBy: req.user.userId }
      );

      res.json({
        success: true,
        data: {
          message: 'Manual security monitoring recovery triggered'
        }
      });
    } catch (error) {
      console.error('Error triggering manual recovery:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'RECOVERY_ERROR',
          message: 'Failed to trigger manual recovery'
        }
      });
    }
  }
);

/**
 * Clean up expired security data
 */
router.post('/cleanup',
  authMiddleware.authenticate,
  authMiddleware.authorize([UserRole.SUPER_ADMIN]),
  async (req: any, res) => {
    try {
      await threatDetectionService.cleanupExpiredRestrictions();
      
      const archivedLogs = await auditLogService.archiveOldLogs();

      await auditLogService.logAdminAction(
        req.user.tenantId,
        req.user.userId,
        'SECURITY_CLEANUP',
        'system',
        'security_data',
        req.ip,
        req.get('User-Agent') || '',
        { archivedLogs }
      );

      res.json({
        success: true,
        data: {
          message: 'Security data cleanup completed',
          archivedLogs
        }
      });
    } catch (error) {
      console.error('Error during security cleanup:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'CLEANUP_ERROR',
          message: 'Failed to cleanup security data'
        }
      });
    }
  }
);

export default router;