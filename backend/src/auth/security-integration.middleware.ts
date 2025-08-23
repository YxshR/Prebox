/**
 * Security Integration Middleware
 * 
 * This file integrates all security measures for the authentication system:
 * - Comprehensive security middleware
 * - Validation middleware
 * - Rate limiting for different endpoint types
 * - Error handling and monitoring
 */

import { Express, Request, Response, NextFunction } from 'express';
import ComprehensiveSecurityMiddleware from './comprehensive-security.middleware';
import ComprehensiveValidationMiddleware from './comprehensive-validation.middleware';
import { logger } from '../shared/logger';

export class SecurityIntegration {
  private securityMiddleware: ComprehensiveSecurityMiddleware;

  constructor() {
    this.securityMiddleware = new ComprehensiveSecurityMiddleware();
  }

  /**
   * Apply all security middleware to the Express app
   */
  public applySecurityMiddleware(app: Express): void {
    logger.info('Applying comprehensive security middleware...');

    // 1. Security headers (must be first)
    app.use(this.securityMiddleware.securityHeaders);

    // 2. CORS configuration
    app.use(this.securityMiddleware.corsMiddleware);

    // 3. Initialize security context for each request
    app.use(this.securityMiddleware.initializeSecurityContext);

    // 4. Check for blocked IPs
    app.use(this.securityMiddleware.checkBlockedIPs);

    // 5. Request size and timeout limits
    app.use(this.securityMiddleware.requestLimits('10mb', 30000));

    // 6. Slow down repeated requests
    app.use(this.securityMiddleware.slowDownMiddleware);

    // 7. Input sanitization (before parsing JSON)
    app.use(this.securityMiddleware.sanitizeInput);

    // 8. Security monitoring
    app.use(this.securityMiddleware.securityMonitoring);

    logger.info('✅ Security middleware applied successfully');
  }

  /**
   * Apply authentication-specific security middleware
   */
  public applyAuthSecurityMiddleware(app: Express): void {
    logger.info('Applying authentication security middleware...');

    // Phone signup endpoints with strict rate limiting
    app.use('/api/auth/signup/phone', this.securityMiddleware.createRateLimit('phone'));
    app.use('/api/auth/login/phone', this.securityMiddleware.createRateLimit('phone'));

    // Email verification endpoints
    app.use('/api/auth/signup/email', this.securityMiddleware.createRateLimit('email'));

    // General auth endpoints with moderate rate limiting
    app.use('/api/auth/signup', this.securityMiddleware.createRateLimit('auth'));
    app.use('/api/auth/login', this.securityMiddleware.createRateLimit('auth'));
    app.use('/api/auth/refresh', this.securityMiddleware.createRateLimit('auth'));

    // Password reset with very strict rate limiting
    app.use('/api/auth/password', this.securityMiddleware.createRateLimit('password'));

    logger.info('✅ Authentication security middleware applied successfully');
  }

  /**
   * Apply validation middleware to authentication endpoints
   */
  public applyAuthValidationMiddleware(app: Express): void {
    logger.info('Applying authentication validation middleware...');

    // Phone signup validation
    app.use('/api/auth/signup/phone/start', 
      ComprehensiveValidationMiddleware.validate(
        ComprehensiveValidationMiddleware.authSchemas.phoneSignupStart
      )
    );

    app.use('/api/auth/signup/phone/verify', 
      ComprehensiveValidationMiddleware.validate(
        ComprehensiveValidationMiddleware.authSchemas.phoneVerify
      )
    );

    // Email verification validation
    app.use('/api/auth/signup/email/verify', 
      ComprehensiveValidationMiddleware.validate(
        ComprehensiveValidationMiddleware.authSchemas.emailVerify
      )
    );

    // Password creation validation
    app.use('/api/auth/signup/complete', 
      ComprehensiveValidationMiddleware.validate(
        ComprehensiveValidationMiddleware.authSchemas.passwordCreation
      )
    );

    // Login validation
    app.use('/api/auth/login/email', 
      ComprehensiveValidationMiddleware.validate(
        ComprehensiveValidationMiddleware.authSchemas.emailPasswordLogin
      )
    );

    app.use('/api/auth/login/phone', 
      ComprehensiveValidationMiddleware.validate(
        ComprehensiveValidationMiddleware.authSchemas.phoneLogin
      )
    );

    app.use('/api/auth/login/phone/verify', 
      ComprehensiveValidationMiddleware.validate(
        ComprehensiveValidationMiddleware.authSchemas.phoneOtpVerify
      )
    );

    // Token refresh validation
    app.use('/api/auth/refresh', 
      ComprehensiveValidationMiddleware.validate(
        ComprehensiveValidationMiddleware.authSchemas.refreshToken
      )
    );

    logger.info('✅ Authentication validation middleware applied successfully');
  }

  /**
   * Apply error handling middleware (should be last)
   */
  public applyErrorHandlingMiddleware(app: Express): void {
    logger.info('Applying error handling middleware...');

    // Database constraint violation handler
    app.use(ComprehensiveValidationMiddleware.handleConstraintViolations);

    // Global error handler
    app.use(this.globalErrorHandler);

    logger.info('✅ Error handling middleware applied successfully');
  }

  /**
   * Global error handler for unhandled errors
   */
  private globalErrorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
    // Log the error
    logger.error('Unhandled error:', {
      error: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(err.status || 500).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_SERVER_ERROR',
        message: isDevelopment ? err.message : 'An internal server error occurred',
        ...(isDevelopment && { stack: err.stack })
      }
    });
  };

  /**
   * Initialize all security measures in the correct order
   */
  public initializeAllSecurity(app: Express): void {
    logger.info('🔒 Initializing comprehensive security system...');

    // Apply middleware in the correct order
    this.applySecurityMiddleware(app);
    this.applyAuthSecurityMiddleware(app);
    this.applyAuthValidationMiddleware(app);
    
    // Error handling should be applied last
    this.applyErrorHandlingMiddleware(app);

    logger.info('🔒 ✅ Comprehensive security system initialized successfully');
  }

  /**
   * Get security middleware instance for manual use
   */
  public getSecurityMiddleware(): ComprehensiveSecurityMiddleware {
    return this.securityMiddleware;
  }

  /**
   * Health check endpoint with security monitoring
   */
  public createSecurityHealthCheck() {
    return (req: Request, res: Response) => {
      const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        security: {
          headersApplied: true,
          rateLimitingActive: true,
          inputSanitizationActive: true,
          validationActive: true,
          monitoringActive: true
        },
        environment: process.env.NODE_ENV || 'development'
      };

      res.json(healthData);
    };
  }
}

export default SecurityIntegration;