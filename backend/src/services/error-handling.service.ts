import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface ErrorContext {
  requestId: string;
  timestamp: string;
  userId?: string;
  endpoint: string;
  method: string;
  ip: string;
  userAgent?: string;
}

export interface ErrorDetails {
  code: string;
  message: string;
  field?: string;
  constraint?: string;
  retryable: boolean;
  suggestions?: string[];
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    timestamp: string;
    requestId: string;
    retryable?: boolean;
    retryAfter?: number;
    suggestions?: string[];
    details?: any;
  };
}

/**
 * Comprehensive error handling service
 */
export class ErrorHandlingService {
  
  /**
   * Handle authentication errors with specific messaging
   */
  public static handleAuthError(
    error: any,
    req: Request,
    res: Response,
    context?: Partial<ErrorContext>
  ): void {
    const errorContext = ErrorHandlingService.buildErrorContext(req, context);
    const errorDetails = ErrorHandlingService.classifyAuthError(error);
    
    // Log security events for authentication failures
    if (errorDetails.code.includes('INVALID') || errorDetails.code.includes('UNAUTHORIZED')) {
      ErrorHandlingService.logSecurityEvent('AUTH_FAILURE', errorContext, errorDetails);
    }

    const response = ErrorHandlingService.buildErrorResponse(errorDetails, errorContext);
    
    // Set appropriate headers
    ErrorHandlingService.setSecurityHeaders(res);
    
    // Add rate limiting headers for auth failures
    if (errorDetails.code === 'INVALID_CREDENTIALS') {
      res.setHeader('X-Auth-Retry-After', '60'); // Suggest 1 minute delay
    }

    res.status(ErrorHandlingService.getStatusCode(errorDetails.code)).json(response);
  }

  /**
   * Handle constraint violation errors
   */
  public static handleConstraintError(
    error: any,
    req: Request,
    res: Response,
    context?: Partial<ErrorContext>
  ): void {
    const errorContext = ErrorHandlingService.buildErrorContext(req, context);
    const errorDetails = ErrorHandlingService.classifyConstraintError(error);
    
    // Log constraint violations for monitoring
    ErrorHandlingService.logConstraintViolation(errorContext, errorDetails, error);

    const response = ErrorHandlingService.buildErrorResponse(errorDetails, errorContext);
    
    ErrorHandlingService.setSecurityHeaders(res);
    res.status(ErrorHandlingService.getStatusCode(errorDetails.code)).json(response);
  }

  /**
   * Handle validation errors with field-specific messaging
   */
  public static handleValidationError(
    error: any,
    req: Request,
    res: Response,
    context?: Partial<ErrorContext>
  ): void {
    const errorContext = ErrorHandlingService.buildErrorContext(req, context);
    const errorDetails = ErrorHandlingService.classifyValidationError(error);
    
    const response = ErrorHandlingService.buildErrorResponse(errorDetails, errorContext);
    
    ErrorHandlingService.setSecurityHeaders(res);
    res.status(400).json(response);
  }

  /**
   * Handle network and database errors
   */
  public static handleSystemError(
    error: any,
    req: Request,
    res: Response,
    context?: Partial<ErrorContext>
  ): void {
    const errorContext = ErrorHandlingService.buildErrorContext(req, context);
    const errorDetails = ErrorHandlingService.classifySystemError(error);
    
    // Log system errors for monitoring
    ErrorHandlingService.logSystemError(errorContext, errorDetails, error);

    const response = ErrorHandlingService.buildErrorResponse(errorDetails, errorContext);
    
    // Add retry headers for retryable errors
    if (errorDetails.retryable) {
      const retryAfter = ErrorHandlingService.getRetryDelay(errorDetails.code);
      res.setHeader('Retry-After', retryAfter.toString());
      response.error.retryAfter = retryAfter;
    }

    ErrorHandlingService.setSecurityHeaders(res);
    res.status(ErrorHandlingService.getStatusCode(errorDetails.code)).json(response);
  }

  /**
   * Classify authentication errors
   */
  private static classifyAuthError(error: any): ErrorDetails {
    const message = error.message?.toLowerCase() || '';
    const code = error.code || '';

    // Invalid credentials
    if (message.includes('invalid') && (message.includes('password') || message.includes('credentials'))) {
      return {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password. Please check your credentials and try again.',
        retryable: false,
        suggestions: [
          'Check your email and password',
          'Use the forgot password option if needed',
          'Ensure caps lock is not enabled'
        ]
      };
    }

    // Invalid OTP
    if (message.includes('otp') || message.includes('verification code')) {
      return {
        code: 'INVALID_OTP',
        message: 'Invalid verification code. Please check the code and try again.',
        retryable: false,
        suggestions: [
          'Check the 6-digit code in your SMS/email',
          'Request a new code if the current one expired',
          'Ensure you entered all 6 digits'
        ]
      };
    }

    // Expired token/session
    if (message.includes('expired') || message.includes('token')) {
      return {
        code: 'TOKEN_EXPIRED',
        message: 'Your session has expired. Please log in again.',
        retryable: false,
        suggestions: [
          'Log in again to continue',
          'Your session expired for security reasons'
        ]
      };
    }

    // Rate limiting
    if (code === '429' || message.includes('rate limit')) {
      return {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many login attempts. Please wait before trying again.',
        retryable: true,
        suggestions: [
          'Wait a few minutes before trying again',
          'Use the forgot password option instead'
        ]
      };
    }

    // Generic auth error
    return {
      code: 'AUTHENTICATION_FAILED',
      message: 'Authentication failed. Please try again.',
      retryable: false,
      suggestions: [
        'Check your credentials',
        'Try a different login method'
      ]
    };
  }

