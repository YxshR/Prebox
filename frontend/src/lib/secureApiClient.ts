/**
 * Secure API client with rate limiting, input validation, and security protections
 */

import { ApiClient, ApiResponse, createApiClient } from './api-client';
import { ClientRateLimiter, SecurityLogger, InputSanitizer } from './security';

/**
 * Rate limiting configuration for different endpoints
 */
const RATE_LIMITS = {
  // Authentication endpoints - more restrictive
  '/auth/login': { maxRequests: 5, windowMs: 300000 }, // 5 requests per 5 minutes
  '/auth/register': { maxRequests: 3, windowMs: 300000 }, // 3 requests per 5 minutes
  '/auth/send-otp': { maxRequests: 3, windowMs: 60000 }, // 3 requests per minute
  '/auth/verify-otp': { maxRequests: 5, windowMs: 300000 }, // 5 requests per 5 minutes
  '/auth/resend-otp': { maxRequests: 2, windowMs: 120000 }, // 2 requests per 2 minutes
  
  // General API endpoints
  default: { maxRequests: 30, windowMs: 60000 }, // 30 requests per minute
  
  // File upload endpoints
  '/upload': { maxRequests: 10, windowMs: 60000 }, // 10 uploads per minute
  
  // Search endpoints
  '/search': { maxRequests: 20, windowMs: 60000 }, // 20 searches per minute
} as const;

/**
 * Security configuration for API requests
 */
interface SecurityConfig {
  enableRateLimiting?: boolean;
  enableInputSanitization?: boolean;
  enableSecurityLogging?: boolean;
  customRateLimit?: {
    maxRequests: number;
    windowMs: number;
  };
}

/**
 * Secure API client wrapper
 */
export class SecureApiClient {
  private apiClient: ApiClient;
  private config: Required<SecurityConfig>;

  constructor(
    apiClient?: ApiClient,
    config: SecurityConfig = {}
  ) {
    this.apiClient = apiClient || createApiClient();
    this.config = {
      enableRateLimiting: true,
      enableInputSanitization: true,
      enableSecurityLogging: true,
      ...config
    };
  }

  /**
   * Get rate limit configuration for an endpoint
   */
  private getRateLimit(endpoint: string): { maxRequests: number; windowMs: number } {
    // Check for exact match first
    if (endpoint in RATE_LIMITS) {
      return RATE_LIMITS[endpoint as keyof typeof RATE_LIMITS];
    }
    
    // Check for pattern matches
    for (const [pattern, limit] of Object.entries(RATE_LIMITS)) {
      if (pattern !== 'default' && endpoint.includes(pattern)) {
        return limit;
      }
    }
    
    return RATE_LIMITS.default;
  }

  /**
   * Check rate limiting for an endpoint
   */
  private checkRateLimit(endpoint: string, customLimit?: { maxRequests: number; windowMs: number }): boolean {
    if (!this.config.enableRateLimiting) {
      return true;
    }

    const limit = customLimit || this.getRateLimit(endpoint);
    const rateLimitKey = `api_${endpoint}`;
    
    const isAllowed = ClientRateLimiter.isAllowed(
      rateLimitKey,
      limit.maxRequests,
      limit.windowMs
    );

    if (!isAllowed) {
      const remaining = ClientRateLimiter.getRemainingRequests(
        rateLimitKey,
        limit.maxRequests,
        limit.windowMs
      );

      if (this.config.enableSecurityLogging) {
        SecurityLogger.log('RATE_LIMIT_EXCEEDED', `Rate limit exceeded for ${endpoint}`, {
          endpoint,
          limit,
          remaining
        });
      }
    }

    return isAllowed;
  }

  /**
   * Sanitize request data
   */
  private sanitizeData(data: any): any {
    if (!this.config.enableInputSanitization || !data) {
      return data;
    }

    if (typeof data === 'string') {
      return InputSanitizer.sanitizeText(data);
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    if (typeof data === 'object') {
      const sanitized: any = {};
      
      for (const [key, value] of Object.entries(data)) {
        // Apply specific sanitization based on field names
        if (key.toLowerCase().includes('email')) {
          sanitized[key] = InputSanitizer.sanitizeEmail(value as string);
        } else if (key.toLowerCase().includes('phone')) {
          sanitized[key] = InputSanitizer.sanitizePhone(value as string);
        } else if (key.toLowerCase().includes('otp') || key.toLowerCase().includes('code')) {
          sanitized[key] = InputSanitizer.sanitizeOTP(value as string);
        } else if (key.toLowerCase().includes('url') || key.toLowerCase().includes('link')) {
          sanitized[key] = InputSanitizer.sanitizeUrl(value as string);
        } else if (typeof value === 'string') {
          sanitized[key] = InputSanitizer.sanitizeText(value);
        } else {
          sanitized[key] = this.sanitizeData(value);
        }
      }
      
      return sanitized;
    }

    return data;
  }

  /**
   * Log security event
   */
  private logSecurityEvent(type: string, endpoint: string, data?: any): void {
    if (this.config.enableSecurityLogging) {
      SecurityLogger.log(type, `API request to ${endpoint}`, {
        endpoint,
        timestamp: new Date().toISOString(),
        ...data
      });
    }
  }

  /**
   * Secure GET request
   */
  async get<T>(
    endpoint: string, 
    params?: Record<string, any>,
    securityConfig?: SecurityConfig
  ): Promise<ApiResponse<T>> {
    const config = { ...this.config, ...securityConfig };
    
    // Check rate limiting
    if (!this.checkRateLimit(endpoint, config.customRateLimit)) {
      this.logSecurityEvent('RATE_LIMITED', endpoint);
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
          details: { endpoint, rateLimited: true }
        }
      };
    }

