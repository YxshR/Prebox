/**
 * Client-side security utilities for input validation, sanitization, and protection
 */

import DOMPurify from 'isomorphic-dompurify';

/**
 * Input validation patterns
 */
export const ValidationPatterns = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  phone: /^\+?[\d\s\-\(\)]{10,15}$/,
  name: /^[a-zA-Z\s\-']{1,50}$/,
  password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  alphanumeric: /^[a-zA-Z0-9]+$/,
  numeric: /^\d+$/,
  otp: /^\d{6}$/,
  url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
} as const;

/**
 * Input sanitization functions
 */
export class InputSanitizer {
  /**
   * Sanitize HTML content to prevent XSS
   */
  static sanitizeHtml(input: string): string {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
      ALLOWED_ATTR: [],
    });
  }

  /**
   * Sanitize plain text input
   */
  static sanitizeText(input: string): string {
    return input
      .trim()
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+=/gi, '') // Remove event handlers
      .substring(0, 1000); // Limit length
  }

  /**
   * Sanitize email input
   */
  static sanitizeEmail(input: string): string {
    return input
      .toLowerCase()
      .trim()
      .replace(/[^\w@.-]/g, '') // Only allow valid email characters
      .substring(0, 254); // RFC 5321 limit
  }

  /**
   * Sanitize phone number input
   */
  static sanitizePhone(input: string): string {
    return input
      .replace(/[^\d+\-\s\(\)]/g, '') // Only allow valid phone characters
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim()
      .substring(0, 20);
  }

  /**
   * Sanitize numeric input
   */
  static sanitizeNumeric(input: string): string {
    return input.replace(/[^\d]/g, '').substring(0, 10);
  }

  /**
   * Sanitize OTP input
   */
  static sanitizeOTP(input: string): string {
    return input.replace(/[^\d]/g, '').substring(0, 6);
  }

  /**
   * Sanitize URL input
   */
  static sanitizeUrl(input: string): string {
    try {
      const url = new URL(input);
      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(url.protocol)) {
        return '';
      }
      return url.toString();
    } catch {
      return '';
    }
  }
}

/**
 * Input validation functions
 */
export class InputValidator {
  /**
   * Validate email format
   */
  static validateEmail(email: string): { isValid: boolean; error?: string } {
    const sanitized = InputSanitizer.sanitizeEmail(email);
    
    if (!sanitized) {
      return { isValid: false, error: 'Email is required' };
    }
    
    if (!ValidationPatterns.email.test(sanitized)) {
      return { isValid: false, error: 'Please enter a valid email address' };
    }
    
    return { isValid: true };
  }

  /**
   * Validate phone number format
   */
  static validatePhone(phone: string): { isValid: boolean; error?: string } {
    const sanitized = InputSanitizer.sanitizePhone(phone);
    
    if (!sanitized) {
      return { isValid: false, error: 'Phone number is required' };
    }
    
    if (!ValidationPatterns.phone.test(sanitized)) {
      return { isValid: false, error: 'Please enter a valid phone number' };
    }
    
    return { isValid: true };
  }

  /**
   * Validate password strength
   */
  static validatePassword(password: string): { isValid: boolean; error?: string } {
    if (!password) {
      return { isValid: false, error: 'Password is required' };
    }
    
    if (password.length < 8) {
      return { isValid: false, error: 'Password must be at least 8 characters long' };
    }
    
    if (!ValidationPatterns.password.test(password)) {
      return { 
        isValid: false, 
        error: 'Password must contain uppercase, lowercase, number, and special character' 
      };
    }
    
    return { isValid: true };
  }

  /**
   * Validate OTP format
   */
  static validateOTP(otp: string): { isValid: boolean; error?: string } {
    const sanitized = InputSanitizer.sanitizeOTP(otp);
    
    if (!sanitized) {
      return { isValid: false, error: 'OTP is required' };
    }
    
    if (!ValidationPatterns.otp.test(sanitized)) {
      return { isValid: false, error: 'OTP must be 6 digits' };
    }
    
    return { isValid: true };
  }

  /**
   * Validate name format
   */
  static validateName(name: string): { isValid: boolean; error?: string } {
    const sanitized = InputSanitizer.sanitizeText(name);
    
    if (!sanitized) {
      return { isValid: false, error: 'Name is required' };
    }
    
    if (!ValidationPatterns.name.test(sanitized)) {
      return { isValid: false, error: 'Name can only contain letters, spaces, hyphens, and apostrophes' };
    }
    
    return { isValid: true };
  }

