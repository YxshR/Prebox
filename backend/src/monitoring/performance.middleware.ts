import { Request, Response, NextFunction } from 'express';
import { MonitoringService } from './monitoring.service';
import { MetricsService } from './metrics.service';
import { PerformanceMetric, ErrorEvent } from './monitoring.types';
import { v4 as uuidv4 } from 'uuid';

export class PerformanceMonitor {
  private monitoringService: MonitoringService;
  private metricsService: MetricsService;

  constructor(monitoringService: MonitoringService, metricsService: MetricsService) {
    this.monitoringService = monitoringService;
    this.metricsService = metricsService;
  }

  /**
   * Express middleware for performance monitoring
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      const requestId = uuidv4();

      // Add request ID to request for tracing
      req.requestId = requestId;

      // Track request start
      this.metricsService.incrementCounter('http_requests_total', 1, {
        method: req.method,
        endpoint: this.normalizeEndpoint(req.path)
      });

      // Override res.end to capture response metrics
      const originalEnd = res.end.bind(res);
      const self = this;
      
      res.end = function(chunk?: any, encoding?: BufferEncoding | (() => void), cb?: () => void) {
        const responseTime = Date.now() - startTime;
        const statusCode = res.statusCode;

        // Record performance metric
        const performanceMetric: PerformanceMetric = {
          endpoint: req.path,
          method: req.method,
          statusCode,
          responseTime,
          timestamp: new Date(),
          userId: (req.user as any)?.id,
          tenantId: (req.user as any)?.tenantId
        };

        // Don't await these operations to avoid blocking the response
        Promise.all([
          self.recordPerformanceMetric(performanceMetric),
          self.recordResponseMetrics(req, res, responseTime)
        ]).catch(error => {
          console.error('Failed to record performance metrics:', error);
        });

        // Call original end method
        return originalEnd(chunk, encoding as any, cb);
      };

      // Handle errors
      res.on('error', (error) => {
        this.recordErrorEvent(req, error);
      });

      next();
    };
  }

  /**
   * Record performance metric
   */
  private async recordPerformanceMetric(metric: PerformanceMetric): Promise<void> {
    try {
      await this.monitoringService.recordPerformanceMetric(metric);
    } catch (error) {
      console.error('Failed to record performance metric:', error);
    }
  }

  /**
   * Record response metrics
   */
  private async recordResponseMetrics(req: Request, res: Response, responseTime: number): Promise<void> {
    try {
      const endpoint = this.normalizeEndpoint(req.path);
      const method = req.method;
      const statusCode = res.statusCode;

      // Record response time
      await this.metricsService.recordTimer('http_request_duration_ms', responseTime, {
        method,
        endpoint,
        status_code: statusCode.toString()
      });

      // Record status code metrics
      await this.metricsService.incrementCounter('http_responses_total', 1, {
        method,
        endpoint,
        status_code: statusCode.toString()
      });

      // Record error metrics for 4xx and 5xx responses
      if (statusCode >= 400) {
        await this.metricsService.incrementCounter('http_errors_total', 1, {
          method,
          endpoint,
          status_code: statusCode.toString(),
          error_type: statusCode >= 500 ? 'server_error' : 'client_error'
        });
      }

      // Record business metrics
      if ((req.user as any)?.tenantId) {
        await this.metricsService.incrementCounter('api_requests_by_tenant', 1, {
          tenant_id: (req.user as any).tenantId,
          endpoint
        });
      }

    } catch (error) {
      console.error('Failed to record response metrics:', error);
    }
  }

  /**
   * Record error event
   */
  private async recordErrorEvent(req: Request, error: Error): Promise<void> {
    try {
      const errorEvent: ErrorEvent = {
        id: uuidv4(),
        message: error.message,
        stack: error.stack,
        level: 'error',
        timestamp: new Date(),
        userId: (req.user as any)?.id,
        tenantId: (req.user as any)?.tenantId,
        endpoint: req.path,
        method: req.method,
        metadata: {
          requestId: req.requestId,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          query: req.query,
          body: this.sanitizeBody(req.body)
        }
      };

      await this.monitoringService.recordError(errorEvent);

    } catch (recordError) {
      console.error('Failed to record error event:', recordError);
    }
  }

  /**
   * Normalize endpoint for consistent metrics
   */
  private normalizeEndpoint(path: string): string {
    // Replace dynamic segments with placeholders
    return path
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
      .replace(/\/[a-f0-9]{24}/g, '/:objectId');
  }

  /**
   * Sanitize request body for logging (remove sensitive data)
   */
  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

/**
 * Error handling middleware for monitoring
 */
export function errorMonitoringMiddleware(
  monitoringService: MonitoringService
) {
  return (error: Error, req: Request, res: Response, next: NextFunction) => {
    // Record the error
    const errorEvent: ErrorEvent = {
      id: uuidv4(),
      message: error.message,
      stack: error.stack,
      level: 'error',
      timestamp: new Date(),
      userId: req.user?.id,
      tenantId: req.user?.tenantId,
      endpoint: req.path,
      method: req.method,
      metadata: {
        requestId: req.requestId,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      }
    };

    // Don't await to avoid blocking error response
    monitoringService.recordError(errorEvent).catch(recordError => {
      console.error('Failed to record error in monitoring:', recordError);
    });

    next(error);
  };
}

/**
 * Business metrics middleware for specific endpoints
 */
export function businessMetricsMiddleware(
  metricsService: MetricsService,
  metricName: string,
  getValue?: (req: Request, res: Response) => number
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalEnd = res.end;
    
    res.end = function(chunk?: any, encoding?: BufferEncoding | (() => void), cb?: () => void) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const value = getValue ? getValue(req, res) : 1;
        
        // Don't await to avoid blocking response
        metricsService.recordMetric({
          name: metricName,
          value,
          timestamp: new Date(),
          type: 'counter',
          tags: {
            tenant_id: (req.user as any)?.tenantId || 'unknown',
            endpoint: req.path
          }
        }).catch(error => {
          console.error('Failed to record business metric:', error);
        });
      }
      
      return originalEnd(chunk, encoding as any, cb);
    };

    next();
  };
}

// Extend Express Request interface
// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}