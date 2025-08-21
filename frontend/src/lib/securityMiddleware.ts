/**
 * Security middleware for API requests and component protection
 */

import { SecurityLogger, ClientRateLimiter } from './security';

/**
 * Security middleware configuration
 */
interface SecurityMiddlewareConfig {
  enableRateLimiting?: boolean;
  enableRequestLogging?: boolean;
  enableErrorTracking?: boolean;
  customRateLimits?: Record<string, { maxRequests: number; windowMs: number }>;
}

/**
 * Request context for security middleware
 */
interface RequestContext {
  endpoint: string;
  method: string;
  userId?: string;
  sessionId?: string;
  userAgent?: string;
  timestamp: number;
}

/**
 * Security middleware class
 */
export class SecurityMiddleware {
  private config: Required<SecurityMiddlewareConfig>;
  private static instance: SecurityMiddleware;

  constructor(config: SecurityMiddlewareConfig = {}) {
    this.config = {
      enableRateLimiting: true,
      enableRequestLogging: true,
      enableErrorTracking: true,
      customRateLimits: {},
      ...config
    };
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: SecurityMiddlewareConfig): SecurityMiddleware {
    if (!SecurityMiddleware.instance) {
      SecurityMiddleware.instance = new SecurityMiddleware(config);
    }
    return SecurityMiddleware.instance;
  }

  /**
   * Pre-request security checks
   */
  async beforeRequest(context: RequestContext): Promise<{
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  }> {
    const { endpoint, method, userId, timestamp } = context;

    // Rate limiting check
    if (this.config.enableRateLimiting) {
      const rateLimitKey = userId ? `user_${userId}_${endpoint}` : `anon_${endpoint}`;
      const customLimit = this.config.customRateLimits[endpoint];
      
      const isAllowed = customLimit
        ? ClientRateLimiter.isAllowed(rateLimitKey, customLimit.maxRequests, customLimit.windowMs)
        : ClientRateLimiter.isAllowed(rateLimitKey);

      if (!isAllowed) {
        const remaining = customLimit
          ? ClientRateLimiter.getRemainingRequests(rateLimitKey, customLimit.maxRequests, customLimit.windowMs)
          : ClientRateLimiter.getRemainingRequests(rateLimitKey);

        if (this.config.enableRequestLogging) {
          SecurityLogger.log('RATE_LIMIT_EXCEEDED', `Rate limit exceeded for ${endpoint}`, {
            endpoint,
            method,
            userId,
            remaining,
            timestamp
          });
        }

        return {
          allowed: false,
          reason: 'Rate limit exceeded',
          retryAfter: customLimit?.windowMs || 60000
        };
      }
    }

    // Log request if enabled
    if (this.config.enableRequestLogging) {
      SecurityLogger.log('REQUEST_INITIATED', `API request initiated: ${method} ${endpoint}`, {
        endpoint,
        method,
        userId,
        timestamp
      });
    }

    return { allowed: true };
  }

  /**
   * Post-request security processing
   */
  async afterRequest(
    context: RequestContext,
    response: {
      success: boolean;
      status?: number;
      error?: any;
    }
  ): Promise<void> {
    const { endpoint, method, userId, timestamp } = context;
    const duration = Date.now() - timestamp;

    if (this.config.enableRequestLogging) {
      SecurityLogger.log('REQUEST_COMPLETED', `API request completed: ${method} ${endpoint}`, {
        endpoint,
        method,
        userId,
        success: response.success,
        status: response.status,
        duration,
        timestamp
      });
    }

    // Track errors for security monitoring
    if (!response.success && this.config.enableErrorTracking) {
      SecurityLogger.log('REQUEST_ERROR', `API request failed: ${method} ${endpoint}`, {
        endpoint,
        method,
        userId,
        error: response.error,
        status: response.status,
        duration,
        timestamp
      });

      // Check for suspicious error patterns
      await this.detectSuspiciousActivity(context, response);
    }
  }

  /**
   * Detect suspicious activity patterns
   */
  private async detectSuspiciousActivity(
    context: RequestContext,
    response: { success: boolean; status?: number; error?: any }
  ): Promise<void> {
    const { endpoint, userId, timestamp } = context;
    const logs = SecurityLogger.getLogs();
    
    // Check for rapid failed requests from same user/IP
    const recentFailures = logs.filter(log => 
      log.type === 'REQUEST_ERROR' &&
      log.data?.userId === userId &&
      log.data?.endpoint === endpoint &&
      timestamp - log.timestamp < 60000 // Last minute
    );

    if (recentFailures.length >= 5) {
      SecurityLogger.log('SUSPICIOUS_ACTIVITY', `Suspicious activity detected: Multiple failed requests`, {
        endpoint,
        userId,
        failureCount: recentFailures.length,
        timeWindow: '1 minute',
        timestamp
      });

      // In a real application, you might want to:
      // 1. Temporarily block the user/IP
      // 2. Send alerts to security team
      // 3. Require additional authentication
    }

    // Check for authentication bypass attempts
    if (response.status === 401 || response.status === 403) {
      const authFailures = logs.filter(log =>
        log.type === 'REQUEST_ERROR' &&
        log.data?.userId === userId &&
        (log.data?.status === 401 || log.data?.status === 403) &&
        timestamp - log.timestamp < 300000 // Last 5 minutes
      );

      if (authFailures.length >= 3) {
        SecurityLogger.log('AUTH_BYPASS_ATTEMPT', `Potential authentication bypass attempt`, {
          userId,
          failureCount: authFailures.length,
          timeWindow: '5 minutes',
          timestamp
        });
      }
    }
  }

