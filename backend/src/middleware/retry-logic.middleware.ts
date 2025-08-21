import { Request, Response, NextFunction } from 'express';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableStatusCodes: number[];
  retryableErrors: string[];
}

export interface RetryContext {
  attempt: number;
  totalAttempts: number;
  delay: number;
  error?: any;
}

/**
 * Retry logic middleware with exponential backoff for failed requests
 */
export class RetryLogicMiddleware {
  private static defaultConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 2,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    retryableErrors: [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'ENOTFOUND',
      'EHOSTUNREACH',
      'ENETUNREACH'
    ]
  };

  /**
   * Create retry middleware with custom configuration
   */
  public static create(config: Partial<RetryConfig> = {}) {
    const finalConfig = { ...RetryLogicMiddleware.defaultConfig, ...config };
    
    return (req: Request, res: Response, next: NextFunction) => {
      // Add retry utilities to request object
      (req as any).retry = {
        config: finalConfig,
        attempt: 0,
        executeWithRetry: RetryLogicMiddleware.createRetryFunction(finalConfig)
      };
      
      next();
    };
  }

  /**
   * Create a retry function for async operations
   */
  public static createRetryFunction(config: RetryConfig) {
    return async <T>(
      operation: () => Promise<T>,
      context?: Partial<RetryContext>
    ): Promise<T> => {
      let lastError: any;
      const maxAttempts = config.maxRetries + 1;
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const result = await operation();
          
          // Log successful retry if it wasn't the first attempt
          if (attempt > 1) {
            console.log(`Operation succeeded on attempt ${attempt}/${maxAttempts}`);
          }
          
          return result;
        } catch (error: any) {
          lastError = error;
          
          // Don't retry on the last attempt
          if (attempt === maxAttempts) {
            break;
          }
          
          // Check if error is retryable
          if (!RetryLogicMiddleware.isRetryableError(error, config)) {
            console.log(`Non-retryable error encountered: ${error.message}`);
            break;
          }
          
          // Calculate delay with exponential backoff
          const delay = RetryLogicMiddleware.calculateDelay(attempt, config);
          
          console.log(
            `Operation failed on attempt ${attempt}/${maxAttempts}. ` +
            `Retrying in ${delay}ms. Error: ${error.message}`
          );
          
          // Wait before retrying
          await RetryLogicMiddleware.delay(delay);
        }
      }
      
      // All retries exhausted, throw the last error
      throw lastError;
    };
  }

  /**
   * Middleware to add retry headers to responses
   */
  public static addRetryHeaders = (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(body: any) {
      // Add retry information to error responses
      if (res.statusCode >= 400) {
        const config = (req as any).retry?.config || RetryLogicMiddleware.defaultConfig;
        
        if (RetryLogicMiddleware.isRetryableStatusCode(res.statusCode, config)) {
          const retryAfter = RetryLogicMiddleware.calculateDelay(1, config) / 1000;
          res.setHeader('Retry-After', retryAfter.toString());
          res.setHeader('X-Retryable', 'true');
          res.setHeader('X-Max-Retries', config.maxRetries.toString());
        }
      }
      
      return originalSend.call(this, body);
    };
    
    next();
  };

  /**
   * Circuit breaker pattern for preventing cascading failures
   */
  public static createCircuitBreaker(
    failureThreshold: number = 5,
    recoveryTimeout: number = 60000
  ) {
    let failureCount = 0;
    let lastFailureTime = 0;
    let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
    
    return async <T>(operation: () => Promise<T>): Promise<T> => {
      const now = Date.now();
      
      // Check if we should attempt recovery
      if (state === 'OPEN' && now - lastFailureTime > recoveryTimeout) {
        state = 'HALF_OPEN';
        console.log('Circuit breaker: Attempting recovery');
      }
      
      // Reject immediately if circuit is open
      if (state === 'OPEN') {
        throw new Error('Circuit breaker is OPEN - service temporarily unavailable');
      }
      
      try {
        const result = await operation();
        
        // Reset on success
        if (state === 'HALF_OPEN') {
          state = 'CLOSED';
          failureCount = 0;
          console.log('Circuit breaker: Recovery successful, circuit CLOSED');
        }
        
        return result;
      } catch (error) {
        failureCount++;
        lastFailureTime = now;
        
        // Open circuit if threshold exceeded
        if (failureCount >= failureThreshold) {
          state = 'OPEN';
          console.log(`Circuit breaker: Threshold exceeded (${failureCount}), circuit OPEN`);
        }
        
        throw error;
      }
    };
  }

  /**
   * Check if error is retryable based on configuration
   */
  private static isRetryableError(error: any, config: RetryConfig): boolean {
    // Check error codes
    if (error.code && config.retryableErrors.includes(error.code)) {
      return true;
    }
    
    // Check status codes
    if (error.statusCode && config.retryableStatusCodes.includes(error.statusCode)) {
      return true;
    }
    
    // Check if explicitly marked as retryable
    if (error.retryable === true) {
      return true;
    }
    
    // Check if explicitly marked as non-retryable
    if (error.retryable === false) {
      return false;
    }
    
    return false;
  }

  /**
   * Check if status code is retryable
   */
  private static isRetryableStatusCode(statusCode: number, config: RetryConfig): boolean {
    return config.retryableStatusCodes.includes(statusCode);
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private static calculateDelay(attempt: number, config: RetryConfig): number {
    // Exponential backoff: baseDelay * (backoffMultiplier ^ (attempt - 1))
    const exponentialDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    
    // Add jitter (random factor between 0.5 and 1.5)
    const jitter = 0.5 + Math.random();
    const delayWithJitter = exponentialDelay * jitter;
    
    // Cap at maximum delay
    return Math.min(delayWithJitter, config.maxDelay);
  }

  /**
   * Promise-based delay utility
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a retry wrapper for database operations
   */
  public static createDatabaseRetry(config: Partial<RetryConfig> = {}) {
    const dbConfig = {
      ...RetryLogicMiddleware.defaultConfig,
      maxRetries: 2,
      baseDelay: 500,
      retryableErrors: [
        'ECONNREFUSED',
        'ECONNRESET',
        'ETIMEDOUT',
        '08000', // PostgreSQL connection exception
        '08003', // PostgreSQL connection does not exist
        '08006'  // PostgreSQL connection failure
      ],
      ...config
    };
    
    return RetryLogicMiddleware.createRetryFunction(dbConfig);
  }

  /**
   * Create a retry wrapper for external API calls
   */
  public static createApiRetry(config: Partial<RetryConfig> = {}) {
    const apiConfig = {
      ...RetryLogicMiddleware.defaultConfig,
      maxRetries: 3,
      baseDelay: 1000,
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
      ...config
    };
    
    return RetryLogicMiddleware.createRetryFunction(apiConfig);
  }
}

// Export convenience functions
export const createRetryMiddleware = RetryLogicMiddleware.create;
export const addRetryHeaders = RetryLogicMiddleware.addRetryHeaders;
export const createCircuitBreaker = RetryLogicMiddleware.createCircuitBreaker;
export const createDatabaseRetry = RetryLogicMiddleware.createDatabaseRetry;
export const createApiRetry = RetryLogicMiddleware.createApiRetry;