  /**
   * Validate URL format
   */
  static validateUrl(url: string): { isValid: boolean; error?: string } {
    const sanitized = InputSanitizer.sanitizeUrl(url);
    
    if (!sanitized) {
      return { isValid: false, error: 'Invalid URL format' };
    }
    
    return { isValid: true };
  }
}

/**
 * Rate limiting for client-side API calls
 */
export class ClientRateLimiter {
  private static requests: Map<string, number[]> = new Map();
  private static readonly DEFAULT_WINDOW_MS = 60000; // 1 minute
  private static readonly DEFAULT_MAX_REQUESTS = 10;

  /**
   * Check if request is allowed based on rate limiting
   */
  static isAllowed(
    key: string, 
    maxRequests: number = this.DEFAULT_MAX_REQUESTS,
    windowMs: number = this.DEFAULT_WINDOW_MS
  ): boolean {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Get existing requests for this key
    const requests = this.requests.get(key) || [];
    
    // Filter out requests outside the current window
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);
    
    // Check if we've exceeded the limit
    if (recentRequests.length >= maxRequests) {
      return false;
    }
    
    // Add current request
    recentRequests.push(now);
    this.requests.set(key, recentRequests);
    
    return true;
  }

  /**
   * Get remaining requests for a key
   */
  static getRemainingRequests(
    key: string,
    maxRequests: number = this.DEFAULT_MAX_REQUESTS,
    windowMs: number = this.DEFAULT_WINDOW_MS
  ): number {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    const requests = this.requests.get(key) || [];
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);
    
    return Math.max(0, maxRequests - recentRequests.length);
  }

  /**
   * Clear rate limit data for a key
   */
  static clearKey(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Clear all rate limit data
   */
  static clearAll(): void {
    this.requests.clear();
  }
}

/**
 * Security headers configuration
 */
export const SecurityHeaders = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline and unsafe-eval
    "style-src 'self' 'unsafe-inline'", // Tailwind requires unsafe-inline
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' http://localhost:8000 https://api.* ws: wss:",
    "media-src 'self' https:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests"
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
} as const;

/**
 * Secure form data processing
 */
export class SecureFormProcessor {
  /**
   * Process and validate form data
   */
  static processFormData<T extends Record<string, any>>(
    data: T,
    validationRules: Record<keyof T, (value: any) => { isValid: boolean; error?: string }>
  ): { isValid: boolean; sanitizedData?: T; errors?: Record<keyof T, string> } {
    const sanitizedData = {} as T;
    const errors = {} as Record<keyof T, string>;
    let isValid = true;

    for (const [key, value] of Object.entries(data)) {
      const validator = validationRules[key as keyof T];
      
      if (validator) {
        const result = validator(value);
        
        if (!result.isValid) {
          errors[key as keyof T] = result.error || 'Invalid input';
          isValid = false;
        } else {
          // Apply appropriate sanitization based on field type
          if (key.toLowerCase().includes('email')) {
            sanitizedData[key as keyof T] = InputSanitizer.sanitizeEmail(value) as T[keyof T];
          } else if (key.toLowerCase().includes('phone')) {
            sanitizedData[key as keyof T] = InputSanitizer.sanitizePhone(value) as T[keyof T];
          } else if (key.toLowerCase().includes('otp')) {
            sanitizedData[key as keyof T] = InputSanitizer.sanitizeOTP(value) as T[keyof T];
          } else if (key.toLowerCase().includes('url')) {
            sanitizedData[key as keyof T] = InputSanitizer.sanitizeUrl(value) as T[keyof T];
          } else {
            sanitizedData[key as keyof T] = InputSanitizer.sanitizeText(value) as T[keyof T];
          }
        }
      } else {
        // Default sanitization for fields without specific validators
        sanitizedData[key as keyof T] = InputSanitizer.sanitizeText(value) as T[keyof T];
      }
    }

    return isValid ? { isValid: true, sanitizedData } : { isValid: false, errors };
  }
}

/**
 * Security event logger
 */
export class SecurityLogger {
  private static logs: Array<{
    timestamp: number;
    type: string;
    message: string;
    data?: any;
  }> = [];

  /**
   * Log security event
   */
  static log(type: string, message: string, data?: any): void {
    this.logs.push({
      timestamp: Date.now(),
      type,
      message,
      data
    });

    // Keep only last 100 logs
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(-100);
    }

    // In production, you might want to send these to a security monitoring service
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[SECURITY] ${type}: ${message}`, data);
    }
  }

  /**
   * Get security logs
   */
  static getLogs(): typeof SecurityLogger.logs {
    return [...this.logs];
  }

  /**
   * Clear security logs
   */
  static clearLogs(): void {
    this.logs = [];
  }
}