  /**
   * Validate request data for security issues
   */
  validateRequestData(data: any): {
    isValid: boolean;
    issues: string[];
    sanitizedData?: any;
  } {
    const issues: string[] = [];
    let sanitizedData = data;

    if (!data) {
      return { isValid: true, issues: [] };
    }

    try {
      // Check for potential XSS in string values
      if (typeof data === 'string') {
        if (this.containsPotentialXSS(data)) {
          issues.push('Potential XSS content detected');
        }
        sanitizedData = this.sanitizeString(data);
      } else if (typeof data === 'object') {
        sanitizedData = this.sanitizeObject(data, issues);
      }

      // Check for SQL injection patterns
      if (typeof data === 'string' && this.containsSQLInjection(data)) {
        issues.push('Potential SQL injection detected');
      }

      // Check for excessive data size
      const dataSize = JSON.stringify(data).length;
      if (dataSize > 1024 * 1024) { // 1MB limit
        issues.push('Request data too large');
      }

      return {
        isValid: issues.length === 0,
        issues,
        sanitizedData
      };
    } catch (error) {
      issues.push('Data validation error');
      return { isValid: false, issues };
    }
  }

  /**
   * Check for potential XSS content
   */
  private containsPotentialXSS(input: string): boolean {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe\b/gi,
      /<object\b/gi,
      /<embed\b/gi,
      /<link\b/gi,
      /<meta\b/gi
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Check for SQL injection patterns
   */
  private containsSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
      /('|(\\')|(;)|(--)|(\s+OR\s+))/gi,
      /(\bUNION\b.*\bSELECT\b)/gi
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Sanitize string input
   */
  private sanitizeString(input: string): string {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }

  /**
   * Sanitize object recursively
   */
  private sanitizeObject(obj: any, issues: string[]): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, issues));
    }

    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'string') {
          if (this.containsPotentialXSS(value)) {
            issues.push(`Potential XSS in field: ${key}`);
          }
          sanitized[key] = this.sanitizeString(value);
        } else {
          sanitized[key] = this.sanitizeObject(value, issues);
        }
      }
      
      return sanitized;
    }

    return obj;
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics(): {
    totalRequests: number;
    failedRequests: number;
    rateLimitedRequests: number;
    suspiciousActivities: number;
    lastActivity: number;
  } {
    const logs = SecurityLogger.getLogs();
    const now = Date.now();
    const last24Hours = now - (24 * 60 * 60 * 1000);

    const recentLogs = logs.filter(log => log.timestamp > last24Hours);

    return {
      totalRequests: recentLogs.filter(log => log.type === 'REQUEST_INITIATED').length,
      failedRequests: recentLogs.filter(log => log.type === 'REQUEST_ERROR').length,
      rateLimitedRequests: recentLogs.filter(log => log.type === 'RATE_LIMIT_EXCEEDED').length,
      suspiciousActivities: recentLogs.filter(log => 
        log.type === 'SUSPICIOUS_ACTIVITY' || log.type === 'AUTH_BYPASS_ATTEMPT'
      ).length,
      lastActivity: logs.length > 0 ? Math.max(...logs.map(log => log.timestamp)) : 0
    };
  }

  /**
   * Clear security logs and reset rate limits
   */
  reset(): void {
    SecurityLogger.clearLogs();
    ClientRateLimiter.clearAll();
  }
}

/**
 * Default security middleware instance
 */
export const securityMiddleware = SecurityMiddleware.getInstance();

/**
 * Security middleware wrapper for API calls
 */
export async function withSecurityMiddleware<T>(
  endpoint: string,
  method: string,
  apiCall: () => Promise<T>,
  userId?: string
): Promise<T> {
  const context: RequestContext = {
    endpoint,
    method,
    userId,
    sessionId: typeof window !== 'undefined' ? sessionStorage.getItem('sessionId') || undefined : undefined,
    userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
    timestamp: Date.now()
  };

  // Pre-request security checks
  const preCheck = await securityMiddleware.beforeRequest(context);
  
  if (!preCheck.allowed) {
    throw new Error(`Security check failed: ${preCheck.reason}`);
  }

  try {
    // Execute the API call
    const result = await apiCall();
    
    // Post-request processing
    await securityMiddleware.afterRequest(context, { success: true });
    
    return result;
  } catch (error: any) {
    // Post-request error processing
    await securityMiddleware.afterRequest(context, {
      success: false,
      error: error.message,
      status: error.response?.status
    });
    
    throw error;
  }
}