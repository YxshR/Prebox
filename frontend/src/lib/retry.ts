/**
 * Retry configuration options
 */
export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
  retryCondition?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any) => void;
}

/**
 * Error classification for better retry logic
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  SERVER = 'SERVER', 
  CLIENT = 'CLIENT',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  AUTH = 'AUTH',
  VALIDATION = 'VALIDATION'
}

/**
 * Classify error type for intelligent retry decisions
 */
function classifyError(error: any): ErrorType {
  // Network connectivity errors
  if (error.code === 'ERR_CONNECTION_REFUSED' || 
      error.code === 'ERR_NETWORK' ||
      error.name === 'NetworkError' ||
      error.message?.includes('fetch') ||
      error.message?.includes('Network error')) {
    return ErrorType.NETWORK;
  }
  
  // Timeout errors
  if (error.code === 'ECONNABORTED' || 
      error.name === 'AbortError' ||
      error.response?.status === 408) {
    return ErrorType.TIMEOUT;
  }
  
  // Rate limiting
  if (error.response?.status === 429) {
    return ErrorType.RATE_LIMIT;
  }
  
  // Authentication errors
  if (error.response?.status === 401 || error.response?.status === 403) {
    return ErrorType.AUTH;
  }
  
  // Server errors
  if (error.response?.status >= 500) {
    return ErrorType.SERVER;
  }
  
  // Client validation errors
  if (error.response?.status >= 400 && error.response?.status < 500) {
    return ErrorType.CLIENT;
  }
  
  return ErrorType.NETWORK; // Default to network error
}

/**
 * Determine if error should be retried based on type
 */
function shouldRetryError(error: any): boolean {
  const errorType = classifyError(error);
  
  switch (errorType) {
    case ErrorType.NETWORK:
    case ErrorType.SERVER:
    case ErrorType.TIMEOUT:
    case ErrorType.RATE_LIMIT:
      return true;
    
    case ErrorType.AUTH:
    case ErrorType.CLIENT:
    case ErrorType.VALIDATION:
      return false;
    
    default:
      return false;
  }
}

/**
 * Default retry configuration with improved error handling
 */
const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2,
  retryCondition: shouldRetryError,
  onRetry: () => {}
};

/**
 * Sleep utility function
 */
const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, options: Required<RetryOptions>): number {
  const exponentialDelay = options.baseDelay * Math.pow(options.backoffFactor, attempt - 1);
  
  // Add jitter to prevent thundering herd
  const jitter = Math.random() * 0.1 * exponentialDelay;
  const delay = exponentialDelay + jitter;
  
  return Math.min(delay, options.maxDelay);
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry if this is the last attempt
      if (attempt === config.maxAttempts) {
        break;
      }
      
      // Check if we should retry this error
      if (!config.retryCondition(error)) {
        break;
      }
      
      // Calculate delay and wait
      const delay = calculateDelay(attempt, config);
      
      // Call retry callback
      config.onRetry(attempt, error);
      
      console.warn(`Request failed (attempt ${attempt}/${config.maxAttempts}), retrying in ${delay}ms:`, {
        error: error.message,
        status: error.response?.status,
        code: error.code
      });
      
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * API-specific retry wrapper with intelligent error handling
 */
export async function retryApiCall<T>(
  apiCall: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  return retryWithBackoff(apiCall, {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 8000,
    backoffFactor: 2,
    retryCondition: (error: any) => {
      const errorType = classifyError(error);
      const shouldRetry = shouldRetryError(error);
      
      console.log(`Error classification: ${errorType}, Should retry: ${shouldRetry}`, {
        error: error.message,
        status: error.response?.status,
        code: error.code
      });
      
      return shouldRetry;
    },
    onRetry: (attempt, error) => {
      const errorType = classifyError(error);
      console.log(`API call retry attempt ${attempt} (${errorType}):`, {
        error: error.message,
        status: error.response?.status,
        code: error.code
      });
    },
    ...options
  });
}

/**
 * Fetch wrapper with retry logic
 */
export async function fetchWithRetry(
  url: string, 
  options: RequestInit = {},
  retryOptions: Partial<RetryOptions> = {}
): Promise<Response> {
  return retryApiCall(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // Reduced to 10 second timeout
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: options.signal || controller.signal // Use provided signal or create new one
      });
      
      clearTimeout(timeoutId);
      
      // Throw error for non-ok responses to trigger retry logic
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        (error as any).response = response;
        throw error;
      }
      
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      // Handle abort errors
      if (error.name === 'AbortError') {
        const timeoutError = new Error('Request timeout');
        (timeoutError as any).code = 'ECONNABORTED';
        throw timeoutError;
      }
      
      // Handle network errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        const networkError = new Error('Network error');
        (networkError as any).code = 'ERR_CONNECTION_REFUSED';
        throw networkError;
      }
      
      throw error;
    }
  }, retryOptions);
}

