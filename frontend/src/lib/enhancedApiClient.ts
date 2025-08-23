/**
 * Enhanced API client with comprehensive error handling and retry logic
 */

import { enhancedFetch } from './enhancedRetry';
import { parseConstraintError, isConstraintError } from './constraintErrorHandler';
import { getUserFriendlyErrorMessage } from './errorMessages';

export interface ApiClientOptions {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    field?: string;
    suggestions?: string[];
    retryable?: boolean;
  };
}

export interface RequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  skipRetry?: boolean;
}

/**
 * Enhanced API client with intelligent error handling
 */
export class EnhancedApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;
  private retries: number;
  private retryDelay: number;

  constructor(options: ApiClientOptions = {}) {
    this.baseURL = options.baseURL || process.env.NEXT_PUBLIC_API_URL || '';
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...options.headers
    };
  }

  /**
   * Make GET request
   */
  async get<T = any>(url: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  /**
   * Make POST request
   */
  async post<T = any>(url: string, data?: any, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  /**
   * Make PUT request
   */
  async put<T = any>(url: string, data?: any, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  /**
   * Make DELETE request
   */
  async delete<T = any>(url: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }

  /**
   * Make PATCH request
   */
  async patch<T = any>(url: string, data?: any, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>(url, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  /**
   * Core request method with enhanced error handling
   */
  private async request<T = any>(url: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const fullUrl = this.buildUrl(url);
    const requestOptions = this.buildRequestOptions(options);

    try {
      let response: Response;

      if (options.skipRetry) {
        // Make request without retry logic
        response = await fetch(fullUrl, requestOptions);
      } else {
        // Use enhanced fetch with retry logic
        response = await enhancedFetch(fullUrl, requestOptions, {
          maxAttempts: options.retries || this.retries,
          baseDelay: this.retryDelay,
          circuitBreaker: true
        });
      }

      return await this.handleResponse<T>(response);
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  /**
   * Handle successful and error responses
   */
  private async handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
    try {
      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          data: data.data || data
        };
      }

      // Handle error response
      return this.handleErrorResponse(data, response);
    } catch (parseError) {
      // Handle non-JSON responses
      if (response.ok) {
        return {
          success: true,
          data: undefined as T
        };
      }

      return {
        success: false,
        error: {
          code: 'PARSE_ERROR',
          message: `HTTP ${response.status}: ${response.statusText}`,
          retryable: response.status >= 500
        }
      };
    }
  }

  /**
   * Handle error responses from the API
   */
  private handleErrorResponse(data: any, response: Response): ApiResponse {
    const error = data.error || data;

    // Check if it's a constraint violation
    if (isConstraintError({ response, data })) {
      const constraintError = parseConstraintError({ response, data });
      return {
        success: false,
        error: {
          code: constraintError.type.toUpperCase(),
          message: constraintError.userMessage,
          field: constraintError.field,
          suggestions: constraintError.suggestions,
          retryable: constraintError.retryable
        }
      };
    }

    // Handle validation errors
    if (response.status === 400 && error.field) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message || 'Validation failed',
          field: error.field,
          suggestions: error.suggestions || ['Please check your input'],
          retryable: false
        }
      };
    }

    // Handle authentication errors
    if (response.status === 401) {
      return {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: error.message || 'Authentication required',
          suggestions: error.suggestions || ['Please log in again'],
          retryable: false
        }
      };
    }

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      return {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: error.message || 'Too many requests. Please try again later.',
          suggestions: error.suggestions || [`Wait ${retryAfter || '60'} seconds before trying again`],
          retryable: true
        }
      };
    }

    // Generic error handling
    return {
      success: false,
      error: {
        code: error.code || 'API_ERROR',
        message: error.message || 'An error occurred',
        field: error.field,
        suggestions: error.suggestions,
        retryable: error.retryable !== false && response.status >= 500
      }
    };
  }

  /**
   * Handle network and other errors
   */
  private handleError(error: any): ApiResponse {
    // Use existing error message utility
    const errorMessage = getUserFriendlyErrorMessage(error);

    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: errorMessage.message,
        suggestions: [errorMessage.action || 'Please try again'],
        retryable: true
      }
    };
  }

  /**
   * Build full URL
   */
  private buildUrl(url: string): string {
    if (url.startsWith('http')) {
      return url;
    }

    const baseUrl = this.baseURL.endsWith('/') ? this.baseURL.slice(0, -1) : this.baseURL;
    const path = url.startsWith('/') ? url : `/${url}`;
    
    return `${baseUrl}${path}`;
  }

  /**
   * Build request options with defaults
   */
  private buildRequestOptions(options: RequestOptions): RequestInit {
    const headers = {
      ...this.defaultHeaders,
      ...options.headers
    };

    // Add authentication token if available
    const token = this.getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return {
      ...options,
      headers,
      // Remove custom options that aren't part of RequestInit
      timeout: undefined,
      retries: undefined,
      skipRetry: undefined
    };
  }

  /**
   * Get authentication token from storage
   */
  private getAuthToken(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    } catch {
      return null;
    }
  }

  /**
   * Set authentication token
   */
  setAuthToken(token: string, persistent: boolean = true): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      if (persistent) {
        localStorage.setItem('auth_token', token);
      } else {
        sessionStorage.setItem('auth_token', token);
      }
    } catch (error) {
      console.warn('Failed to store auth token:', error);
    }
  }

  /**
   * Clear authentication token
   */
  clearAuthToken(): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_token');
    } catch (error) {
      console.warn('Failed to clear auth token:', error);
    }
  }

  /**
   * Update default headers
   */
  setDefaultHeader(key: string, value: string): void {
    this.defaultHeaders[key] = value;
  }

  /**
   * Remove default header
   */
  removeDefaultHeader(key: string): void {
    delete this.defaultHeaders[key];
  }
}

// Create default instance
export const apiClient = new EnhancedApiClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
});

// Authentication-specific API methods
export const authApi = {
  // Phone signup
  startPhoneSignup: (phone: string) => 
    apiClient.post('/api/auth/signup/phone/start', { phone }),
  
  verifyPhone: (phone: string, otp: string) => 
    apiClient.post('/api/auth/signup/phone/verify', { phone, otp }),

  // Email signup
  startEmailSignup: (email: string) => 
    apiClient.post('/api/auth/signup/email/start', { email }),
  
  verifyEmail: (email: string, code: string) => 
    apiClient.post('/api/auth/signup/email/verify', { email, code }),

  // Password creation
  completeSignup: (password: string) => 
    apiClient.post('/api/auth/signup/complete', { password }),

  // Login methods
  loginWithEmail: (email: string, password: string) => 
    apiClient.post('/api/auth/login/email', { email, password }),
  
  loginWithPhone: (phone: string, otp: string) => 
    apiClient.post('/api/auth/login/phone', { phone, otp }),

  // Auth0
  auth0Callback: (code: string, state: string) => 
    apiClient.post('/api/auth/auth0/callback', { code, state }),

  // Token management
  refreshToken: () => 
    apiClient.post('/api/auth/refresh'),
  
  logout: () => 
    apiClient.post('/api/auth/logout')
};

// Pricing API methods
export const pricingApi = {
  getPlans: () => 
    apiClient.get('/api/pricing/plans'),
  
  getPlan: (id: string) => 
    apiClient.get(`/api/pricing/plan/${id}`)
};

export default apiClient;