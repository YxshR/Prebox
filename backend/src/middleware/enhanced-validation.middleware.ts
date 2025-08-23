import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ErrorHandlerMiddleware } from '../auth/error-handler.middleware';

export interface ValidationSchema {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}

export interface ValidationOptions {
  allowUnknown?: boolean;
  stripUnknown?: boolean;
  abortEarly?: boolean;
}

/**
 * Enhanced validation middleware with comprehensive error handling
 */
export class EnhancedValidationMiddleware {
  
  /**
   * Create validation middleware for request validation
   */
  public static validate(
    schema: ValidationSchema,
    options: ValidationOptions = {}
  ) {
    const config = {
      allowUnknown: false,
      stripUnknown: true,
      abortEarly: false,
      ...options
    };

    return (req: Request, res: Response, next: NextFunction) => {
      const validationErrors: any[] = [];

      // Validate request body
      if (schema.body) {
        const { error, value } = schema.body.validate(req.body, config);
        if (error) {
          validationErrors.push({
            location: 'body',
            details: error.details
          });
        } else {
          req.body = value;
        }
      }

      // Validate query parameters
      if (schema.query) {
        const { error, value } = schema.query.validate(req.query, config);
        if (error) {
          validationErrors.push({
            location: 'query',
            details: error.details
          });
        } else {
          req.query = value;
        }
      }

      // Validate route parameters
      if (schema.params) {
        const { error, value } = schema.params.validate(req.params, config);
        if (error) {
          validationErrors.push({
            location: 'params',
            details: error.details
          });
        } else {
          req.params = value;
        }
      }

      // Handle validation errors
      if (validationErrors.length > 0) {
        const formattedError = EnhancedValidationMiddleware.formatValidationError(validationErrors);
        return ErrorHandlerMiddleware.handleValidationError(formattedError, req, res, next);
      }

      next();
    };
  }

