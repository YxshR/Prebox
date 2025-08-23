import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface ApiError extends Error {
  status?: number;
  code?: string;
  details?: any;
  isOperational?: boolean;
}

export class ErrorHandlerMiddleware {
  
  /**
   * Global error handler for API authentication and security
   */
  public static handleError = (
    err: ApiError,
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const requestId = uuidv4();
    const timestamp = new Date().toISOString();
    
    // Prevent duplicate error responses
    if (res.headersSent) {
      return;
    }
    
    // Log error details
    console.error('API Error:', {
      requestId,
      timestamp,
      error: {
        name: err.name,
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        code: err.code,
        status: err.status
      },
      request: {
        method: req.method,
        url: req.url,
        ip: req.ip || (req as any).connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
        hasApiKey: !!req.headers['x-api-key'],
        hasAuth: !!req.headers.authorization
      }
    });

    // Set CORS headers for error responses to prevent connection issues
    ErrorHandlerMiddleware.setCorsHeaders(req, res);

    // Determine error type and response
    const errorResponse = ErrorHandlerMiddleware.buildErrorResponse(err, requestId, timestamp);
    
    // Set appropriate status code
    const statusCode = err.status || errorResponse.error.status || 500;
    
    // Add retry information for retryable errors
    if (ErrorHandlerMiddleware.isRetryableError(err)) {
      res.setHeader('Retry-After', '5'); // Suggest retry after 5 seconds
      errorResponse.error.retryable = true;
    }
    
    // Send error response
    res.status(statusCode).json(errorResponse);
  };

  /**
   * Set CORS headers for error responses
   */
  private static setCorsHeaders(req: Request, res: Response): void {
    const origin = req.headers.origin;
    
    // Allow the requesting origin or use wildcard for development
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
   * Check if error is retryable
   */
  private static isRetryableError(err: ApiError): boolean {
    const retryableCodes = [
      'RATE_LIMIT_EXCEEDED',
      'SERVICE_UNAVAILABLE',
      'REQUEST_TIMEOUT',
      'DATABASE_ERROR',
      'INTERNAL_SERVER_ERROR'
    ];
    
    return retryableCodes.includes(err.code || '') || 
           Boolean(err.status && err.status >= 500);
  }

  /**
   * Async error wrapper for route handlers
   */
  public static asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  /**
   * Authentication error handler
   */
  public static handleAuthError = (
    err: ApiError,
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    // Log authentication failures for security monitoring
    if (err.code === 'INVALID_API_KEY' || err.code === 'INVALID_TOKEN') {
      console.warn('Authentication Failure:', {
        timestamp: new Date().toISOString(),
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        endpoint: `${req.method} ${req.path}`,
        error: err.code,
        hasApiKey: !!req.headers['x-api-key'],
        hasAuth: !!req.headers.authorization
      });
    }

    ErrorHandlerMiddleware.handleError(err, req, res, next);
  };

  /**
   * Rate limit error handler
   */
  public static handleRateLimitError = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const error: ApiError = new Error('Rate limit exceeded');
    error.status = 429;
    error.code = 'RATE_LIMIT_EXCEEDED';
    error.details = {
      message: 'Too many requests, please try again later',
      retryAfter: 3600
    };

    ErrorHandlerMiddleware.handleError(error, req, res, next);
  };

  /**
   * Validation error handler
   */
  public static handleValidationError = (
    validationError: any,
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    const error: ApiError = new Error('Request validation failed');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    error.details = {
      field: validationError.details?.[0]?.path?.join('.'),
      message: validationError.details?.[0]?.message,
      value: validationError.details?.[0]?.context?.value
    };

    ErrorHandlerMiddleware.handleError(error, req, res, next);
  };

  /**
   * Database error handler
   */
  public static handleDatabaseError = (
    dbError: any,
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    let error: ApiError;

    // Handle specific database errors
    switch (dbError.code) {
      case '23505': // Unique violation
        error = new Error('Resource already exists');
        error.status = 409;
        error.code = 'DUPLICATE_RESOURCE';
        break;
      case '23503': // Foreign key violation
        error = new Error('Referenced resource not found');
        error.status = 400;
        error.code = 'INVALID_REFERENCE';
        break;
      case '23502': // Not null violation
        error = new Error('Required field missing');
        error.status = 400;
        error.code = 'MISSING_REQUIRED_FIELD';
        break;
      default:
        error = new Error('Database operation failed');
        error.status = 500;
        error.code = 'DATABASE_ERROR';
    }

    ErrorHandlerMiddleware.handleError(error, req, res, next);
  };

