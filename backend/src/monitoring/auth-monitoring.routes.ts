import { Router, Request, Response } from 'express';
import { AuthMonitoringService } from './auth-monitoring.service';
import { AuthMiddleware } from '../auth/auth.middleware';

const router = Router();
const authMiddleware = new AuthMiddleware();

// Middleware to get auth monitoring service from app locals
const getAuthMonitoringService = (req: Request): AuthMonitoringService => {
  const service = (req.app as any).locals.authMonitoringService;
  if (!service) {
    throw new Error('Auth monitoring service not initialized');
  }
  return service;
};

/**
 * Get authentication metrics for a time range
 */
router.get('/metrics', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { startTime, endTime } = req.query;
    
    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'startTime and endTime are required'
        }
      });
    }

    const authMonitoringService = getAuthMonitoringService(req);
    const metrics = await authMonitoringService.getAuthMetrics(
      new Date(startTime as string),
      new Date(endTime as string)
    );

    res.json({
      success: true,
      data: metrics
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'METRICS_FETCH_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * Get real-time authentication statistics
 */
router.get('/stats/realtime', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const authMonitoringService = getAuthMonitoringService(req);
    const stats = await authMonitoringService.getRealTimeStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'STATS_FETCH_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * Get authentication events for a specific user
 */
router.get('/events/user/:userId', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { limit } = req.query;

    const authMonitoringService = getAuthMonitoringService(req);
    const events = await authMonitoringService.getUserAuthEvents(
      userId,
      limit ? parseInt(limit as string) : 50
    );

    res.json({
      success: true,
      data: events
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'EVENTS_FETCH_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * Get authentication events for current user
 */
router.get('/events/me', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { limit } = req.query;

    const authMonitoringService = getAuthMonitoringService(req);
    const events = await authMonitoringService.getUserAuthEvents(
      userId,
      limit ? parseInt(limit as string) : 50
    );

    res.json({
      success: true,
      data: events
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'EVENTS_FETCH_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * Get authentication metrics dashboard data
 */
router.get('/dashboard', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { hours = 24 } = req.query;
    const hoursNum = parseInt(hours as string);
    
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (hoursNum * 60 * 60 * 1000));

    const authMonitoringService = getAuthMonitoringService(req);
    
    const [metrics, realTimeStats] = await Promise.all([
      authMonitoringService.getAuthMetrics(startTime, endTime),
      authMonitoringService.getRealTimeStats()
    ]);

    res.json({
      success: true,
      data: {
        timeRange: {
          startTime,
          endTime,
          hours: hoursNum
        },
        metrics,
        realTimeStats,
        summary: {
          totalAuthEvents: metrics.totalLogins + metrics.signupAttempts,
          successRate: metrics.totalLogins > 0 ? 
            (metrics.successfulLogins / metrics.totalLogins) * 100 : 0,
          signupConversionRate: metrics.signupAttempts > 0 ? 
            (metrics.completedSignups / metrics.signupAttempts) * 100 : 0,
          averageResponseTime: metrics.averageResponseTime
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'DASHBOARD_FETCH_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * Get authentication method breakdown
 */
router.get('/methods', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { startTime, endTime } = req.query;
    
    if (!startTime || !endTime) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'startTime and endTime are required'
        }
      });
    }

    const authMonitoringService = getAuthMonitoringService(req);
    const metrics = await authMonitoringService.getAuthMetrics(
      new Date(startTime as string),
      new Date(endTime as string)
    );

    res.json({
      success: true,
      data: {
        methodBreakdown: metrics.methodBreakdown,
        totalEvents: Object.values(metrics.methodBreakdown).reduce((sum, count) => sum + count, 0)
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'METHODS_FETCH_FAILED',
        message: error.message
      }
    });
  }
});

export default router;