import { Request, Response, NextFunction } from 'express';
import { ErrorHandlerMiddleware } from '../auth/error-handler.middleware';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  retryable?: boolean;
  details?: any;
}

/**
 * Enhanced API error handling middleware for graceful API failures
 */
export class ApiErrorHandlerMiddleware {
  
  /**
   * Main error handler for API failures
   */
  public static handleApiError = (
    err: ApiError,
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    // Log the error for monitoring
    console.error('API Error:', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // Set CORS headers for error responses
    ApiErrorHandlerMiddleware.setCorsHeaders(req, res);

    // Determine if error is retryable
    const isRetryable = ApiErrorHandlerMiddleware.isRetryableError(err);
    
    // Get appropriate status code
    const statusCode = err.statusCode || ApiErrorHandlerMiddleware.getStatusCodeFromError(err);
    
    // Build error response
    const errorResponse = {
      success: false,
      error: {
        code: err.code || ApiErrorHandlerMiddleware.getErrorCode(err),
        message: ApiErrorHandlerMiddleware.getSafeErrorMessage(err),
        retryable: isRetryable,
        timestamp: new Date().toISOString(),
        ...(isRetryable && { retryAfter: ApiErrorHandlerMiddleware.getRetryAfter(err) }),
        ...(process.env.NODE_ENV === 'development' && { 
          stack: err.stack,
          details: err.details 
        })
      }
    };

    // Add retry headers for retryable errors
    if (isRetryable) {
      const retryAfter = ApiErrorHandlerMiddleware.getRetryAfter(err);
      res.setHeader('Retry-After', retryAfter.toString());
      res.setHeader('X-Retryable', 'true');
    }

    res.status(statusCode).json(errorResponse);
  };

  /**
   * Async error wrapper for route handlers
   */
  public static asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  /**
   * Database error handler
   */
  public static handleDatabaseError = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    if (ApiErrorHandlerMiddleware.isDatabaseError(err)) {
      const apiError: ApiError = {
        name: 'DatabaseError',
        message: 'Database operation failed',
        statusCode: 503,
        code: 'DATABASE_ERROR',
        retryable: true,
        details: {
          operation: req.method + ' ' + req.path,
          retryAfter: 5
        }
      };
      
      ApiErrorHandlerMiddleware.handleApiError(apiError, req, res, next);
      return;
    }
    
    next(err);
  };

  /**
   * Network error handler
   */
  public static handleNetworkError = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    if (ApiErrorHandlerMiddleware.isNetworkError(err)) {
      const apiError: ApiError = {
        name: 'NetworkError',
        message: 'Network operation failed',
        statusCode: 502,
        code: 'NETWORK_ERROR',
        retryable: true,
        details: {
          retryAfter: 3
        }
      };
      
      ApiErrorHandlerMiddleware.handleApiError(apiError, req, res, next);
      return;
    }
    
