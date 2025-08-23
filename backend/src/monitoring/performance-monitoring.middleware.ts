import { Request, Response, NextFunction } from 'express';
import { MonitoringService } from './monitoring.service';
import { AuthMonitoringService } from './auth-monitoring.service';

export interface PerformanceRequest extends Request {
  performance?: {
    startTime: number;
    endpoint: string;
    method: string;
    userId?: string;
    tenantId?: string;
  };
}

export class PerformanceMonitoringMiddleware {
  private monitoringService: MonitoringService;
  private authMonitoringService?: AuthMonitoringService;

  constructor(monitoringService: MonitoringService, authMonitoringService?: AuthMonitoringService) {
    this.monitoringService = monitoringService;
    this.authMonitoringService = authMonitoringService;
  }

  /**
   * General performance monitoring middleware
   */
  trackPerformance = (req: PerformanceRequest, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    req.performance = {
      startTime,
      endpoint: req.path,
      method: req.method,
      userId: (req as any).user?.id,
      tenantId: (req as any).user?.tenantId
    };

    // Override res.end to capture response metrics
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      const responseTime = Date.now() - startTime;
      
      // Record performance metric
      setImmediate(() => {
        monitoringService.recordPerformanceMetric({
          endpoint: req.performance!.endpoint,
          method: req.performance!.method,
          statusCode: res.statusCode,
          responseTime,
          timestamp: new Date(),
          userId: req.performance!.userId,
          tenantId: req.performance!.tenantId,
          errorMessage: res.statusCode >= 400 ? 'HTTP Error' : undefined
        });
      });

      return originalEnd.call(this, chunk, encoding);
    };

