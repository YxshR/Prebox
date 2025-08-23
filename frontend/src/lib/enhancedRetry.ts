/**
 * Enhanced retry mechanisms with intelligent error handling
 */

import { retryWithBackoff, CircuitBreaker } from './retry';
import { parseConstraintError, isConstraintError } from './constraintErrorHandler';

export interface EnhancedRetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryCondition?: (error: any, attempt: number) => boolean;
  onRetry?: (attempt: number, error: any) => void;
  onFailure?: (error: any) => void;
  circuitBreaker?: boolean;
}

/**
 * Enhanced retry function with constraint error handling
 */
export async function enhancedRetry<T>(
  fn: () => Promise<T>,
  options: EnhancedRetryOptions = {}
): Promise<T> {
  const config = {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
    circuitBreaker: true,
    ...options
  };

  const retryCondition = (error: any, attempt: number): boolean => {
    // Don't retry constraint violations - they need user action
    if (isConstraintError(error)) {
      return false;
    }

    // Custom retry condition
    if (config.retryCondition) {
      return config.retryCondition(error, attempt);
    }

    // Default retry logic
    return shouldRetryError(error);
  };

  const wrappedFn = config.circuitBreaker 
    ? () => apiCircuitBreaker.execute(fn)
    : fn;

  try {
    return await retryWithBackoff(wrappedFn, {
      maxAttempts: config.maxAttempts,
      baseDelay: config.baseDelay,
      maxDelay: config.maxDelay,
      backoffFactor: config.backoffFactor,
      retryCondition: (error: any) => retryCondition(error, 1),
      onRetry: config.onRetry
    });
  } catch (error: any) {
    if (config.onFailure) {
      config.onFailure(error);
    }
    throw error;
  }
}

/**
 * API call wrapper with enhanced error handling
 */
export async function enhancedApiCall<T>(
  apiCall: () => Promise<T>,
  options: EnhancedRetryOptions = {}
): Promise<T> {
  return enhancedRetry(apiCall, {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 8000,
    backoffFactor: 2,
    circuitBreaker: true,
    onRetry: (attempt, error) => {
      console.log(`API call retry attempt ${attempt}:`, {
        error: error.message,
        status: error.response?.status,
        code: error.code,
        isConstraintError: isConstraintError(error)
      });
    },
    onFailure: (error) => {
      if (isConstraintError(error)) {
        const constraintError = parseConstraintError(error);
        console.log('Constraint error detected:', constraintError);
      }
    },
    ...options
  });
}

/**
 * Form submission wrapper with validation error handling
 */
export async function enhancedFormSubmit<T>(
  submitFn: () => Promise<T>,
  options: {
    onValidationError?: (error: any) => void;
    onConstraintError?: (error: any) => void;
    onNetworkError?: (error: any) => void;
  } = {}
): Promise<T> {
  try {
    return await enhancedApiCall(submitFn, {
      maxAttempts: 2, // Fewer retries for form submissions
      retryCondition: (error: any) => {
        // Don't retry validation errors
        if (error.response?.status === 400) {
          if (options.onValidationError) {
            options.onValidationError(error);
          }
          return false;
        }

        // Don't retry constraint violations
        if (isConstraintError(error)) {
          if (options.onConstraintError) {
            options.onConstraintError(error);
          }
          return false;
        }

        // Retry network errors
        if (isNetworkError(error)) {
          if (options.onNetworkError) {
            options.onNetworkError(error);
          }
          return true;
        }

        return shouldRetryError(error);
      }
    });
  } catch (error: any) {
    // Final error handling
    if (error.response?.status === 400 && options.onValidationError) {
      options.onValidationError(error);
    } else if (isConstraintError(error) && options.onConstraintError) {
      options.onConstraintError(error);
    } else if (isNetworkError(error) && options.onNetworkError) {
      options.onNetworkError(error);
    }
    
    throw error;
  }
}

/**
 * Authentication-specific retry wrapper
 */
export async function enhancedAuthCall<T>(
  authCall: () => Promise<T>,
  options: {
    onAuthError?: (error: any) => void;
    onRateLimit?: (error: any) => void;
  } = {}
): Promise<T> {
  return enhancedApiCall(authCall, {
    maxAttempts: 2, // Fewer retries for auth calls
    retryCondition: (error: any) => {
      const status = error.response?.status;
      
      // Don't retry auth errors
      if (status === 401 || status === 403) {
        if (options.onAuthError) {
          options.onAuthError(error);
        }
        return false;
      }

      // Handle rate limiting with longer delay
      if (status === 429) {
        if (options.onRateLimit) {
          options.onRateLimit(error);
        }
        return true;
      }

      return shouldRetryError(error);
    },
    baseDelay: 2000, // Longer delay for auth calls
    maxDelay: 15000
  });
}

/**
 * Determine if error should be retried
 */
function shouldRetryError(error: any): boolean {
  const status = error.response?.status;
  const code = error.code;

  // Network errors - retry
  const networkErrorCodes = [
    'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 
    'EHOSTUNREACH', 'ENETUNREACH', 'ERR_NETWORK'
  ];
  
  if (networkErrorCodes.includes(code)) {
    return true;
  }

  // Server errors - retry
  if (status >= 500) {
    return true;
  }

  // Rate limiting - retry with delay
  if (status === 429) {
    return true;
  }

  // Timeout errors - retry
  if (status === 408 || code === 'ECONNABORTED') {
    return true;
  }

  // Client errors - don't retry
  if (status >= 400 && status < 500) {
    return false;
  }

  // Unknown errors - retry once
  return true;
}

/**
 * Check if error is network-related
 */
function isNetworkError(error: any): boolean {
  const networkErrorCodes = [
    'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 
    'EHOSTUNREACH', 'ENETUNREACH', 'ERR_NETWORK'
  ];
  
  return networkErrorCodes.includes(error.code) ||
         error.message?.toLowerCase().includes('network') ||
         error.name === 'NetworkError';
}

/**
 * Circuit breaker for API calls
 */
export const apiCircuitBreaker = new CircuitBreaker(
  5, // failure threshold
  60000, // recovery timeout (1 minute)
  'Enhanced API'
);

/**
 * Fetch wrapper with enhanced retry and error handling
 */
export async function enhancedFetch(
  url: string,
  options: RequestInit = {},
  retryOptions: EnhancedRetryOptions = {}
): Promise<Response> {
  return enhancedApiCall(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        (error as any).response = response;
        
        // Try to parse error body for constraint violations
        try {
          const errorBody = await response.clone().json();
          (error as any).data = errorBody;
        } catch {
          // Ignore JSON parsing errors
        }
        
        throw error;
      }

      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        const timeoutError = new Error('Request timeout');
        (timeoutError as any).code = 'ECONNABORTED';
        throw timeoutError;
      }

      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        const networkError = new Error('Network error');
        (networkError as any).code = 'ERR_NETWORK';
        throw networkError;
      }

      throw error;
    }
  }, retryOptions);
}

/**
 * Get retry status for UI display
 */
export function getRetryStatus() {
  return {
    circuitBreaker: {
      state: apiCircuitBreaker.getState(),
      failureCount: apiCircuitBreaker.getFailureCount(),
      timeUntilRecovery: apiCircuitBreaker.getTimeUntilRecovery(),
      isHealthy: apiCircuitBreaker.getState() === 'CLOSED'
    }
  };
}