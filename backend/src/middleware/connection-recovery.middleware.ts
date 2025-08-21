import { Request, Response, NextFunction } from 'express';
import { ErrorHandlerMiddleware } from '../auth/error-handler.middleware';

/**
 * Connection recovery middleware to handle connection issues gracefully
 */
export class ConnectionRecoveryMiddleware {
  
  /**
   * Handle connection errors and provide recovery suggestions
   */
  public static handleConnectionError = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    // Check for connection-related errors
    if (ConnectionRecoveryMiddleware.isConnectionError(err)) {
      const recoveryResponse = ConnectionRecoveryMiddleware.buildRecoveryResponse(err, req);
      
      // Set appropriate headers for connection issues
      res.setHeader('Connection', 'close');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      
      res.status(503).json(recoveryResponse);
      return;
    }

    // Pass to next error handler if not a connection error
    next(err);
  };

  /**
   * Graceful shutdown handler
   */
  public static gracefulShutdown = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    // Check if server is shutting down
    if (process.env.SHUTTING_DOWN === 'true') {
      res.status(503).json({
        success: false,
        error: {
          code: 'SERVICE_SHUTTING_DOWN',
          message: 'Service is shutting down, please retry in a moment',
          retryable: true,
          details: {
            retryAfter: 30,
            suggestion: 'The service is performing a graceful shutdown. Please retry your request in 30 seconds.'
          }
        }
      });
      return;
    }

    next();
  };

  /**
   * Database connection recovery
   */
  public static handleDatabaseError = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    if (ConnectionRecoveryMiddleware.isDatabaseError(err)) {
      res.status(503).json({
        success: false,
        error: {
          code: 'DATABASE_CONNECTION_ERROR',
          message: 'Database temporarily unavailable',
          retryable: true,
          details: {
            retryAfter: 10,
            suggestion: 'Database connection issue detected. Please retry in 10 seconds.'
          }
        }
      });
      return;
    }

    next(err);
  };

  /**
   * Redis connection recovery
   */
  public static handleRedisError = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    if (ConnectionRecoveryMiddleware.isRedisError(err)) {
      // Redis errors are often non-critical, continue with degraded functionality
      console.warn('Redis connection issue, continuing with degraded functionality:', err.message);
      
      // Add header to indicate degraded mode
      res.setHeader('X-Service-Mode', 'degraded');
      
      // Continue processing the request
      next();
      return;
    }

    next(err);
  };

  /**
   * Network timeout recovery
   */
  public static handleNetworkTimeout = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const startTime = Date.now();
    
    // Set up timeout monitoring
    const timeoutWarning = setTimeout(() => {
      console.warn(`Slow request detected: ${req.method} ${req.url} - ${Date.now() - startTime}ms`);
    }, 10000); // Warn after 10 seconds

    // Clear timeout on response
    res.on('finish', () => clearTimeout(timeoutWarning));
    res.on('close', () => clearTimeout(timeoutWarning));

    next();
  };

  /**
   * Check if error is connection-related
   */
  private static isConnectionError(err: any): boolean {
    const connectionErrorCodes = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ENOTFOUND',
      'ETIMEDOUT',
      'ECONNABORTED',
      'EHOSTUNREACH',
      'ENETUNREACH'
    ];

    const connectionErrorMessages = [
      'connection refused',
      'connection reset',
      'network error',
      'timeout',
      'socket hang up'
    ];

    return connectionErrorCodes.includes(err.code) ||
           connectionErrorMessages.some(msg => 
             err.message?.toLowerCase().includes(msg)
           );
  }

  /**
   * Check if error is database-related
   */
  private static isDatabaseError(err: any): boolean {
    const dbErrorCodes = [
      'ECONNREFUSED', // Database connection refused
      '08000', // PostgreSQL connection exception
      '08003', // PostgreSQL connection does not exist
      '08006', // PostgreSQL connection failure
      '57P01', // PostgreSQL admin shutdown
      '57P02', // PostgreSQL crash shutdown
      '57P03'  // PostgreSQL cannot connect now
    ];

    return dbErrorCodes.includes(err.code) ||
           err.message?.includes('database') ||
           err.message?.includes('connection') && err.message?.includes('postgres');
  }

  /**
   * Check if error is Redis-related
   */
  private static isRedisError(err: any): boolean {
    return err.message?.includes('redis') ||
           err.message?.includes('Redis') ||
           (err.code === 'ECONNREFUSED' && err.port === 6379);
  }

  /**
   * Build recovery response with helpful information
   */
  private static buildRecoveryResponse(err: any, req: Request): any {
    // Add specific recovery suggestions based on error type
    if (err.code === 'ECONNREFUSED') {
      return {
        success: false,
        error: {
          code: 'CONNECTION_ERROR',
          message: 'Service temporarily unavailable',
          retryable: true,
          timestamp: new Date().toISOString(),
          details: {
            retryAfter: 5,
            suggestion: 'The service is temporarily unavailable. Please retry in 5 seconds with exponential backoff.',
            errorCode: err.code
          }
        }
      };
    } else if (err.code === 'ETIMEDOUT') {
      return {
        success: false,
        error: {
          code: 'CONNECTION_ERROR',
          message: 'Request timeout',
          retryable: true,
          timestamp: new Date().toISOString(),
          details: {
            retryAfter: 3,
            suggestion: 'Request timed out. Please retry with a shorter timeout or check your network connection.',
            errorCode: err.code
          }
        }
      };
    } else {
      return {
        success: false,
        error: {
          code: 'CONNECTION_ERROR',
          message: 'Connection issue detected',
          retryable: true,
          timestamp: new Date().toISOString(),
          details: {
            retryAfter: 10,
            suggestion: 'A connection issue occurred. Please retry in 10 seconds.',
            errorCode: err.code || 'UNKNOWN'
          }
        }
      };
    }
  }
}

/**
 * Middleware to monitor and recover from connection issues
 */
export const connectionRecoveryMiddleware = [
  ConnectionRecoveryMiddleware.gracefulShutdown,
  ConnectionRecoveryMiddleware.handleNetworkTimeout,
  ConnectionRecoveryMiddleware.handleDatabaseError,
  ConnectionRecoveryMiddleware.handleRedisError,
  ConnectionRecoveryMiddleware.handleConnectionError
];