/**
 * Enhanced circuit breaker pattern for API calls with intelligent error handling
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private halfOpenAttempts = 0;
  private maxHalfOpenAttempts = 3;
  
  constructor(
    private failureThreshold = 10,
    private recoveryTimeout = 120000, // 2 minutes
    private name = 'API'
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        console.log(`${this.name} Circuit breaker transitioning to HALF_OPEN`);
        this.state = 'HALF_OPEN';
        this.halfOpenAttempts = 0;
      } else {
        const timeRemaining = Math.ceil((this.recoveryTimeout - (Date.now() - this.lastFailureTime)) / 1000);
        throw new Error(`${this.name} Circuit breaker is OPEN. Recovery in ${timeRemaining}s`);
      }
    }

    if (this.state === 'HALF_OPEN' && this.halfOpenAttempts >= this.maxHalfOpenAttempts) {
      throw new Error(`${this.name} Circuit breaker HALF_OPEN limit exceeded`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error: any) {
      // Only count certain types of errors as circuit breaker failures
      const errorType = classifyError(error);
      if (errorType === ErrorType.NETWORK || errorType === ErrorType.SERVER || errorType === ErrorType.TIMEOUT) {
        this.onFailure(error);
      } else {
        console.log(`${this.name} Circuit breaker ignoring ${errorType} error for failure count`);
      }
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      console.log(`${this.name} Circuit breaker recovery successful, transitioning to CLOSED`);
    }
    this.failures = 0;
    this.halfOpenAttempts = 0;
    this.state = 'CLOSED';
  }

  private onFailure(error: any): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'HALF_OPEN') {
      this.halfOpenAttempts++;
      console.log(`${this.name} Circuit breaker HALF_OPEN failure ${this.halfOpenAttempts}/${this.maxHalfOpenAttempts}`);
      this.state = 'OPEN';
    } else if (this.failures >= this.failureThreshold) {
      console.log(`${this.name} Circuit breaker opening after ${this.failures} failures`);
      this.state = 'OPEN';
    }
    
    console.log(`${this.name} Circuit breaker failure count: ${this.failures}/${this.failureThreshold}, State: ${this.state}`);
  }

  getState(): string {
    return this.state;
  }
  
  getFailureCount(): number {
    return this.failures;
  }
  
  getTimeUntilRecovery(): number {
    if (this.state !== 'OPEN') return 0;
    return Math.max(0, this.recoveryTimeout - (Date.now() - this.lastFailureTime));
  }
  
  reset(): void {
    this.failures = 0;
    this.halfOpenAttempts = 0;
    this.state = 'CLOSED';
    console.log(`${this.name} Circuit breaker manually reset`);
  }
}

/**
 * Global circuit breaker instance for API calls
 * Made less aggressive: increased failure threshold and recovery timeout
 */
export const apiCircuitBreaker = new CircuitBreaker(10, 120000, 'API'); // 10 failures, 2 minutes

/**
 * Get comprehensive circuit breaker status for monitoring
 */
export function getCircuitBreakerStatus() {
  return {
    state: apiCircuitBreaker.getState(),
    failureCount: apiCircuitBreaker.getFailureCount(),
    timeUntilRecovery: apiCircuitBreaker.getTimeUntilRecovery(),
    isHealthy: apiCircuitBreaker.getState() === 'CLOSED'
  };
}