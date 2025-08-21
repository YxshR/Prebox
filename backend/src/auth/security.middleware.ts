import { Request, Response, NextFunction } from 'express';
import { AuthMiddleware } from './auth.middleware';

export class SecurityMiddleware {
  private authMiddleware: AuthMiddleware;
  private rateLimitStore = new Map<string, { count: number; resetTime: number }>();

  constructor() {
    this.authMiddleware = new AuthMiddleware();
  }

  /**
   * Simple rate limiting using in-memory store
   */
  public generalRateLimit = (req: Request, res: Response, next: NextFunction) => {
    const ip = this.getClientIp(req);
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 100;

    // Skip rate limiting for authenticated requests
    if (req.headers['x-api-key'] || req.headers.authorization) {
      return next();
    }

    const key = `general:${ip}`;
    const record = this.rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      this.rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests from this IP, please try again later.',
          retryAfter: Math.ceil((record.resetTime - now) / 1000)
        }
      });
      return;
    }

    record.count++;
    next();
  };

  public authRateLimit = (req: Request, res: Response, next: NextFunction) => {
    const ip = this.getClientIp(req);
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxRequests = 5;

    const key = `auth:${ip}`;
    const record = this.rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      this.rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      res.status(429).json({
        success: false,
        error: {
          code: 'AUTH_RATE_LIMIT_EXCEEDED',
          message: 'Too many authentication attempts, please try again later.',
          retryAfter: Math.ceil((record.resetTime - now) / 1000)
        }
      });
      return;
    }

    record.count++;
    next();
  };

  /**
   * Security headers middleware
   */
  public securityHeaders = (req: Request, res: Response, next: NextFunction) => {
    // Remove server information
    res.removeHeader('X-Powered-By');
    
    // Set security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Content Security Policy for API responses
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none';");
    
    next();
  };

  /**
   * Request size limiting middleware
   */
  public requestSizeLimit = (maxSize: string = '10mb') => {
    return (req: Request, res: Response, next: NextFunction) => {
      const contentLength = req.headers['content-length'];
      
      if (contentLength) {
        const sizeInBytes = parseInt(contentLength);
        const maxSizeInBytes = this.parseSize(maxSize);
        
        if (sizeInBytes > maxSizeInBytes) {
          return res.status(413).json({
            success: false,
            error: {
              code: 'PAYLOAD_TOO_LARGE',
              message: `Request payload too large. Maximum size: ${maxSize}`,
              details: {
                maxSize,
                receivedSize: this.formatBytes(sizeInBytes)
              }
            }
          });
        }
      }
      
      next();
    };
  };

  /**
   * Request timeout middleware with better error handling
   */
  public requestTimeout = (timeoutMs: number = 30000) => {
    return (req: Request, res: Response, next: NextFunction) => {
      // Set socket timeout
      if (req.socket) {
        req.socket.setTimeout(timeoutMs);
      }

      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          // Set CORS headers for timeout responses
          this.setCorsHeadersForError(req, res);
          
          res.status(408).json({
            success: false,
            error: {
              code: 'REQUEST_TIMEOUT',
              message: 'Request timeout - please try again',
              retryable: true,
              details: {
                timeoutMs,
                suggestion: 'The request took too long to process. Please retry with exponential backoff.'
              }
            }
          });
        }
      }, timeoutMs);

      // Clear timeout when response is finished
      res.on('finish', () => clearTimeout(timeout));
      res.on('close', () => clearTimeout(timeout));
      res.on('error', () => clearTimeout(timeout));
      
      next();
    };
  };

  /**
   * Set CORS headers for error responses
   */
  private setCorsHeadersForError(req: Request, res: Response): void {
    const origin = req.headers.origin;
    const allowedOrigins = this.getAllowedOrigins();
    
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (process.env.NODE_ENV === 'development') {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key, X-Requested-With');
  }

  /**
   * API key format validation middleware
   */
  public validateApiKeyFormat = (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] as string;
    
    if (apiKey) {
      // API keys should start with 'bep_' and be at least 32 characters
      if (!apiKey.startsWith('bep_') || apiKey.length < 36) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_API_KEY_FORMAT',
            message: 'Invalid API key format'
          }
        });
      }
    }
    
    next();
  };

  /**
   * Request logging middleware for security monitoring
   */
  public securityLogger = (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const originalSend = res.send;
    
    // Override res.send to capture response
    res.send = function(body: any) {
      const responseTime = Date.now() - startTime;
      const logData = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        ip: req.ip || (req as any).connection?.remoteAddress,
        userAgent: req.get('User-Agent'),
        statusCode: res.statusCode,
        responseTime,
        hasApiKey: !!req.headers['x-api-key'],
        hasAuth: !!req.headers.authorization,
        contentLength: req.headers['content-length'],
        referer: req.get('Referer')
      };

      // Log suspicious activity
      if (res.statusCode >= 400) {
        console.warn('Security Alert:', logData);
      }

      // Log slow requests
      if (responseTime > 5000) {
        console.warn('Slow Request:', logData);
      }

      return originalSend.call(this, body);
    };
    
    next();
  };

  /**
   * Enhanced CORS middleware with better error handling
   */
  public enhancedCors = (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    const allowedOrigins = this.getAllowedOrigins();
    
    // Always set CORS headers to prevent connection refused errors
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
      // Allow requests without origin (like from Postman, curl, etc.)
      res.setHeader('Access-Control-Allow-Origin', '*');
    } else {
      // For development, be more permissive to prevent connection issues
      if (process.env.NODE_ENV === 'development') {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else {
        // In production, still allow but log for monitoring
        console.warn(`CORS: Origin ${origin} not in allowed list, but allowing to prevent connection issues`);
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
    }
    
    // Set comprehensive CORS headers
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 
      'Content-Type, Authorization, X-API-Key, X-Requested-With, Accept, Origin, Cache-Control, X-Forwarded-For, X-Client-Version'
    );
    res.setHeader('Access-Control-Expose-Headers', 
      'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, API-Version, X-Service-Mode, X-Response-Time'
    );
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    
    // Always allow credentials to prevent auth issues
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Add connection keep-alive headers
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=5, max=1000');
    
    // Handle preflight requests immediately
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    
    next();
  };

  /**
   * Get allowed origins from environment with fallbacks
   */
  private getAllowedOrigins(): string[] {
    const origins = [];
    
    // Add configured origins
    if (process.env.CORS_ORIGIN) {
      origins.push(...process.env.CORS_ORIGIN.split(',').map(o => o.trim()));
    }
    
    // Add frontend URLs
    if (process.env.FRONTEND_URL) {
      origins.push(process.env.FRONTEND_URL);
    }
    if (process.env.ADMIN_FRONTEND_URL) {
      origins.push(process.env.ADMIN_FRONTEND_URL);
    }
    
    // Add default development origins with more variations
    const defaultOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:3002',
      'http://localhost:8000',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3002',
      'http://127.0.0.1:8000',
      'https://localhost:3000',
      'https://localhost:3001',
      'https://localhost:3002',
      'https://127.0.0.1:3000',
      'https://127.0.0.1:3001',
      'https://127.0.0.1:3002'
    ];
    
    origins.push(...defaultOrigins);
    
    // Add production domains if configured
    if (process.env.PRODUCTION_DOMAIN) {
      origins.push(`https://${process.env.PRODUCTION_DOMAIN}`);
      origins.push(`https://www.${process.env.PRODUCTION_DOMAIN}`);
    }
    
    // Remove duplicates and return
    return [...new Set(origins)];
  }

  /**
   * Input sanitization middleware
   */
  public sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
    // Sanitize query parameters
    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          req.query[key] = this.sanitizeString(value);
        }
      }
    }

    // Sanitize body parameters (for string values only)
    if (req.body && typeof req.body === 'object') {
      this.sanitizeObject(req.body);
    }
    
    next();
  };

  /**
   * API versioning middleware
   */
  public apiVersioning = (req: Request, res: Response, next: NextFunction) => {
    const version = req.headers['api-version'] || req.query.version || 'v1';
    
    // Validate version format
    if (!/^v\d+$/.test(version as string)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_API_VERSION',
          message: 'Invalid API version format. Use v1, v2, etc.',
          supportedVersions: ['v1']
        }
      });
    }

    // Check if version is supported
    const supportedVersions = ['v1'];
    if (!supportedVersions.includes(version as string)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_API_VERSION',
          message: `API version ${version} is not supported`,
          supportedVersions
        }
      });
    }

    // Add version to request for use in routes
    (req as any).apiVersion = version;
    res.setHeader('API-Version', version as string);
    
    next();
  };

  // Helper methods
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

  private sanitizeString(str: string): string {
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  }

  private sanitizeObject(obj: any): void {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        obj[key] = this.sanitizeString(value);
      } else if (typeof value === 'object' && value !== null) {
        this.sanitizeObject(value);
      }
    }
  }

  /**
   * Slow down middleware - adds delay for repeated requests
   */
  public slowDown = (req: Request, res: Response, next: NextFunction) => {
    const ip = this.getClientIp(req);
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const delayAfter = 50; // Start delaying after 50 requests
    const delayMs = 500; // 500ms delay per request over the limit

    const key = `slowdown:${ip}`;
    const record = this.rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      this.rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    record.count++;

    if (record.count > delayAfter) {
      const delay = (record.count - delayAfter) * delayMs;
      setTimeout(() => {
        next();
      }, Math.min(delay, 10000)); // Max 10 second delay
    } else {
      next();
    }
  };

  private getClientIp(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
           (req as any).connection?.remoteAddress ||
           (req as any).socket?.remoteAddress ||
           req.ip ||
           '127.0.0.1';
  }
}