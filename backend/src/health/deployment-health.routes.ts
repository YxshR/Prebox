import { Router, Request, Response } from 'express';
import { ComprehensiveHealthService } from './comprehensive-health.service';
import db from '../config/database';
import redisClient from '../config/redis';
import winston from 'winston';

const router = Router();

// Initialize comprehensive health service
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console()
  ]
});

const comprehensiveHealthService = new ComprehensiveHealthService(db, redisClient, logger);

/**
 * Kubernetes/Docker health check endpoint
 * Returns 200 OK if service is healthy, 503 if unhealthy
 */
router.get('/live', async (req: Request, res: Response) => {
  try {
    const health = await comprehensiveHealthService.getLivenessStatus();
    
    if (health.alive) {
      res.status(200).json({
        status: 'alive',
        uptime: health.uptime,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'dead',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: any) {
    res.status(503).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Kubernetes/Docker readiness check endpoint
 * Returns 200 OK if service is ready to accept traffic
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const readiness = await comprehensiveHealthService.getReadinessStatus();
    
    if (readiness.ready) {
      res.status(200).json({
        status: 'ready',
        services: readiness.services,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        services: readiness.services,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: any) {
    res.status(503).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Comprehensive health check for monitoring systems
 */
router.get('/comprehensive', async (req: Request, res: Response) => {
  try {
    const health = await comprehensiveHealthService.getComprehensiveHealth();
    
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Deployment readiness check
 * Used by CI/CD pipelines to verify deployment success
 */
router.get('/deployment', async (req: Request, res: Response) => {
  try {
    const deployment = await comprehensiveHealthService.getDeploymentReadiness();
    
    if (deployment.ready) {
      res.status(200).json({
        status: 'ready',
        message: 'Deployment is ready for traffic',
        services: deployment.services,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not_ready',
        message: 'Deployment has issues',
        issues: deployment.issues,
        services: deployment.services,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Service-specific health checks
 */
router.get('/services/:serviceName', async (req: Request, res: Response) => {
  try {
    const { serviceName } = req.params;
    const health = await comprehensiveHealthService.getComprehensiveHealth();
    
    const service = health.services[serviceName as keyof typeof health.services];
    
    if (!service) {
      return res.status(404).json({
        status: 'error',
        error: `Service ${serviceName} not found`,
        availableServices: Object.keys(health.services)
      });
    }

    const statusCode = service.status === 'healthy' ? 200 :
                      service.status === 'degraded' ? 200 : 503;

    res.status(statusCode).json({
      service: serviceName,
      ...service,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Authentication service specific health check
 */
router.get('/auth', async (req: Request, res: Response) => {
  try {
    const health = await comprehensiveHealthService.getComprehensiveHealth();
    const authHealth = health.services.auth;
    
    const statusCode = authHealth.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      service: 'authentication',
      status: authHealth.status,
      details: authHealth.details,
      error: authHealth.error,
      responseTime: authHealth.responseTime,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Database health check with connection details
 */
router.get('/database', async (req: Request, res: Response) => {
  try {
    const dbHealth = await comprehensiveHealthService.checkDatabaseConnection();
    
    const statusCode = dbHealth.healthy ? 200 : 503;
    
    res.status(statusCode).json({
      service: 'database',
      healthy: dbHealth.healthy,
      responseTime: dbHealth.responseTime,
      error: dbHealth.error,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Redis health check with connection details
 */
router.get('/redis', async (req: Request, res: Response) => {
  try {
    const redisHealth = await comprehensiveHealthService.checkRedisConnection();
    
    const statusCode = redisHealth.healthy ? 200 : 503;
    
    res.status(statusCode).json({
      service: 'redis',
      healthy: redisHealth.healthy,
      responseTime: redisHealth.responseTime,
      error: redisHealth.error,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Performance metrics endpoint
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const health = await comprehensiveHealthService.getComprehensiveHealth();
    
    res.status(200).json({
      performance: health.performance,
      uptime: health.uptime,
      version: health.version,
      environment: health.environment,
      deployment: health.deployment,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;