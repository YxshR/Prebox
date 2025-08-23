/**
 * Comprehensive Security Middleware
 * 
 * This middleware consolidates all security measures required for the authentication system:
 * - Rate limiting for authentication endpoints
 * - Input sanitization and validation
 * - Secure password hashing and JWT token management
 * - CORS configuration and security headers
 * - Request size limiting and timeout handling
 * - IP blocking and threat detection
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import helmet from 'helmet';
import redisClient from '../config/redis';
import { logger } from '../shared/logger';

export interface SecurityRequest extends Request {
  user?: any;
  securityContext?: {
    ipAddress: string;
    userAgent: string;
    requestId: string;
    startTime: number;
    rateLimitInfo?: {
      limit: number;
      remaining: number;
      resetTime: Date;
    };
  };
}

export class ComprehensiveSecurityMiddleware {
  private rateLimiters: Map<string, any> = new Map();
  private blockedIPs: Set<string> = new Set();
  private suspiciousIPs: Map<string, { count: number; lastSeen: number }> = new Map();

  constructor() {
    this.initializeRateLimiters();
    this.startCleanupTasks();
  }

  /**
   * Initialize Redis-based rate limiters for different endpoint types
   */
  private initializeRateLimiters(): void {
    try {
      // Authentication endpoints - strict rate limiting
      this.rateLimiters.set('auth', new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: 'auth_rl',
        points: 5, // Number of attempts
        duration: 900, // Per 15 minutes
        blockDuration: 900, // Block for 15 minutes
        execEvenly: true
      }));

      // Phone verification - moderate rate limiting
      this.rateLimiters.set('phone', new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: 'phone_rl',
        points: 3, // Number of OTP requests
        duration: 300, // Per 5 minutes
        blockDuration: 600, // Block for 10 minutes
        execEvenly: true
      }));

      // Email verification - moderate rate limiting
      this.rateLimiters.set('email', new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: 'email_rl',
        points: 5, // Number of email requests
        duration: 600, // Per 10 minutes
        blockDuration: 300, // Block for 5 minutes
        execEvenly: true
      }));

      // General API - lenient rate limiting
      this.rateLimiters.set('general', new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: 'general_rl',
        points: 100, // Number of requests
        duration: 900, // Per 15 minutes
        blockDuration: 60, // Block for 1 minute
        execEvenly: true
      }));

      // Password reset - very strict rate limiting
      this.rateLimiters.set('password', new RateLimiterRedis({
        storeClient: redisClient,
        keyPrefix: 'password_rl',
        points: 2, // Number of attempts
        duration: 3600, // Per 1 hour
        blockDuration: 3600, // Block for 1 hour
        execEvenly: true
      }));

      logger.info('Rate limiters initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize rate limiters:', error);
      // Fallback to in-memory rate limiting if Redis fails
      this.initializeFallbackRateLimiters();
    }
  }

  /**
   * Fallback in-memory rate limiters if Redis is unavailable
   */
  private initializeFallbackRateLimiters(): void {
    const createMemoryLimiter = (windowMs: number, max: number, message: string) => {
      return rateLimit({
        windowMs,
        max,
        message: {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message,
            retryAfter: Math.ceil(windowMs / 1000)
          }
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req: Request) => this.getClientIp(req)
      });
    };

    this.rateLimiters.set('auth_fallback', createMemoryLimiter(
      15 * 60 * 1000, // 15 minutes
      5, // 5 attempts
      'Too many authentication attempts. Please try again in 15 minutes.'
    ));

    this.rateLimiters.set('phone_fallback', createMemoryLimiter(
      5 * 60 * 1000, // 5 minutes
      3, // 3 attempts
      'Too many OTP requests. Please try again in 5 minutes.'
    ));

    this.rateLimiters.set('general_fallback', createMemoryLimiter(
      15 * 60 * 1000, // 15 minutes
      100, // 100 requests
      'Too many requests. Please try again later.'
    ));

    logger.warn('Using fallback in-memory rate limiters');
  }

  /**
   * Security headers middleware with comprehensive protection
   */
  public securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
    // Use helmet for basic security headers
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"]
        }
      },
      crossOriginEmbedderPolicy: false, // Disable for API compatibility
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      }
    })(req, res, () => {
      // Additional custom security headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      
      // Remove server information
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');
      
      // API-specific headers
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      
      next();
    });
  };

  /**
   * Enhanced CORS middleware with security considerations
   */
  public corsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    const allowedOrigins = this.getAllowedOrigins();
    
    // Set CORS headers based on environment and origin validation
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (process.env.NODE_ENV === 'development') {
      // More permissive in development
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    } else {
      // Production: only allow specific origins
      res.setHeader('Access-Control-Allow-Origin', allowedOrigins[0] || 'null');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 
      'Content-Type, Authorization, X-API-Key, X-Requested-With, X-Session-ID, X-Client-Version'
    );
    res.setHeader('Access-Control-Expose-Headers', 
      'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-Request-ID'
    );
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    
    next();
  };

  /**
   * Initialize security context for each request
   */
  public initializeSecurityContext = (req: SecurityRequest, res: Response, next: NextFunction): void => {
    const ipAddress = this.getClientIp(req);
    const userAgent = req.get('User-Agent') || 'Unknown';
    const requestId = this.generateRequestId();
    const startTime = Date.now();

    req.securityContext = {
      ipAddress,
      userAgent,
      requestId,
      startTime
    };

    // Add request ID to response headers
    res.setHeader('X-Request-ID', requestId);
    
    // Log request for security monitoring
    logger.info('Request initiated', {
      requestId,
      method: req.method,
      url: req.url,
      ipAddress,
      userAgent: userAgent.substring(0, 100) // Truncate long user agents
    });

    next();
  };

  /**
   * Rate limiting middleware factory for different endpoint types
   */
  public createRateLimit = (type: 'auth' | 'phone' | 'email' | 'general' | 'password') => {
    return async (req: SecurityRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const ipAddress = req.securityContext?.ipAddress || this.getClientIp(req);
        const rateLimiter = this.rateLimiters.get(type);

        if (!rateLimiter) {
          // Use fallback rate limiter
          const fallbackLimiter = this.rateLimiters.get(`${type}_fallback`);
          if (fallbackLimiter) {
            return fallbackLimiter(req, res, next);
          }
          return next();
        }

        // Check rate limit
        const resRateLimiter = await rateLimiter.consume(ipAddress);
        
        // Add rate limit info to security context
        if (req.securityContext) {
          req.securityContext.rateLimitInfo = {
            limit: rateLimiter.points,
            remaining: resRateLimiter.remainingHits || 0,
            resetTime: new Date(Date.now() + (resRateLimiter.msBeforeNext || 0))
          };
        }

        // Set rate limit headers
        res.setHeader('X-RateLimit-Limit', rateLimiter.points);
        res.setHeader('X-RateLimit-Remaining', resRateLimiter.remainingHits || 0);
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + (resRateLimiter.msBeforeNext || 0)).toISOString());

        next();
      } catch (rejRes: any) {
        // Rate limit exceeded
        const secs = Math.round(rejRes.msBeforeNext / 1000) || 1;
        
        res.setHeader('Retry-After', String(secs));
        res.setHeader('X-RateLimit-Limit', rejRes.totalHits || 0);
        res.setHeader('X-RateLimit-Remaining', 0);
        res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rejRes.msBeforeNext).toISOString());

        // Log rate limit violation
        logger.warn('Rate limit exceeded', {
          type,
          ipAddress: req.securityContext?.ipAddress || this.getClientIp(req),
          userAgent: req.securityContext?.userAgent,
          requestId: req.securityContext?.requestId,
          endpoint: req.path
        });

        // Track suspicious activity
        this.trackSuspiciousActivity(req.securityContext?.ipAddress || this.getClientIp(req));

        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many ${type} requests. Please try again in ${secs} seconds.`,
            retryAfter: secs,
            type
          }
        });
      }
    };
  };

  /**
   * Comprehensive input sanitization middleware
   */
  public sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Sanitize query parameters
      if (req.query) {
        req.query = this.sanitizeObject(req.query);
      }

      // Sanitize request body
      if (req.body) {
        req.body = this.sanitizeObject(req.body);
      }

      // Sanitize route parameters
      if (req.params) {
        req.params = this.sanitizeObject(req.params);
      }

      next();
    } catch (error) {
      logger.error('Input sanitization error:', error);
      res.status(400).json({
        success: false,
        error: {
          code: 'INPUT_SANITIZATION_ERROR',
          message: 'Invalid input data'
        }
      });
    }
  };

  /**
   * Request size and timeout middleware
   */
  public requestLimits = (maxSize: string = '10mb', timeoutMs: number = 30000) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Set request timeout
      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          res.status(408).json({
            success: false,
            error: {
              code: 'REQUEST_TIMEOUT',
              message: 'Request timeout - please try again',
              timeoutMs
            }
          });
        }
      }, timeoutMs);

      // Clear timeout when response finishes
      res.on('finish', () => clearTimeout(timeout));
      res.on('close', () => clearTimeout(timeout));

      // Check content length
      const contentLength = req.headers['content-length'];
      if (contentLength) {
        const sizeInBytes = parseInt(contentLength);
        const maxSizeInBytes = this.parseSize(maxSize);
        
        if (sizeInBytes > maxSizeInBytes) {
          clearTimeout(timeout);
          return res.status(413).json({
            success: false,
            error: {
              code: 'PAYLOAD_TOO_LARGE',
              message: `Request payload too large. Maximum size: ${maxSize}`,
              maxSize,
              receivedSize: this.formatBytes(sizeInBytes)
            }
          });
        }
      }

      next();
    };
  };

  /**
   * IP blocking middleware
   */
  public checkBlockedIPs = (req: SecurityRequest, res: Response, next: NextFunction): void => {
    const ipAddress = req.securityContext?.ipAddress || this.getClientIp(req);
    
    if (this.blockedIPs.has(ipAddress)) {
      logger.warn('Blocked IP access attempt', {
        ipAddress,
        userAgent: req.securityContext?.userAgent,
        endpoint: req.path,
        requestId: req.securityContext?.requestId
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'IP_BLOCKED',
          message: 'Access denied from this IP address'
        }
      });
      return;
    }

    next();
  };

  /**
   * Slow down middleware for repeated requests
   */
  public slowDownMiddleware = slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutes
    delayAfter: 50, // Start delaying after 50 requests
    delayMs: 500, // 500ms delay per request over the limit
    maxDelayMs: 10000, // Maximum delay of 10 seconds
    keyGenerator: (req: Request) => this.getClientIp(req),
    skip: (req: Request) => {
      // Skip for authenticated API key requests
      return !!(req.headers['x-api-key'] || req.headers.authorization);
    }
  });

  /**
   * Security monitoring middleware
   */
  public securityMonitoring = (req: SecurityRequest, res: Response, next: NextFunction): void => {
    const originalSend = res.send;
    
    res.send = function(body: any) {
      const responseTime = Date.now() - (req.securityContext?.startTime || 0);
      
      // Log security events
      const logData = {
        requestId: req.securityContext?.requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        responseTime,
        ipAddress: req.securityContext?.ipAddress,
        userAgent: req.securityContext?.userAgent,
        hasApiKey: !!req.headers['x-api-key'],
        hasAuth: !!req.headers.authorization
      };

      // Log failed requests for security monitoring
      if (res.statusCode >= 400) {
        logger.warn('Failed request', logData);
      }

      // Log slow requests
      if (responseTime > 5000) {
        logger.warn('Slow request detected', logData);
      }

      // Track authentication failures
      if (req.path.includes('/auth/') && res.statusCode === 401) {
        logger.warn('Authentication failure', logData);
      }

      return originalSend.call(this, body);
    };

    next();
  };

  /**
   * Password hashing utilities
   */
  public static async hashPassword(password: string): Promise<string> {
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');
    return bcrypt.hash(password, saltRounds);
  }

  public static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * JWT token utilities with enhanced security
   */
  public static generateAccessToken(payload: any): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    return jwt.sign(payload, secret, {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
      issuer: process.env.JWT_ISSUER || 'bulk-email-platform',
      audience: process.env.JWT_AUDIENCE || 'bulk-email-platform-users',
      algorithm: 'HS256'
    });
  }

  public static generateRefreshToken(payload: any): string {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET environment variable is required');
    }

    return jwt.sign(payload, secret, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: process.env.JWT_ISSUER || 'bulk-email-platform',
      audience: process.env.JWT_AUDIENCE || 'bulk-email-platform-users',
      algorithm: 'HS256'
    });
  }

  public static verifyAccessToken(token: string): any {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }

    return jwt.verify(token, secret, {
      issuer: process.env.JWT_ISSUER || 'bulk-email-platform',
      audience: process.env.JWT_AUDIENCE || 'bulk-email-platform-users',
      algorithms: ['HS256']
    });
  }

  public static verifyRefreshToken(token: string): any {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET environment variable is required');
    }

    return jwt.verify(token, secret, {
      issuer: process.env.JWT_ISSUER || 'bulk-email-platform',
      audience: process.env.JWT_AUDIENCE || 'bulk-email-platform-users',
      algorithms: ['HS256']
    });
  }

  // Private helper methods
  private getClientIp(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] as string ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           '127.0.0.1';
  }

  private getAllowedOrigins(): string[] {
    const origins = [];
    
    // Environment-configured origins
    if (process.env.CORS_ORIGIN) {
      origins.push(...process.env.CORS_ORIGIN.split(',').map(o => o.trim()));
    }
    
    // Frontend URLs
    if (process.env.FRONTEND_URL) origins.push(process.env.FRONTEND_URL);
    if (process.env.ADMIN_FRONTEND_URL) origins.push(process.env.ADMIN_FRONTEND_URL);
    
    // Development origins
    if (process.env.NODE_ENV === 'development') {
      origins.push(
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
        'http://127.0.0.1:3002'
      );
    }
    
    return [...new Set(origins)];
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const sanitizedKey = this.sanitizeString(key);
      sanitized[sanitizedKey] = this.sanitizeObject(value);
    }

    return sanitized;
  }

  private sanitizeString(str: any): any {
    if (typeof str !== 'string') {
      return str;
    }

    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .replace(/data:text\/html/gi, '') // Remove data URLs
      .replace(/vbscript:/gi, '') // Remove vbscript
      .replace(/expression\s*\(/gi, '') // Remove CSS expressions
      .trim();
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private parseSize(size: string): number {
    const units: { [key: string]: number } = {
      'b': 1,
      'kb': 1024,
      'mb': 1024 * 1024,
      'gb': 1024 * 1024 * 1024
    };

    const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)(b|kb|mb|gb)$/);
    if (!match) return 10 * 1024 * 1024; // Default 10MB

    const value = parseFloat(match[1]);
    const unit = match[2];
    
    return value * units[unit];
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  private trackSuspiciousActivity(ipAddress: string): void {
    const now = Date.now();
    const suspicious = this.suspiciousIPs.get(ipAddress) || { count: 0, lastSeen: now };
    
    suspicious.count++;
    suspicious.lastSeen = now;
    
    this.suspiciousIPs.set(ipAddress, suspicious);
    
    // Block IP if too many violations
    if (suspicious.count >= 10) {
      this.blockedIPs.add(ipAddress);
      logger.warn('IP blocked due to suspicious activity', { ipAddress, violations: suspicious.count });
    }
  }

  private startCleanupTasks(): void {
    // Clean up suspicious IPs every hour
    setInterval(() => {
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      
      for (const [ip, data] of this.suspiciousIPs.entries()) {
        if (now - data.lastSeen > oneHour) {
          this.suspiciousIPs.delete(ip);
        }
      }
    }, 60 * 60 * 1000); // Run every hour

    // Clean up blocked IPs every 24 hours
    setInterval(() => {
      this.blockedIPs.clear();
      logger.info('Blocked IPs cleared');
    }, 24 * 60 * 60 * 1000); // Run every 24 hours
  }
}

export default ComprehensiveSecurityMiddleware;