    next();
  };

  /**
   * Authentication-specific performance monitoring
   */
  trackAuthPerformance = (req: PerformanceRequest, res: Response, next: NextFunction) => {
    if (!this.authMonitoringService) {
      return next();
    }

    const startTime = Date.now();
    
    req.performance = {
      startTime,
      endpoint: req.path,
      method: req.method,
      userId: (req as any).user?.id,
      tenantId: (req as any).user?.tenantId
    };

    // Override res.json to capture auth-specific metrics
    const originalJson = res.json;
    res.json = function(body: any) {
      const responseTime = Date.now() - startTime;
      const success = res.statusCode >= 200 && res.statusCode < 400;

      // Determine auth event type based on endpoint
      let eventType: string = 'login_attempt';
      let method: string = 'email_password';

      if (req.path.includes('/signup')) {
        eventType = success ? 'signup_complete' : 'signup_start';
      } else if (req.path.includes('/verify-otp') || req.path.includes('/phone')) {
        eventType = 'phone_verification';
        method = 'phone_otp';
      } else if (req.path.includes('/verify-email') || req.path.includes('/email')) {
        eventType = 'email_verification';
      } else if (req.path.includes('/auth0')) {
        method = 'auth0';
      } else if (req.path.includes('/logout')) {
        eventType = 'logout';
      }

      // Record auth event
      setImmediate(() => {
        authMonitoringService!.recordAuthEvent({
          eventType: eventType as any,
          userId: body?.data?.user?.id || req.performance!.userId,
          email: req.body?.email || body?.data?.user?.email,
          phone: req.body?.phone || body?.data?.user?.phone,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
          method: method as any,
          success,
          errorCode: !success ? body?.error?.code : undefined,
          errorMessage: !success ? body?.error?.message : undefined,
          responseTime,
          metadata: {
            statusCode: res.statusCode,
            endpoint: req.path,
            httpMethod: req.method
          }
        });
      });

      return originalJson.call(this, body);
    };

    next();
  };

  /**
   * Critical path monitoring for authentication flows
   */
  trackCriticalPath = (pathName: string) => {
    return (req: PerformanceRequest, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      // Override res.end to capture critical path metrics
      const originalEnd = res.end;
      res.end = function(chunk?: any, encoding?: any) {
        const responseTime = Date.now() - startTime;
        
        // Record as business metric for critical paths
        setImmediate(() => {
          monitoringService.recordBusinessMetric({
            name: `critical_path_${pathName}`,
            value: responseTime,
            timestamp: new Date(),
            userId: (req as any).user?.id,
            tenantId: (req as any).user?.tenantId,
            metadata: {
              endpoint: req.path,
              method: req.method,
              statusCode: res.statusCode,
              success: res.statusCode >= 200 && res.statusCode < 400
            }
          });

          // Alert on slow critical paths
          if (responseTime > 5000) { // 5 seconds
            monitoringService.recordError({
              id: require('uuid').v4(),
              message: `Slow critical path detected: ${pathName}`,
              level: 'warn',
              timestamp: new Date(),
              endpoint: req.path,
              method: req.method,
              metadata: {
                pathName,
                responseTime,
                threshold: 5000
              }
            });
          }
        });

        return originalEnd.call(this, chunk, encoding);
      };

      next();
    };
  };

  /**
   * Database query performance monitoring
   */
  trackDatabasePerformance = (queryName: string) => {
    return async (queryFunction: Function, ...args: any[]) => {
      const startTime = Date.now();
      
      try {
        const result = await queryFunction(...args);
        const queryTime = Date.now() - startTime;
        
        // Record database performance metric
        await this.monitoringService.recordBusinessMetric({
          name: `db_query_${queryName}`,
          value: queryTime,
          timestamp: new Date(),
          metadata: {
            queryName,
            success: true
          }
        });

        // Alert on slow queries
        if (queryTime > 1000) { // 1 second
          await this.monitoringService.recordError({
            id: require('uuid').v4(),
            message: `Slow database query detected: ${queryName}`,
            level: 'warn',
            timestamp: new Date(),
            metadata: {
              queryName,
              queryTime,
              threshold: 1000
            }
          });
        }

        return result;
        
      } catch (error: any) {
        const queryTime = Date.now() - startTime;
        
        // Record failed query
        await this.monitoringService.recordBusinessMetric({
          name: `db_query_${queryName}`,
          value: queryTime,
          timestamp: new Date(),
          metadata: {
            queryName,
            success: false,
            error: error.message
          }
        });

        // Record error
        await this.monitoringService.recordError({
          id: require('uuid').v4(),
          message: `Database query failed: ${queryName}`,
          level: 'error',
          timestamp: new Date(),
          metadata: {
            queryName,
            queryTime,
            error: error.message
          }
        });

        throw error;
      }
    };
  };

  /**
   * External service call monitoring
   */
  trackExternalService = (serviceName: string) => {
    return async (serviceFunction: Function, ...args: any[]) => {
      const startTime = Date.now();
      
      try {
        const result = await serviceFunction(...args);
        const responseTime = Date.now() - startTime;
        
        // Record external service metric
        await this.monitoringService.recordBusinessMetric({
          name: `external_service_${serviceName}`,
          value: responseTime,
          timestamp: new Date(),
          metadata: {
            serviceName,
            success: true
          }
        });

        return result;
        
      } catch (error: any) {
        const responseTime = Date.now() - startTime;
        
        // Record failed external service call
        await this.monitoringService.recordBusinessMetric({
          name: `external_service_${serviceName}`,
          value: responseTime,
          timestamp: new Date(),
          metadata: {
            serviceName,
            success: false,
            error: error.message
          }
        });

        // Record error
        await this.monitoringService.recordError({
          id: require('uuid').v4(),
          message: `External service call failed: ${serviceName}`,
          level: 'error',
          timestamp: new Date(),
          metadata: {
            serviceName,
            responseTime,
            error: error.message
          }
        });

        throw error;
      }
    };
  };

  /**
   * Memory usage monitoring middleware
   */
  trackMemoryUsage = (req: Request, res: Response, next: NextFunction) => {
    const memoryBefore = process.memoryUsage();
    
    // Override res.end to capture memory usage after request
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any) {
      const memoryAfter = process.memoryUsage();
      const memoryDelta = memoryAfter.heapUsed - memoryBefore.heapUsed;
      
      // Record memory usage if significant
      if (Math.abs(memoryDelta) > 1024 * 1024) { // 1MB threshold
        setImmediate(() => {
          monitoringService.recordBusinessMetric({
            name: 'memory_usage_delta',
            value: memoryDelta,
            timestamp: new Date(),
            metadata: {
              endpoint: req.path,
              method: req.method,
              memoryBefore: memoryBefore.heapUsed,
              memoryAfter: memoryAfter.heapUsed
            }
          });
        });
      }

      return originalEnd.call(this, chunk, encoding);
    };

    next();
  };
}