  /**
   * Classify constraint violation errors
   */
  private static classifyConstraintError(error: any): ErrorDetails {
    const detail = error.detail || error.message || '';
    const constraint = error.constraint || '';

    // Duplicate email
    if (detail.includes('email') || constraint.includes('email')) {
      return {
        code: 'DUPLICATE_EMAIL',
        message: 'This email address is already registered. Please use a different email or try logging in.',
        field: 'email',
        constraint: constraint,
        retryable: false,
        suggestions: [
          'Use a different email address',
          'Try logging in if you already have an account',
          'Use the forgot password option'
        ]
      };
    }

    // Duplicate phone
    if (detail.includes('phone') || constraint.includes('phone')) {
      return {
        code: 'DUPLICATE_PHONE',
        message: 'This phone number is already registered. Please use a different number or try logging in.',
        field: 'phone',
        constraint: constraint,
        retryable: false,
        suggestions: [
          'Use a different phone number',
          'Try logging in if you already have an account',
          'Contact support if this is your number'
        ]
      };
    }

    // Foreign key violation
    if (error.code === '23503') {
      return {
        code: 'INVALID_REFERENCE',
        message: 'Referenced item no longer exists. Please refresh and try again.',
        constraint: constraint,
        retryable: false,
        suggestions: [
          'Refresh the page',
          'Check if the referenced item still exists'
        ]
      };
    }

    // Not null violation
    if (error.code === '23502') {
      const field = error.column || 'field';
      return {
        code: 'MISSING_REQUIRED_FIELD',
        message: `${field} is required and cannot be empty.`,
        field: field,
        retryable: false,
        suggestions: [
          `Please provide a value for ${field}`,
          'Check all required fields are filled'
        ]
      };
    }

    // Generic constraint violation
    return {
      code: 'CONSTRAINT_VIOLATION',
      message: 'The provided data violates system constraints. Please check your input.',
      constraint: constraint,
      retryable: false,
      suggestions: [
        'Check your input data',
        'Ensure all values are unique where required'
      ]
    };
  }

  /**
   * Classify validation errors
   */
  private static classifyValidationError(error: any): ErrorDetails {
    if (error.details && error.details.length > 0) {
      const firstError = error.details[0];
      const field = firstError.path?.join('.') || 'field';
      const message = firstError.message || 'Validation failed';

      return {
        code: 'VALIDATION_ERROR',
        message: message,
        field: field,
        retryable: false,
        suggestions: ErrorHandlingService.getValidationSuggestions(field, message)
      };
    }

    return {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed. Please check your input.',
      retryable: false,
      suggestions: [
        'Check all required fields are filled',
        'Ensure data formats are correct'
      ]
    };
  }

  /**
   * Classify system errors (network, database, etc.)
   */
  private static classifySystemError(error: any): ErrorDetails {
    const message = error.message?.toLowerCase() || '';
    const code = error.code || '';

    // Database connection errors
    if (code.includes('ECONNREFUSED') || message.includes('database') || message.includes('connection')) {
      return {
        code: 'DATABASE_ERROR',
        message: 'Database service is temporarily unavailable. Please try again in a moment.',
        retryable: true,
        suggestions: [
          'Try again in a few moments',
          'The issue is temporary and will be resolved shortly'
        ]
      };
    }

    // Network errors
    if (code.includes('ETIMEDOUT') || code.includes('ENOTFOUND') || message.includes('network')) {
      return {
        code: 'NETWORK_ERROR',
        message: 'Network error occurred. Please check your connection and try again.',
        retryable: true,
        suggestions: [
          'Check your internet connection',
          'Try again in a moment'
        ]
      };
    }

    // Service unavailable
    if (error.status === 503 || message.includes('service unavailable')) {
      return {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service is temporarily unavailable. Please try again later.',
        retryable: true,
        suggestions: [
          'Try again in a few minutes',
          'The service will be restored shortly'
        ]
      };
    }

    // Generic server error
    return {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred. Please try again.',
      retryable: true,
      suggestions: [
        'Try again in a moment',
        'Contact support if the problem persists'
      ]
    };
  }