  /**
   * Phone number validation schema
   */
  public static phoneSchema = Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .min(10)
    .max(15)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be in international format (+1234567890)',
      'string.min': 'Phone number must be at least 10 digits',
      'string.max': 'Phone number must be no more than 15 digits',
      'any.required': 'Phone number is required'
    });

  /**
   * Email validation schema
   */
  public static emailSchema = Joi.string()
    .email({ minDomainSegments: 2, tlds: { allow: true } })
    .max(254)
    .lowercase()
    .trim()
    .required()
    .messages({
      'string.email': 'Please provide a valid email address',
      'string.max': 'Email address is too long',
      'any.required': 'Email address is required'
    });

  /**
   * Password validation schema
   */
  public static passwordSchema = Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.max': 'Password must be no more than 128 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      'any.required': 'Password is required'
    });

  /**
   * OTP validation schema
   */
  public static otpSchema = Joi.string()
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.pattern.base': 'OTP must be exactly 6 digits',
      'any.required': 'OTP is required'
    });

  /**
   * Sanitize input to prevent XSS and injection attacks
   */
  public static sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
    const sanitizeValue = (value: any): any => {
      if (typeof value === 'string') {
        return value
          .replace(/[<>]/g, '') // Remove angle brackets
          .replace(/javascript:/gi, '') // Remove javascript: protocol
          .replace(/on\w+=/gi, '') // Remove event handlers
          .trim();
      }
      
      if (typeof value === 'object' && value !== null) {
        const sanitized: any = Array.isArray(value) ? [] : {};
        for (const key in value) {
          sanitized[key] = sanitizeValue(value[key]);
        }
        return sanitized;
      }
      
      return value;
    };

    // Sanitize request body
    if (req.body) {
      req.body = sanitizeValue(req.body);
    }

    // Sanitize query parameters
    if (req.query) {
      req.query = sanitizeValue(req.query);
    }

    next();
  };

  /**
   * Rate limiting validation
   */
  public static rateLimitValidation = (
    maxAttempts: number = 5,
    windowMs: number = 15 * 60 * 1000 // 15 minutes
  ) => {
    const attempts = new Map<string, { count: number; resetTime: number }>();

    return (req: Request, res: Response, next: NextFunction) => {
      const identifier = req.ip || req.connection.remoteAddress || 'unknown';
      const now = Date.now();
      
      // Clean up expired entries
      for (const [key, value] of attempts.entries()) {
        if (now > value.resetTime) {
          attempts.delete(key);
        }
      }

      const userAttempts = attempts.get(identifier);
      
      if (!userAttempts) {
        attempts.set(identifier, { count: 1, resetTime: now + windowMs });
        return next();
      }

      if (now > userAttempts.resetTime) {
        attempts.set(identifier, { count: 1, resetTime: now + windowMs });
        return next();
      }

      if (userAttempts.count >= maxAttempts) {
        const error = ErrorHandlerMiddleware.createOperationalError(
          'Too many requests. Please try again later.',
          'RATE_LIMIT_EXCEEDED',
          429,
          {
            retryAfter: Math.ceil((userAttempts.resetTime - now) / 1000),
            maxAttempts,
            windowMs
          }
        );
        return ErrorHandlerMiddleware.handleError(error, req, res, next);
      }

      userAttempts.count++;
      next();
    };
  };

  /**
   * Constraint violation detection middleware
   */
  public static constraintViolationHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    // PostgreSQL constraint violations
    if (err.code === '23505') { // Unique violation
      const field = EnhancedValidationMiddleware.extractFieldFromConstraint(err.constraint || err.detail);
      const error = ErrorHandlerMiddleware.createOperationalError(
        EnhancedValidationMiddleware.getConstraintErrorMessage(field, 'duplicate'),
        'DUPLICATE_RESOURCE',
        409,
        {
          field,
          constraint: err.constraint,
          detail: err.detail
        }
      );
      return ErrorHandlerMiddleware.handleError(error, req, res, next);
    }

    if (err.code === '23503') { // Foreign key violation
      const error = ErrorHandlerMiddleware.createOperationalError(
        'Referenced resource not found',
        'INVALID_REFERENCE',
        400,
        {
          constraint: err.constraint,
          detail: err.detail
        }
      );
      return ErrorHandlerMiddleware.handleError(error, req, res, next);
    }

    if (err.code === '23502') { // Not null violation
      const field = EnhancedValidationMiddleware.extractFieldFromConstraint(err.column);
      const error = ErrorHandlerMiddleware.createOperationalError(
        `${field} is required`,
        'MISSING_REQUIRED_FIELD',
        400,
        {
          field,
          column: err.column
        }
      );
      return ErrorHandlerMiddleware.handleError(error, req, res, next);
    }

    next(err);
  };

  /**
   * Format validation errors for consistent response
   */
  private static formatValidationError(validationErrors: any[]): any {
    const details = validationErrors.flatMap(error => 
      error.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
        location: error.location
      }))
    );

    return {
      name: 'ValidationError',
      message: 'Request validation failed',
      details,
      isJoi: true
    };
  }

  /**
   * Extract field name from constraint error
   */
  private static extractFieldFromConstraint(constraint: string): string {
    if (!constraint) return 'field';
    
    // Common patterns for field extraction
    const patterns = [
      /users_(.+)_key/, // users_email_key -> email
      /(.+)_unique/, // email_unique -> email
      /(.+)_idx/, // phone_idx -> phone
      /(.+)_constraint/ // phone_constraint -> phone
    ];

    for (const pattern of patterns) {
      const match = constraint.match(pattern);
      if (match && match[1]) {
        return match[1].replace(/_/g, ' ');
      }
    }

    return constraint.replace(/_/g, ' ');
  }

  /**
   * Get user-friendly constraint error message
   */
  private static getConstraintErrorMessage(field: string, type: string): string {
    const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
    
    switch (type) {
      case 'duplicate':
        if (field.includes('email')) {
          return 'This email address is already registered. Please use a different email or try logging in.';
        }
        if (field.includes('phone')) {
          return 'This phone number is already registered. Please use a different number or try logging in.';
        }
        return `${fieldName} already exists. Please use a different value.`;
      
      default:
        return `${fieldName} constraint violation occurred.`;
    }
  }

  /**
   * Authentication-specific validation schemas
   */
  public static authSchemas = {
    phoneSignupStart: {
      body: Joi.object({
        phone: EnhancedValidationMiddleware.phoneSchema
      })
    },

    phoneVerify: {
      body: Joi.object({
        phone: EnhancedValidationMiddleware.phoneSchema,
        otp: EnhancedValidationMiddleware.otpSchema
      })
    },

    emailSignupStart: {
      body: Joi.object({
        email: EnhancedValidationMiddleware.emailSchema
      })
    },

    emailVerify: {
      body: Joi.object({
        email: EnhancedValidationMiddleware.emailSchema,
        code: EnhancedValidationMiddleware.otpSchema
      })
    },

    passwordCreation: {
      body: Joi.object({
        password: EnhancedValidationMiddleware.passwordSchema
      })
    },

    login: {
      body: Joi.object({
        email: EnhancedValidationMiddleware.emailSchema.optional(),
        phone: EnhancedValidationMiddleware.phoneSchema.optional(),
        password: Joi.string().required().messages({
          'any.required': 'Password is required'
        }),
        otp: EnhancedValidationMiddleware.otpSchema.optional()
      }).or('email', 'phone').messages({
        'object.missing': 'Either email or phone is required'
      })
    }
  };
}

// Export commonly used validation functions
export const validate = EnhancedValidationMiddleware.validate;
export const sanitizeInput = EnhancedValidationMiddleware.sanitizeInput;
export const rateLimitValidation = EnhancedValidationMiddleware.rateLimitValidation;
export const constraintViolationHandler = EnhancedValidationMiddleware.constraintViolationHandler;
export const authSchemas = EnhancedValidationMiddleware.authSchemas;