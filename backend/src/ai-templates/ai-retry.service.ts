import { AIErrorHandler, AIError, AIErrorType } from './ai-error-handler';

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  exponentialBase: number;
  jitterFactor: number;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: AIError;
  attempts: number;
  totalTime: number;
}

export class AIRetryService {
  private static defaultConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    exponentialBase: 2,
    jitterFactor: 0.1
  };

  /**
   * Execute a function with retry logic
   */
  static async executeWithRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    context?: Record<string, any>
  ): Promise<RetryResult<T>> {
    const finalConfig = { ...this.defaultConfig, ...config };
    const startTime = Date.now();
    let lastError: AIError | null = null;

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        return {
          success: true,
          data: result,
          attempts: attempt,
          totalTime: Date.now() - startTime
        };

      } catch (error) {
        const aiError = AIErrorHandler.parseError(error);
        lastError = aiError;

        // Log the error
        AIErrorHandler.logError(aiError, {
          ...context,
          attempt,
          maxAttempts: finalConfig.maxAttempts
        });

        // Check if we should retry
        if (!AIErrorHandler.shouldRetry(aiError, attempt, finalConfig.maxAttempts)) {
          break;
        }

        // Don't wait after the last attempt
        if (attempt < finalConfig.maxAttempts) {
          const delay = this.calculateDelay(aiError, attempt, finalConfig);
          console.log(`Retrying in ${delay}ms (attempt ${attempt + 1}/${finalConfig.maxAttempts})`);
          await this.sleep(delay);
        }
      }
    }

    return {
      success: false,
      error: lastError || {
        type: AIErrorType.UNKNOWN,
        message: 'Unknown error occurred',
        userMessage: 'An unexpected error occurred',
        retryable: false
      },
      attempts: finalConfig.maxAttempts,
      totalTime: Date.now() - startTime
    };
  }

  /**
   * Calculate delay for next retry attempt
   */
  private static calculateDelay(error: AIError, attempt: number, config: RetryConfig): number {
    // Use error-specific retry delay if available
    if (error.retryAfter) {
      return Math.min(error.retryAfter * 1000, config.maxDelay);
    }

    // Calculate exponential backoff
    const exponentialDelay = config.baseDelay * Math.pow(config.exponentialBase, attempt - 1);
    
    // Add jitter to prevent thundering herd
    const jitter = exponentialDelay * config.jitterFactor * Math.random();
    
    // Apply maximum delay limit
    const totalDelay = Math.min(exponentialDelay + jitter, config.maxDelay);
    
    return Math.floor(totalDelay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Create a retry configuration for specific error types
   */
  static createConfigForErrorType(errorType: AIErrorType): Partial<RetryConfig> {
    switch (errorType) {
      case AIErrorType.CONNECTIVITY:
      case AIErrorType.TIMEOUT:
        return {
          maxAttempts: 3,
          baseDelay: 2000,
          maxDelay: 30000
        };

      case AIErrorType.RATE_LIMIT:
        return {
          maxAttempts: 2,
          baseDelay: 5000,
          maxDelay: 60000
        };

      case AIErrorType.SERVICE_UNAVAILABLE:
        return {
          maxAttempts: 2,
          baseDelay: 10000,
          maxDelay: 60000
        };

      case AIErrorType.API_KEY:
      case AIErrorType.INVALID_REQUEST:
        return {
          maxAttempts: 1 // Don't retry these
        };

      default:
        return this.defaultConfig;
    }
  }

  /**
   * Check if operation should be retried based on recent failures
   */
  static shouldAttemptOperation(recentFailures: AIError[], timeWindow: number = 300000): boolean {
    const now = Date.now();
    const recentErrors = recentFailures.filter(error => 
      error.details?.timestamp && (now - error.details.timestamp) < timeWindow
    );

    // Don't attempt if there are too many recent failures
    if (recentErrors.length >= 5) {
      return false;
    }

    // Don't attempt if recent errors are non-retryable
    const nonRetryableErrors = recentErrors.filter(error => !error.retryable);
    if (nonRetryableErrors.length > 0) {
      return false;
    }

    return true;
  }
}