import { Router, Request, Response } from 'express';
import { healthService } from './health.service';
import { ErrorHandlerMiddleware } from '../auth/error-handler.middleware';
import enhancedHealthRoutes from './enhanced-health.routes';

const router = Router();

// Mount enhanced health routes
router.use('/', enhancedHealthRoutes);

/**
 * GET /health
 * Simple health check for load balancers
 */
router.get('/', ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Add timeout to prevent hanging requests
    const healthPromise = healthService.getSimpleHealth();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Health check timeout')), 5000)
    );
    
    const health = await Promise.race([healthPromise, timeoutPromise]);
    
    // Add response time header
    res.setHeader('X-Response-Time', (Date.now() - startTime).toString());
    
    res.status(200).json({
      success: true,
      data: {
        ...health,
        timestamp: new Date().toISOString(),
        version: process.env.API_VERSION || 'v1',
        responseTime: Date.now() - startTime
      }
    });
  } catch (error) {
    console.error('Health check failed:', error);
    
    // Add response time even for errors
    res.setHeader('X-Response-Time', (Date.now() - startTime).toString());
    
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNHEALTHY',
        message: 'Service is currently unhealthy',
        timestamp: new Date().toISOString(),
        retryable: true,
        responseTime: Date.now() - startTime
      }
    });
  }
}));

/**
 * GET /health/detailed
 * Comprehensive health check with all service statuses
 */
router.get('/detailed', ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const healthStatus = await healthService.getHealthStatus();
  
  const statusCode = healthStatus.status === 'healthy' ? 200 :
                    healthStatus.status === 'degraded' ? 200 : 503;
  
  res.status(statusCode).json({
    success: healthStatus.status !== 'unhealthy',
    data: healthStatus
  });
}));

/**
 * GET /health/ready
 * Kubernetes readiness probe
 */
router.get('/ready', ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const readiness = await healthService.getReadinessStatus();
  
  if (readiness.ready) {
    res.status(200).json({
      success: true,
      data: {
        ready: true,
        message: 'Service is ready to accept traffic',
        services: readiness.services
      }
    });
  } else {
    res.status(503).json({
      success: false,
      data: {
        ready: false,
        message: 'Service is not ready to accept traffic',
        services: readiness.services
      }
    });
  }
}));

/**
 * GET /health/live
 * Kubernetes liveness probe
 */
router.get('/live', ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const liveness = await healthService.getLivenessStatus();
  
  res.status(200).json({
    success: true,
    data: {
      alive: liveness.alive,
      uptime: liveness.uptime,
      message: 'Service is alive'
    }
  });
}));

/**
 * GET /health/metrics
 * Basic performance metrics
 */
router.get('/metrics', ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const healthStatus = await healthService.getHealthStatus();
  
  res.status(200).json({
    success: true,
    data: {
      performance: healthStatus.performance,
      uptime: healthStatus.uptime,
      timestamp: healthStatus.timestamp
    }
  });
}));

/**
 * GET /health/connection
 * Connection status and diagnostics
 */
router.get('/connection', ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    // Test database connection
    const dbStatus = await healthService.checkDatabaseConnection();
    
    // Test Redis connection
    const redisStatus = await healthService.checkRedisConnection();
    
    const responseTime = Date.now() - startTime;
    
    const connectionStatus = {
      database: dbStatus,
      redis: redisStatus,
      responseTime,
      timestamp: new Date().toISOString(),
      server: {
        port: process.env.PORT || 3001,
        environment: process.env.NODE_ENV || 'development',
        version: process.env.API_VERSION || 'v1'
      }
    };
    
    const allHealthy = dbStatus.healthy && redisStatus.healthy;
    
    res.status(allHealthy ? 200 : 503).json({
      success: allHealthy,
      data: connectionStatus
    });
  } catch (error) {
    console.error('Connection check failed:', error);
    res.status(503).json({
      success: false,
      error: {
        code: 'CONNECTION_CHECK_FAILED',
        message: 'Failed to check connection status',
        timestamp: new Date().toISOString()
      }
    });
  }
}));

/**
 * GET /health/cors-test
 * CORS configuration test endpoint
 */
router.get('/cors-test', (req: Request, res: Response) => {
  res.setHeader('X-CORS-Test', 'success');
  res.json({
    success: true,
    data: {
      message: 'CORS is working correctly',
      origin: req.headers.origin || 'no-origin',
      timestamp: new Date().toISOString(),
      headers: {
        'access-control-allow-origin': res.getHeader('Access-Control-Allow-Origin'),
        'access-control-allow-credentials': res.getHeader('Access-Control-Allow-Credentials'),
        'access-control-allow-methods': res.getHeader('Access-Control-Allow-Methods')
      }
    }
  });
});

export default router;