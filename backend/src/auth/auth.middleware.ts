import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { DemoAuthService } from '../demo/demo-auth.service';
import { ApiKeyService } from './api-key.service';
import { RateLimiterService, RateLimitConfig } from './rate-limiter.service';
import { UserSecurityManager } from './user-security-manager.service';
import { UserRole, SubscriptionTier } from '../shared/types';

export interface AuthenticatedRequest extends Request {
  user?: any;
  apiKeyId?: string;
  scopes?: string[];
  rateLimitInfo?: any;
}

export class AuthMiddleware {
  private authService: AuthService | DemoAuthService;
  private apiKeyService: ApiKeyService;
  private rateLimiterService: RateLimiterService;
  private userSecurityManager: UserSecurityManager;

  constructor() {
    const isDemoMode = process.env.DEMO_MODE === 'true';
    this.authService = isDemoMode ? new DemoAuthService() : new AuthService();
    this.apiKeyService = new ApiKeyService();
    this.rateLimiterService = new RateLimiterService();
    this.userSecurityManager = new UserSecurityManager();
  }

  // JWT Authentication middleware
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Access token required'
          }
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const user = await this.authService.validateToken(token);
      
      (req as any).user = user;
      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired token'
        }
      });
    }
  };

  // API Key Authentication middleware with rate limiting
  authenticateApiKey = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    
    try {
      const apiKey = req.headers['x-api-key'] as string;
      
      if (!apiKey) {
        res.status(401).json({
          success: false,
          error: {
            code: 'API_KEY_REQUIRED',
            message: 'API key required'
          }
        });
        return;
      }

      // Validate API key
      const { user, apiKeyId, scopes } = await this.apiKeyService.validateApiKey(apiKey);
      
      // Check rate limits
      const rateLimitResult = await this.rateLimiterService.checkApiKeyRateLimit(apiKeyId, user.tenantId);
      
      if (!rateLimitResult.allowed) {
        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime.getTime() / 1000).toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() || '3600'
        });

        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'API rate limit exceeded',
            details: {
              limit: rateLimitResult.limit,
              resetTime: rateLimitResult.resetTime,
              retryAfter: rateLimitResult.retryAfter
            }
          }
        });
        return;
      }

      // Set rate limit headers for successful requests
      res.set({
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime.getTime() / 1000).toString()
      });

      // Attach user info and API key details to request
      req.user = user;
      req.apiKeyId = apiKeyId;
      req.scopes = scopes;
      req.rateLimitInfo = rateLimitResult;

      // Record API usage (async, don't wait)
      this.recordApiUsage(req, apiKeyId, user.tenantId, startTime).catch(console.error);

      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: 'Invalid API key'
        }
      });
    }
  };

  // Combined authentication (JWT or API Key)
  authenticateAny = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      return this.authenticate(req, res, next);
    } else if (apiKey) {
      return this.authenticateApiKey(req, res, next);
    } else {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required (Bearer token or API key)'
        }
      });
    }
  };

  // Role-based authorization middleware
  authorize = (allowedRoles: UserRole[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const user = (req as any).user;
      
      if (!user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required'
          }
        });
        return;
      }

      if (!allowedRoles.includes(user.role)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions'
          }
        });
        return;
      }

      next();
    };
  };

  // Email verification requirement middleware
  requireEmailVerification = (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    
    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
      return;
    }

    if (!user.isEmailVerified) {
      res.status(403).json({
        success: false,
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Email verification required'
        }
      });
      return;
    }

    next();
  };

  // Optional authentication (doesn't fail if no auth provided)
  optionalAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const apiKey = req.headers['x-api-key'] as string;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        req.user = await this.authService.validateToken(token);
      } else if (apiKey) {
        const { user, apiKeyId, scopes } = await this.apiKeyService.validateApiKey(apiKey);
        req.user = user;
        req.apiKeyId = apiKeyId;
        req.scopes = scopes;
      }
      
      next();
    } catch (error) {
      // Continue without authentication
      next();
    }
  };

  // Scope-based authorization middleware for API keys
  requireScope = (requiredScope: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      const scopes = req.scopes || [];
      
      if (!scopes.includes(requiredScope)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_SCOPE',
            message: `Required scope: ${requiredScope}`,
            details: {
              requiredScope,
              availableScopes: scopes
            }
          }
        });
        return;
      }

      next();
    };
  };

  // IP-based rate limiting for unauthenticated requests
  rateLimitByIp = (config: RateLimitConfig) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const ipAddress = this.getClientIp(req);
        const rateLimitResult = await this.rateLimiterService.checkIpRateLimit(ipAddress, config);
        
        if (!rateLimitResult.allowed) {
          res.set({
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime.getTime() / 1000).toString(),
            'Retry-After': rateLimitResult.retryAfter?.toString() || '3600'
          });

          res.status(429).json({
            success: false,
            error: {
              code: 'RATE_LIMIT_EXCEEDED',
              message: 'Too many requests from this IP',
              details: {
                limit: rateLimitResult.limit,
                resetTime: rateLimitResult.resetTime,
                retryAfter: rateLimitResult.retryAfter
              }
            }
          });
          return;
        }

        res.set({
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime.getTime() / 1000).toString()
        });

        next();
      } catch (error) {
        console.error('Rate limiting error:', error);
        // Continue on error to avoid breaking the service
        next();
      }
    };
  };

  // Tenant-based rate limiting
  rateLimitByTenant = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        return next(); // Skip if no user (handled by auth middleware)
      }

      const rateLimitResult = await this.rateLimiterService.checkTenantRateLimit(
        user.tenantId, 
        user.subscriptionTier
      );
      
      if (!rateLimitResult.allowed) {
        res.set({
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime.getTime() / 1000).toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() || '3600'
        });

        res.status(429).json({
          success: false,
          error: {
            code: 'TENANT_RATE_LIMIT_EXCEEDED',
            message: 'Tenant rate limit exceeded',
            details: {
              limit: rateLimitResult.limit,
              resetTime: rateLimitResult.resetTime,
              retryAfter: rateLimitResult.retryAfter
            }
          }
        });
        return;
      }

      res.set({
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(rateLimitResult.resetTime.getTime() / 1000).toString()
      });

      next();
    } catch (error) {
      console.error('Tenant rate limiting error:', error);
      next();
    }
  };

  // Request validation middleware
  validateRequest = (schema: any) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const { error, value } = schema.validate(req.body);
      
      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: {
              field: error.details[0].path.join('.'),
              message: error.details[0].message,
              value: error.details[0].context?.value
            }
          }
        });
        return;
      }

      req.body = value; // Use validated/sanitized data
      next();
    };
  };

  // Helper method to record API usage
  private async recordApiUsage(
    req: AuthenticatedRequest, 
    apiKeyId: string, 
    tenantId: string, 
    startTime: number
  ): Promise<void> {
    const responseTime = Date.now() - startTime;
    const endpoint = `${req.method} ${req.route?.path || req.path}`;
    const ipAddress = this.getClientIp(req);
    const userAgent = req.get('User-Agent');
    
    // Get request/response sizes (approximate)
    const requestSize = JSON.stringify(req.body || {}).length + 
                       JSON.stringify(req.query || {}).length +
                       JSON.stringify(req.headers || {}).length;

    await this.rateLimiterService.recordApiUsage(
      apiKeyId,
      tenantId,
      endpoint,
      req.method,
      200, // Will be updated by response middleware
      responseTime,
      requestSize,
      undefined, // Response size will be calculated later
      ipAddress,
      userAgent
    );
  }

  // Role-based authorization middleware
  requireRole = (requiredRole: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      const user = req.user;
      
      if (!user || user.role !== requiredRole) {
        res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_ROLE',
            message: `Required role: ${requiredRole}`,
            details: {
              requiredRole,
              userRole: user?.role || 'none'
            }
          }
        });
        return;
      }

      next();
    };
  };

  // Tier-based authorization middleware
  requireTier = (requiredTier: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      const user = req.user;
      
      if (!user || user.subscriptionTier !== requiredTier) {
        res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_TIER',
            message: `Required subscription tier: ${requiredTier}`,
            details: {
              requiredTier,
              userTier: user?.subscriptionTier || 'none'
            }
          }
        });
        return;
      }

      next();
    };
  };

  // Helper method to get client IP
  private getClientIp(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           '127.0.0.1';
  }
}

// Create and export middleware instance
const authMiddlewareInstance = new AuthMiddleware();

// Export individual middleware functions
export const authMiddleware = authMiddlewareInstance.authenticate;
export const apiKeyAuth = authMiddlewareInstance.authenticateApiKey;
export const requireRole = authMiddlewareInstance.requireRole;
export const requireTier = authMiddlewareInstance.requireTier;
export const requireEmailVerification = authMiddlewareInstance.requireEmailVerification;
export const optionalAuth = authMiddlewareInstance.optionalAuth;
export const requireScope = authMiddlewareInstance.requireScope;
export const rateLimitByIp = authMiddlewareInstance.rateLimitByIp;
export const rateLimitByTenant = authMiddlewareInstance.rateLimitByTenant;