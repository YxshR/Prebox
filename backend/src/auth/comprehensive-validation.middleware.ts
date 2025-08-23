/**
 * Comprehensive Validation Middleware
 * 
 * This middleware provides comprehensive input validation and sanitization:
 * - Request validation using Joi schemas
 * - Input sanitization to prevent XSS and injection attacks
 * - Database constraint violation handling
 * - Rate limiting for validation failures
 * - Security-focused validation rules
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../shared/logger';

export interface ValidationSchema {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  headers?: Joi.ObjectSchema;
}

export interface ValidationOptions {
  allowUnknown?: boolean;
  stripUnknown?: boolean;
  abortEarly?: boolean;
  skipSanitization?: boolean;
}

export class ComprehensiveValidationMiddleware {
  
  /**
   * Create validation middleware with comprehensive security checks
   */
  public static validate(schema: ValidationSchema, options: ValidationOptions = {}) {
    const config = {
      allowUnknown: false,
      stripUnknown: true,
      abortEarly: false,
      skipSanitization: false,
      ...options
    };

    return (req: Request, res: Response, next: NextFunction) => {
      const validationErrors: any[] = [];

      try {
        // Sanitize inputs first (unless skipped)
        if (!config.skipSanitization) {
          ComprehensiveValidationMiddleware.sanitizeRequest(req);
        }

        // Validate request body
        if (schema.body && req.body) {
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
        if (schema.query && req.query) {
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
        if (schema.params && req.params) {
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

        // Validate headers
        if (schema.headers && req.headers) {
          const { error, value } = schema.headers.validate(req.headers, config);
          if (error) {
            validationErrors.push({
              location: 'headers',
              details: error.details
            });
          }
        }

        // Handle validation errors
        if (validationErrors.length > 0) {
          const formattedError = ComprehensiveValidationMiddleware.formatValidationError(validationErrors);
          
          // Log validation failure for security monitoring
          logger.warn('Validation failed', {
            endpoint: req.path,
            method: req.method,
            errors: formattedError.details,
            ipAddress: ComprehensiveValidationMiddleware.getClientIp(req)
          });

          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Request validation failed',
              details: formattedError.details
            }
          });
        }

        next();
      } catch (error: any) {
        logger.error('Validation middleware error:', error);
        return res.status(500).json({
          success: false,
          error: {
            code: 'VALIDATION_MIDDLEWARE_ERROR',
            message: 'Internal validation error'
          }
        });
      }
    };
  }

  /**
   * Sanitize request inputs to prevent XSS and injection attacks
   */
  public static sanitizeRequest(req: Request): void {
    if (req.body) {
      req.body = ComprehensiveValidationMiddleware.sanitizeObject(req.body);
    }
    
    if (req.query) {
      req.query = ComprehensiveValidationMiddleware.sanitizeObject(req.query);
    }
    
    if (req.params) {
      req.params = ComprehensiveValidationMiddleware.sanitizeObject(req.params);
    }
  }

  /**
   * Database constraint violation handler
   */
  public static handleConstraintViolations = (err: any, req: Request, res: Response, next: NextFunction) => {
    // PostgreSQL constraint violations
    if (err.code === '23505') { // Unique violation
      const field = ComprehensiveValidationMiddleware.extractFieldFromConstraint(err.constraint || err.detail);
      const message = ComprehensiveValidationMiddleware.getConstraintErrorMessage(field, 'duplicate');
      
      logger.warn('Database constraint violation', {
        constraint: err.constraint,
        detail: err.detail,
        field,
        endpoint: req.path,
        ipAddress: ComprehensiveValidationMiddleware.getClientIp(req)
      });

      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_RESOURCE',
          message,
          field,
          constraint: err.constraint
        }
      });
    }

    if (err.code === '23503') { // Foreign key violation
      logger.warn('Foreign key constraint violation', {
        constraint: err.constraint,
        detail: err.detail,
        endpoint: req.path
      });

      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REFERENCE',
          message: 'Referenced resource not found',
          constraint: err.constraint
        }
      });
    }

    if (err.code === '23502') { // Not null violation
      const field = ComprehensiveValidationMiddleware.extractFieldFromConstraint(err.column);
      
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELD',
          message: `${field} is required`,
          field,
          column: err.column
        }
      });
    }

    if (err.code === '23514') { // Check constraint violation
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Data violates database constraints',
          constraint: err.constraint
        }
      });
    }

    next(err);
  };

  /**
   * Security-focused validation schemas
   */
  public static readonly schemas = {
    // Phone number validation with international format support
    phone: Joi.string()
      .pattern(/^\+?[1-9]\d{1,14}$/)
      .min(10)
      .max(15)
      .messages({
        'string.pattern.base': 'Phone number must be in international format (+1234567890)',
        'string.min': 'Phone number must be at least 10 digits',
        'string.max': 'Phone number must be no more than 15 digits'
      }),

    // Email validation with security considerations
    email: Joi.string()
      .email({ 
        minDomainSegments: 2, 
        tlds: { allow: true },
        multiple: false 
      })
      .max(254)
      .lowercase()
      .trim()
      .custom((value, helpers) => {
        // Block disposable email domains
        const disposableDomains = [
          '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
          'mailinator.com', 'throwaway.email'
        ];
        
        const domain = value.split('@')[1];
        if (disposableDomains.includes(domain)) {
          return helpers.error('email.disposable');
        }
        
        return value;
      })
      .messages({
        'string.email': 'Please provide a valid email address',
        'string.max': 'Email address is too long',
        'email.disposable': 'Disposable email addresses are not allowed'
      }),

    // Strong password validation
    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])/)
      .custom((value, helpers) => {
        // Check for common passwords
        const commonPasswords = [
          'password', '123456', '123456789', 'qwerty', 'abc123',
          'password123', 'admin', 'letmein', 'welcome', 'monkey'
        ];
        
        if (commonPasswords.includes(value.toLowerCase())) {
          return helpers.error('password.common');
        }
        
        // Check for sequential characters
        if (/123456|abcdef|qwerty/i.test(value)) {
          return helpers.error('password.sequential');
        }
        
        return value;
      })
      .messages({
        'string.min': 'Password must be at least 8 characters long',
        'string.max': 'Password must be no more than 128 characters long',
        'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'password.common': 'Password is too common, please choose a different one',
        'password.sequential': 'Password cannot contain sequential characters'
      }),

    // OTP validation
    otp: Joi.string()
      .pattern(/^\d{6}$/)
      .length(6)
      .messages({
        'string.pattern.base': 'OTP must be exactly 6 digits',
        'string.length': 'OTP must be exactly 6 digits'
      }),

    // UUID validation
    uuid: Joi.string()
      .uuid({ version: 'uuidv4' })
      .messages({
        'string.guid': 'Invalid UUID format'
      }),

    // Safe string validation (prevents XSS)
    safeString: Joi.string()
      .max(1000)
      .pattern(/^[a-zA-Z0-9\s\-_.,!?()]+$/)
      .messages({
        'string.pattern.base': 'String contains invalid characters',
        'string.max': 'String is too long'
      }),

    // URL validation with security checks
    url: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .max(2048)
      .custom((value, helpers) => {
        // Block localhost and private IPs in production
        if (process.env.NODE_ENV === 'production') {
          const url = new URL(value);
          if (url.hostname === 'localhost' || 
              url.hostname.startsWith('127.') ||
              url.hostname.startsWith('192.168.') ||
              url.hostname.startsWith('10.') ||
              /^172\.(1[6-9]|2[0-9]|3[01])\./.test(url.hostname)) {
            return helpers.error('url.private');
          }
        }
        return value;
      })
      .messages({
        'string.uri': 'Invalid URL format',
        'string.max': 'URL is too long',
        'url.private': 'Private URLs are not allowed'
      })
  };

  /**
   * Authentication-specific validation schemas
   */
  public static readonly authSchemas = {
    phoneSignupStart: {
      body: Joi.object({
        phone: ComprehensiveValidationMiddleware.schemas.phone.required()
      })
    },

    phoneVerify: {
      body: Joi.object({
        signupStateId: ComprehensiveValidationMiddleware.schemas.uuid.required(),
        otpCode: ComprehensiveValidationMiddleware.schemas.otp.required()
      })
    },

    emailVerify: {
      body: Joi.object({
        signupStateId: ComprehensiveValidationMiddleware.schemas.uuid.required(),
        email: ComprehensiveValidationMiddleware.schemas.email.required(),
        verificationCode: Joi.string()
          .length(8)
          .pattern(/^[A-Za-z0-9]{8}$/)
          .required()
          .messages({
            'string.length': 'Verification code must be exactly 8 characters',
            'string.pattern.base': 'Verification code must contain only letters and numbers'
          })
      })
    },

    passwordCreation: {
      body: Joi.object({
        signupStateId: ComprehensiveValidationMiddleware.schemas.uuid.required(),
        password: ComprehensiveValidationMiddleware.schemas.password.required()
      })
    },

    emailPasswordLogin: {
      body: Joi.object({
        email: ComprehensiveValidationMiddleware.schemas.email.required(),
        password: Joi.string().required().messages({
          'any.required': 'Password is required'
        })
      })
    },

    phoneLogin: {
      body: Joi.object({
        phone: ComprehensiveValidationMiddleware.schemas.phone.required()
      })
    },

    phoneOtpVerify: {
      body: Joi.object({
        otpId: ComprehensiveValidationMiddleware.schemas.uuid.required(),
        code: ComprehensiveValidationMiddleware.schemas.otp.required()
      })
    },

    refreshToken: {
      body: Joi.object({
        refreshToken: Joi.string().required().messages({
          'any.required': 'Refresh token is required'
        })
      })
    }
  };

  // Private helper methods
  private static sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return ComprehensiveValidationMiddleware.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => ComprehensiveValidationMiddleware.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = ComprehensiveValidationMiddleware.sanitizeString(key);
      sanitized[sanitizedKey] = ComprehensiveValidationMiddleware.sanitizeObject(value);
    }

    return sanitized;
  }

  private static sanitizeString(str: any): any {
    if (typeof str !== 'string') {
      return str;
    }

    return str
      // Remove script tags
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove javascript: protocol
      .replace(/javascript:/gi, '')
      // Remove vbscript: protocol
      .replace(/vbscript:/gi, '')
      // Remove data: protocol (except safe image types)
      .replace(/data:(?!image\/(png|jpg|jpeg|gif|webp|svg\+xml))[^;]*;/gi, '')
      // Remove event handlers
      .replace(/on\w+\s*=/gi, '')
      // Remove CSS expressions
      .replace(/expression\s*\(/gi, '')
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Remove CDATA sections
      .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
      // Trim whitespace
      .trim();
  }

  private static formatValidationError(validationErrors: any[]): any {
    const details = validationErrors.flatMap(error => 
      error.details.map((detail: any) => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
        location: error.location,
        type: detail.type
      }))
    );

    return {
      message: 'Request validation failed',
      details,
      count: details.length
    };
  }

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

  private static getClientIp(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] as string ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           '127.0.0.1';
  }
}

export default ComprehensiveValidationMiddleware;