  /**
   * Get validation suggestions based on field and message
   */
  private static getValidationSuggestions(field: string, message: string): string[] {
    const suggestions: string[] = [];
    const lowerMessage = message.toLowerCase();

    if (field.includes('email')) {
      suggestions.push('Use a valid email format (example@domain.com)');
    }

    if (field.includes('phone')) {
      suggestions.push('Include country code (+1 for US, +91 for India)');
      suggestions.push('Use only digits and + symbol');
    }

    if (field.includes('password')) {
      suggestions.push('Use at least 8 characters');
      suggestions.push('Include uppercase, lowercase, numbers, and symbols');
    }

    if (lowerMessage.includes('required')) {
      suggestions.push(`${field} is required and cannot be empty`);
    }

    if (lowerMessage.includes('pattern') || lowerMessage.includes('format')) {
      suggestions.push(`Check the format of ${field}`);
    }

    return suggestions.length > 0 ? suggestions : ['Please check your input and try again'];
  }

  /**
   * Build error context from request
   */
  private static buildErrorContext(req: Request, context?: Partial<ErrorContext>): ErrorContext {
    return {
      requestId: uuidv4(),
      timestamp: new Date().toISOString(),
      endpoint: `${req.method} ${req.path}`,
      method: req.method,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent'),
      ...context
    };
  }

  /**
   * Build standardized error response
   */
  private static buildErrorResponse(details: ErrorDetails, context: ErrorContext): ErrorResponse {
    return {
      success: false,
      error: {
        code: details.code,
        message: details.message,
        timestamp: context.timestamp,
        requestId: context.requestId,
        retryable: details.retryable,
        suggestions: details.suggestions,
        ...(details.field && { field: details.field }),
        ...(process.env.NODE_ENV === 'development' && {
          details: {
            constraint: details.constraint,
            endpoint: context.endpoint
          }
        })
      }
    };
  }

  /**
   * Set security headers for error responses
   */
  private static setSecurityHeaders(res: Response): void {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  }

  /**
   * Get HTTP status code for error code
   */
  private static getStatusCode(errorCode: string): number {
    const statusMap: { [key: string]: number } = {
      // Authentication errors
      'INVALID_CREDENTIALS': 401,
      'INVALID_OTP': 401,
      'TOKEN_EXPIRED': 401,
      'AUTHENTICATION_FAILED': 401,
      
      // Authorization errors
      'FORBIDDEN': 403,
      'INSUFFICIENT_PERMISSIONS': 403,
      
      // Validation errors
      'VALIDATION_ERROR': 400,
      'MISSING_REQUIRED_FIELD': 400,
      
      // Constraint violations
      'DUPLICATE_EMAIL': 409,
      'DUPLICATE_PHONE': 409,
      'CONSTRAINT_VIOLATION': 409,
      'INVALID_REFERENCE': 400,
      
      // Rate limiting
      'RATE_LIMIT_EXCEEDED': 429,
      
      // System errors
      'DATABASE_ERROR': 503,
      'NETWORK_ERROR': 502,
      'SERVICE_UNAVAILABLE': 503,
      'INTERNAL_SERVER_ERROR': 500
    };

    return statusMap[errorCode] || 500;
  }

  /**
   * Get retry delay for retryable errors
   */
  private static getRetryDelay(errorCode: string): number {
    const delayMap: { [key: string]: number } = {
      'DATABASE_ERROR': 5,
      'NETWORK_ERROR': 3,
      'SERVICE_UNAVAILABLE': 10,
      'RATE_LIMIT_EXCEEDED': 60,
      'INTERNAL_SERVER_ERROR': 5
    };

    return delayMap[errorCode] || 5;
  }

  /**
   * Log security events
   */
  private static logSecurityEvent(
    event: string,
    context: ErrorContext,
    details: ErrorDetails
  ): void {
    const securityLog = {
      event,
      timestamp: context.timestamp,
      requestId: context.requestId,
      ip: context.ip,
      userAgent: context.userAgent,
      endpoint: context.endpoint,
      errorCode: details.code,
      severity: 'WARNING'
    };

    console.warn('SECURITY EVENT:', JSON.stringify(securityLog));

    // In production, send to security monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Example: securityMonitoringService.logEvent(securityLog);
    }
  }

  /**
   * Log constraint violations
   */
  private static logConstraintViolation(
    context: ErrorContext,
    details: ErrorDetails,
    originalError: any
  ): void {
    const constraintLog = {
      event: 'CONSTRAINT_VIOLATION',
      timestamp: context.timestamp,
      requestId: context.requestId,
      ip: context.ip,
      endpoint: context.endpoint,
      field: details.field,
      constraint: details.constraint,
      errorCode: originalError.code,
      detail: originalError.detail
    };

    console.log('CONSTRAINT VIOLATION:', JSON.stringify(constraintLog));
  }

  /**
   * Log system errors
   */
  private static logSystemError(
    context: ErrorContext,
    details: ErrorDetails,
    originalError: any
  ): void {
    const systemLog = {
      event: 'SYSTEM_ERROR',
      timestamp: context.timestamp,
      requestId: context.requestId,
      endpoint: context.endpoint,
      errorCode: details.code,
      message: originalError.message,
      stack: process.env.NODE_ENV === 'development' ? originalError.stack : undefined,
      severity: details.retryable ? 'WARNING' : 'ERROR'
    };

    console.error('SYSTEM ERROR:', JSON.stringify(systemLog));

    // In production, send to error monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Example: errorMonitoringService.captureException(originalError, systemLog);
    }
  }
}