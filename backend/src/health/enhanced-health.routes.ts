import { Router, Request, Response } from 'express';
import { EnhancedHealthMonitorService } from './enhanced-health-monitor.service';
import { ErrorHandlerMiddleware } from '../auth/error-handler.middleware';
import winston from 'winston';

const router = Router();

// Initialize enhanced health monitor
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

const enhancedHealthMonitor = new EnhancedHealthMonitorService(logger);

/**
 * GET /health/enhanced
 * Comprehensive health check with dependency validation
 */
router.get('/enhanced', ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  try {
    const healthStatus = await enhancedHealthMonitor.getEnhancedHealthStatus();
    
    const statusCode = healthStatus.overall === 'healthy' ? 200 :
                      healthStatus.overall === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json({
      success: healthStatus.overall !== 'unhealthy',
      data: healthStatus
    });
  } catch (error) {
    console.error('Enhanced health check failed:', error);
    res.status(503).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Enhanced health check failed',
        timestamp: new Date().toISOString()
      }
    });
  }
}));

/**
 * GET /health/startup
 * Get startup diagnostics
 */
router.get('/startup', ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  try {
    const diagnostics = enhancedHealthMonitor.getStartupDiagnostics();
    
    const hasErrors = diagnostics.some(d => d.status === 'error');
    const hasWarnings = diagnostics.some(d => d.status === 'warning');
    
    const statusCode = hasErrors ? 503 : 200;
    
    res.status(statusCode).json({
      success: !hasErrors,
      data: {
        diagnostics,
        summary: {
          total: diagnostics.length,
          success: diagnostics.filter(d => d.status === 'success').length,
          warnings: diagnostics.filter(d => d.status === 'warning').length,
          errors: diagnostics.filter(d => d.status === 'error').length
        }
      }
    });
  } catch (error) {
    console.error('Startup diagnostics check failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STARTUP_DIAGNOSTICS_FAILED',
        message: 'Failed to retrieve startup diagnostics',
        timestamp: new Date().toISOString()
      }
    });
  }
}));

/**
 * GET /health/dependencies
 * Check service dependencies
 */
router.get('/dependencies', ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  try {
    const healthStatus = await enhancedHealthMonitor.getEnhancedHealthStatus();
    
    const allDependenciesMet = Object.values(healthStatus.dependencies).every(Boolean);
    const statusCode = allDependenciesMet ? 200 : 503;
    
    res.status(statusCode).json({
      success: allDependenciesMet,
      data: {
        dependencies: healthStatus.dependencies,
        services: healthStatus.services,
        overall: healthStatus.overall,
        timestamp: healthStatus.timestamp
      }
    });
  } catch (error) {
    console.error('Dependencies check failed:', error);
    res.status(503).json({
      success: false,
      error: {
        code: 'DEPENDENCIES_CHECK_FAILED',
        message: 'Failed to check service dependencies',
        timestamp: new Date().toISOString()
      }
    });
  }
}));

/**
 * POST /health/validate
 * Trigger startup validation
 */
router.post('/validate', ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  try {
    // Clear previous diagnostics
    enhancedHealthMonitor.clearStartupDiagnostics();
    
    // Perform validation
    await enhancedHealthMonitor.performStartupValidation();
    
    const diagnostics = enhancedHealthMonitor.getStartupDiagnostics();
    const hasErrors = diagnostics.some(d => d.status === 'error');
    
    res.status(hasErrors ? 503 : 200).json({
      success: !hasErrors,
      data: {
        message: 'Startup validation completed',
        diagnostics,
        summary: {
          total: diagnostics.length,
          success: diagnostics.filter(d => d.status === 'success').length,
          warnings: diagnostics.filter(d => d.status === 'warning').length,
          errors: diagnostics.filter(d => d.status === 'error').length
        }
      }
    });
  } catch (error) {
    console.error('Startup validation failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STARTUP_VALIDATION_FAILED',
        message: 'Failed to perform startup validation',
        timestamp: new Date().toISOString()
      }
    });
  }
}));

/**
 * GET /health/system-info
 * Get comprehensive system information
 */
router.get('/system-info', ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  try {
    const healthStatus = await enhancedHealthMonitor.getEnhancedHealthStatus();
    
    const systemInfo = {
      application: {
        name: 'Bulk Email Platform Backend',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 8000,
        uptime: healthStatus.uptime
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        memory: process.memoryUsage(),
        cpuUsage: process.cpuUsage()
      },
      health: {
        overall: healthStatus.overall,
        services: Object.keys(healthStatus.services).length,
        dependencies: Object.keys(healthStatus.dependencies).length,
        startupDiagnostics: healthStatus.startup.length
      },
      timestamp: new Date().toISOString()
    };
    
    res.status(200).json({
      success: true,
      data: systemInfo
    });
  } catch (error) {
    console.error('System info check failed:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SYSTEM_INFO_FAILED',
        message: 'Failed to retrieve system information',
        timestamp: new Date().toISOString()
      }
    });
  }
}));

export { enhancedHealthMonitor };
export default router;