    // Sanitize parameters
    const sanitizedParams = config.enableInputSanitization 
      ? this.sanitizeData(params) 
      : params;

    this.logSecurityEvent('API_REQUEST', endpoint, { method: 'GET', params: sanitizedParams });

    try {
      const response = await this.apiClient.get<T>(endpoint, sanitizedParams);
      
      if (!response.success) {
        this.logSecurityEvent('API_ERROR', endpoint, { 
          method: 'GET', 
          error: response.error 
        });
      }
      
      return response;
    } catch (error: any) {
      this.logSecurityEvent('API_EXCEPTION', endpoint, { 
        method: 'GET', 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Secure POST request
   */
  async post<T>(
    endpoint: string, 
    data?: any,
    securityConfig?: SecurityConfig
  ): Promise<ApiResponse<T>> {
    const config = { ...this.config, ...securityConfig };
    
    // Check rate limiting
    if (!this.checkRateLimit(endpoint, config.customRateLimit)) {
      this.logSecurityEvent('RATE_LIMITED', endpoint);
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
          details: { endpoint, rateLimited: true }
        }
      };
    }

    // Sanitize request data
    const sanitizedData = config.enableInputSanitization 
      ? this.sanitizeData(data) 
      : data;

    this.logSecurityEvent('API_REQUEST', endpoint, { method: 'POST', hasData: !!data });

    try {
      const response = await this.apiClient.post<T>(endpoint, sanitizedData);
      
      if (!response.success) {
        this.logSecurityEvent('API_ERROR', endpoint, { 
          method: 'POST', 
          error: response.error 
        });
      }
      
      return response;
    } catch (error: any) {
      this.logSecurityEvent('API_EXCEPTION', endpoint, { 
        method: 'POST', 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Secure PUT request
   */
  async put<T>(
    endpoint: string, 
    data?: any,
    securityConfig?: SecurityConfig
  ): Promise<ApiResponse<T>> {
    const config = { ...this.config, ...securityConfig };
    
    if (!this.checkRateLimit(endpoint, config.customRateLimit)) {
      this.logSecurityEvent('RATE_LIMITED', endpoint);
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
          details: { endpoint, rateLimited: true }
        }
      };
    }

    const sanitizedData = config.enableInputSanitization 
      ? this.sanitizeData(data) 
      : data;

    this.logSecurityEvent('API_REQUEST', endpoint, { method: 'PUT', hasData: !!data });

    try {
      const response = await this.apiClient.put<T>(endpoint, sanitizedData);
      
      if (!response.success) {
        this.logSecurityEvent('API_ERROR', endpoint, { 
          method: 'PUT', 
          error: response.error 
        });
      }
      
      return response;
    } catch (error: any) {
      this.logSecurityEvent('API_EXCEPTION', endpoint, { 
        method: 'PUT', 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Secure DELETE request
   */
  async delete<T>(
    endpoint: string,
    securityConfig?: SecurityConfig
  ): Promise<ApiResponse<T>> {
    const config = { ...this.config, ...securityConfig };
    
    if (!this.checkRateLimit(endpoint, config.customRateLimit)) {
      this.logSecurityEvent('RATE_LIMITED', endpoint);
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests. Please try again later.',
          details: { endpoint, rateLimited: true }
        }
      };
    }

    this.logSecurityEvent('API_REQUEST', endpoint, { method: 'DELETE' });

    try {
      const response = await this.apiClient.delete<T>(endpoint);
      
      if (!response.success) {
        this.logSecurityEvent('API_ERROR', endpoint, { 
          method: 'DELETE', 
          error: response.error 
        });
      }
      
      return response;
    } catch (error: any) {
      this.logSecurityEvent('API_EXCEPTION', endpoint, { 
        method: 'DELETE', 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string): void {
    this.apiClient.setAuthToken(token);
    this.logSecurityEvent('AUTH_TOKEN_SET', 'authentication');
  }

  /**
   * Clear authentication
   */
  clearAuth(): void {
    this.apiClient.clearAuth();
    this.logSecurityEvent('AUTH_CLEARED', 'authentication');
  }

  /**
   * Get rate limit status for an endpoint
   */
  getRateLimitStatus(endpoint: string): {
    remaining: number;
    limit: number;
    windowMs: number;
  } {
    const limit = this.getRateLimit(endpoint);
    const rateLimitKey = `api_${endpoint}`;
    const remaining = ClientRateLimiter.getRemainingRequests(
      rateLimitKey,
      limit.maxRequests,
      limit.windowMs
    );

    return {
      remaining,
      limit: limit.maxRequests,
      windowMs: limit.windowMs
    };
  }

  /**
   * Clear rate limit for an endpoint
   */
  clearRateLimit(endpoint: string): void {
    const rateLimitKey = `api_${endpoint}`;
    ClientRateLimiter.clearKey(rateLimitKey);
    this.logSecurityEvent('RATE_LIMIT_CLEARED', endpoint);
  }

  /**
   * Get security logs
   */
  getSecurityLogs(): Array<{
    timestamp: number;
    type: string;
    message: string;
    data?: any;
  }> {
    return SecurityLogger.getLogs();
  }
}

/**
 * Default secure API client instance
 */
export const secureApiClient = new SecureApiClient();

/**
 * Create a secure API client with custom configuration
 */
export const createSecureApiClient = (
  config?: SecurityConfig,
  apiClientConfig?: any
): SecureApiClient => {
  const apiClient = apiClientConfig ? createApiClient(apiClientConfig) : undefined;
  return new SecureApiClient(apiClient, config);
};

/**
 * Hook for using secure API client in React components
 */
export function useSecureApiClient(config?: SecurityConfig): SecureApiClient {
  return React.useMemo(() => {
    return new SecureApiClient(undefined, config);
  }, [config]);
}

// Import React for the hook
import React from 'react';