    next(err);
  };

  /**
   * Validation error handler
   */
  public static handleValidationError = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    if (ApiErrorHandlerMiddleware.isValidationError(err)) {
      const apiError: ApiError = {
        name: 'ValidationError',
        message: 'Request validation failed',
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        retryable: false,
        details: {
          field: err.details?.[0]?.path?.join('.') || 'unknown',
          value: err.details?.[0]?.context?.value,
          constraint: err.details?.[0]?.message
        }
      };
      
      ApiErrorHandlerMiddleware.handleApiError(apiError, req, res, next);
      return;
    }
    
    next(err);
  };

  /**
   * Set CORS headers for error responses
   */
  private static setCorsHeaders(req: Request, res: Response): void {
    const origin = req.headers.origin;
    
    // Always set CORS headers to prevent connection issues
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Requested-With');
  }

  /**
   * Determine if error is retryable
   */
  private static isRetryableError(err: ApiError): boolean {
    if (err.retryable !== undefined) {
      return err.retryable;
    }

    // Network and connection errors are typically retryable
    const retryableCodes = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EHOSTUNREACH',
      'ENETUNREACH'
    ];

    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    
    return retryableCodes.includes(err.code || '') ||
           retryableStatusCodes.includes(err.statusCode || 0) ||
           ApiErrorHandlerMiddleware.isDatabaseError(err) ||
           ApiErrorHandlerMiddleware.isNetworkError(err);
  }

  /**
   * Get retry after seconds based on error type
   */
  private static getRetryAfter(err: ApiError): number {
    if (err.details?.retryAfter) {
      return err.details.retryAfter;
    }

    // Default retry intervals based on error type
    if (err.code === 'DATABASE_ERROR') return 5;
    if (err.code === 'NETWORK_ERROR') return 3;
    if (err.statusCode === 429) return 60; // Rate limit
    if (err.statusCode === 503) return 10; // Service unavailable
    
    return 5; // Default
  }

  /**
   * Get status code from error
   */
  private static getStatusCodeFromError(err: any): number {
    if (err.statusCode) return err.statusCode;
    if (err.status) return err.status;
    
    // Map error types to status codes
    if (ApiErrorHandlerMiddleware.isDatabaseError(err)) return 503;
    if (ApiErrorHandlerMiddleware.isNetworkError(err)) return 502;
    if (ApiErrorHandlerMiddleware.isValidationError(err)) return 400;
    if (err.name === 'UnauthorizedError') return 401;
    if (err.name === 'ForbiddenError') return 403;
    if (err.name === 'NotFoundError') return 404;
    
    return 500; // Internal server error
  }

  /**
   * Get error code from error
   */
  private static getErrorCode(err: any): string {
    if (err.code) return err.code;
    
    // Map error types to codes
    if (ApiErrorHandlerMiddleware.isDatabaseError(err)) return 'DATABASE_ERROR';
    if (ApiErrorHandlerMiddleware.isNetworkError(err)) return 'NETWORK_ERROR';
    if (ApiErrorHandlerMiddleware.isValidationError(err)) return 'VALIDATION_ERROR';
    if (err.name === 'UnauthorizedError') return 'UNAUTHORIZED';
    if (err.name === 'ForbiddenError') return 'FORBIDDEN';
    if (err.name === 'NotFoundError') return 'NOT_FOUND';
    
    return 'INTERNAL_ERROR';
  }

  /**
   * Get safe error message (don't expose sensitive info)
   */
  private static getSafeErrorMessage(err: any): string {
    // In production, use generic messages for security
    if (process.env.NODE_ENV === 'production') {
      if (ApiErrorHandlerMiddleware.isDatabaseError(err)) {
        return 'Database service temporarily unavailable';
      }
      if (ApiErrorHandlerMiddleware.isNetworkError(err)) {
        return 'Network service temporarily unavailable';
      }
      if (err.statusCode >= 500) {
        return 'Internal server error occurred';
      }
    }
    
    return err.message || 'An error occurred';
  }

  /**
   * Check if error is database-related
   */
  private static isDatabaseError(err: any): boolean {
    const dbErrorCodes = ['ECONNREFUSED', '08000', '08003', '08006', '57P01', '57P02', '57P03'];
    return dbErrorCodes.includes(err.code) ||
           err.message?.toLowerCase().includes('database') ||
           err.message?.toLowerCase().includes('postgres') ||
           err.name === 'DatabaseError';
  }

  /**
   * Check if error is network-related
   */
  private static isNetworkError(err: any): boolean {
    const networkErrorCodes = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH'];
    return networkErrorCodes.includes(err.code) ||
           err.message?.toLowerCase().includes('network') ||
           err.name === 'NetworkError';
  }

  /**
   * Check if error is validation-related
   */
  private static isValidationError(err: any): boolean {
    return err.name === 'ValidationError' ||
           err.isJoi === true ||
           err.details?.length > 0;
  }
}

// Export middleware functions
export const apiErrorHandler = ApiErrorHandlerMiddleware.handleApiError;
export const asyncHandler = ApiErrorHandlerMiddleware.asyncHandler;
export const handleDatabaseError = ApiErrorHandlerMiddleware.handleDatabaseError;
export const handleNetworkError = ApiErrorHandlerMiddleware.handleNetworkError;
export const handleValidationError = ApiErrorHandlerMiddleware.handleValidationError;