  /**
   * Build standardized error response
   */
  private static buildErrorResponse(
    err: ApiError, 
    requestId: string, 
    timestamp: string
  ): any {
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Base error response
    const errorResponse = {
      success: false,
      error: {
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || 'An unexpected error occurred',
        timestamp,
        requestId
      }
    };

    // Add details if available
    if (err.details) {
      errorResponse.error = { ...errorResponse.error, ...err.details };
    }

    // Add stack trace in development
    if (!isProduction && err.stack) {
      (errorResponse.error as any).stack = err.stack;
    }

    // Add status to details if not already present
    if (!err.details?.status) {
      (errorResponse.error as any).details = {
        ...(errorResponse.error as any).details,
        status: ErrorHandlerMiddleware.getStatusFromErrorCode(err.code || 'INTERNAL_SERVER_ERROR')
      };
    }

    return errorResponse;
  }

  /**
   * Map error codes to HTTP status codes
   */
  private static getStatusFromErrorCode(code: string): number {
    const statusMap: { [key: string]: number } = {
      // Authentication errors
      'UNAUTHORIZED': 401,
      'INVALID_TOKEN': 401,
      'INVALID_API_KEY': 401,
      'TOKEN_EXPIRED': 401,
      'API_KEY_EXPIRED': 401,
      'AUTHENTICATION_REQUIRED': 401,
      
      // Authorization errors
      'FORBIDDEN': 403,
      'INSUFFICIENT_PERMISSIONS': 403,
      'INSUFFICIENT_SCOPE': 403,
      'ACCESS_DENIED': 403,
      
      // Validation errors
      'VALIDATION_ERROR': 400,
      'INVALID_REQUEST': 400,
      'MISSING_REQUIRED_FIELD': 400,
      'INVALID_FORMAT': 400,
      'INVALID_API_KEY_FORMAT': 400,
      
      // Rate limiting
      'RATE_LIMIT_EXCEEDED': 429,
      'API_RATE_LIMIT_EXCEEDED': 429,
      'TENANT_RATE_LIMIT_EXCEEDED': 429,
      
      // Resource errors
      'NOT_FOUND': 404,
      'RESOURCE_NOT_FOUND': 404,
      'DUPLICATE_RESOURCE': 409,
      'CONFLICT': 409,
      
      // Server errors
      'INTERNAL_SERVER_ERROR': 500,
      'DATABASE_ERROR': 500,
      'SERVICE_UNAVAILABLE': 503,
      'REQUEST_TIMEOUT': 408,
      'PAYLOAD_TOO_LARGE': 413,
      
      // API specific errors
      'API_KEY_CREATION_FAILED': 400,
      'API_KEY_UPDATE_FAILED': 400,
      'API_KEY_REVOCATION_FAILED': 400,
      'USAGE_TRACKING_FAILED': 500,
      'ANALYTICS_FAILED': 500
    };

    return statusMap[code] || 500;
  }

  /**
   * Create operational error (expected errors that should be handled gracefully)
   */
  public static createOperationalError(
    message: string,
    code: string,
    status?: number,
    details?: any
  ): ApiError {
    const error: ApiError = new Error(message);
    error.code = code;
    error.status = status || ErrorHandlerMiddleware.getStatusFromErrorCode(code);
    error.details = details;
    error.isOperational = true;
    return error;
  }

  /**
   * Check if error is operational (expected) or programming error
   */
  public static isOperationalError(error: ApiError): boolean {
    return error.isOperational === true;
  }

  /**
   * Security event logger for suspicious activities
   */
  public static logSecurityEvent(
    event: string,
    req: Request,
    details?: any
  ): void {
    const securityLog = {
      timestamp: new Date().toISOString(),
      event,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      endpoint: `${req.method} ${req.path}`,
      hasApiKey: !!req.headers['x-api-key'],
      hasAuth: !!req.headers.authorization,
      details
    };

    console.warn('SECURITY EVENT:', securityLog);

    // In production, you might want to send this to a security monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to security monitoring service
      // securityMonitoringService.logEvent(securityLog);
    }
  }
}

// Export error types for use in other modules
export const ErrorCodes = {
  // Authentication
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  INVALID_API_KEY: 'INVALID_API_KEY',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  API_KEY_EXPIRED: 'API_KEY_EXPIRED',
  
  // Authorization
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_SCOPE: 'INSUFFICIENT_SCOPE',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_API_KEY_FORMAT: 'INVALID_API_KEY_FORMAT',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  API_RATE_LIMIT_EXCEEDED: 'API_RATE_LIMIT_EXCEEDED',
  
  // Resources
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  
  // Server
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR'
} as const;