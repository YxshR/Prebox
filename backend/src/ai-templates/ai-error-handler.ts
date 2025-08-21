export enum AIErrorType {
  CONNECTIVITY = 'connectivity',
  API_KEY = 'api_key',
  QUOTA_EXCEEDED = 'quota_exceeded',
  RATE_LIMIT = 'rate_limit',
  INVALID_REQUEST = 'invalid_request',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown'
}

export interface AIError {
  type: AIErrorType;
  message: string;
  userMessage: string;
  retryable: boolean;
  retryAfter?: number; // seconds
  details?: Record<string, any>;
}

export class AIErrorHandler {
  /**
   * Parse and categorize AI service errors
   */
  static parseError(error: any): AIError {
    // Network/connectivity errors
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return {
        type: AIErrorType.CONNECTIVITY,
        message: `Network error: ${error.message}`,
        userMessage: 'Unable to connect to AI service. Please check your internet connection.',
        retryable: true,
        retryAfter: 30
      };
    }

    // Timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return {
        type: AIErrorType.TIMEOUT,
        message: `Request timeout: ${error.message}`,
        userMessage: 'AI service request timed out. Please try again.',
        retryable: true,
        retryAfter: 10
      };
    }

    // HTTP response errors
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 401:
          return {
            type: AIErrorType.API_KEY,
            message: 'Invalid API key',
            userMessage: 'AI service authentication failed. Please contact support.',
            retryable: false,
            details: { status, data }
          };

        case 403:
          return {
            type: AIErrorType.QUOTA_EXCEEDED,
            message: 'API quota exceeded',
            userMessage: 'AI service quota exceeded. Please try again later or upgrade your plan.',
            retryable: true,
            retryAfter: 3600, // 1 hour
            details: { status, data }
          };

        case 429:
          const retryAfter = error.response.headers['retry-after'] 
            ? parseInt(error.response.headers['retry-after']) 
            : 60;
          
          return {
            type: AIErrorType.RATE_LIMIT,
            message: 'Rate limit exceeded',
            userMessage: `Too many requests. Please wait ${retryAfter} seconds before trying again.`,
            retryable: true,
            retryAfter,
            details: { status, data, retryAfter }
          };

        case 400:
          return {
            type: AIErrorType.INVALID_REQUEST,
            message: `Invalid request: ${data?.error?.message || 'Bad request'}`,
            userMessage: 'Invalid request format. Please check your input and try again.',
            retryable: false,
            details: { status, data }
          };

        case 500:
        case 502:
        case 503:
        case 504:
          return {
            type: AIErrorType.SERVICE_UNAVAILABLE,
            message: `AI service error (${status}): ${data?.error?.message || 'Service unavailable'}`,
            userMessage: 'AI service is temporarily unavailable. Please try again in a few minutes.',
            retryable: true,
            retryAfter: 300, // 5 minutes
            details: { status, data }
          };

        default:
          return {
            type: AIErrorType.UNKNOWN,
            message: `HTTP ${status}: ${data?.error?.message || error.message}`,
            userMessage: 'An unexpected error occurred. Please try again.',
            retryable: true,
            retryAfter: 60,
            details: { status, data }
          };
      }
    }

    // OpenAI/OpenRouter specific errors
    if (error.type) {
      switch (error.type) {
        case 'insufficient_quota':
          return {
            type: AIErrorType.QUOTA_EXCEEDED,
            message: 'Insufficient quota',
            userMessage: 'AI service quota exceeded. Please try again later or upgrade your plan.',
            retryable: true,
            retryAfter: 3600
          };

        case 'invalid_request_error':
          return {
            type: AIErrorType.INVALID_REQUEST,
            message: error.message || 'Invalid request',
            userMessage: 'Invalid request format. Please check your input and try again.',
            retryable: false
          };

        case 'rate_limit_exceeded':
          return {
            type: AIErrorType.RATE_LIMIT,
            message: 'Rate limit exceeded',
            userMessage: 'Too many requests. Please wait a moment before trying again.',
            retryable: true,
            retryAfter: 60
          };
      }
    }

    // Generic error fallback
    return {
      type: AIErrorType.UNKNOWN,
      message: error.message || 'Unknown error',
      userMessage: 'An unexpected error occurred. Please try again.',
      retryable: true,
      retryAfter: 60,
      details: { originalError: error }
    };
  }

  /**
   * Determine if an error should trigger a retry
   */
  static shouldRetry(error: AIError, attemptCount: number, maxAttempts: number = 3): boolean {
    if (attemptCount >= maxAttempts) {
      return false;
    }

    return error.retryable;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  static getRetryDelay(error: AIError, attemptCount: number): number {
    const baseDelay = error.retryAfter || 60;
    const exponentialDelay = Math.min(baseDelay * Math.pow(2, attemptCount - 1), 300); // Max 5 minutes
    const jitter = Math.random() * 0.1 * exponentialDelay; // Add 10% jitter
    
    return Math.floor(exponentialDelay + jitter) * 1000; // Convert to milliseconds
  }

  /**
   * Get user-friendly error message with action suggestions
   */
  static getUserMessage(error: AIError): string {
    let message = error.userMessage;

    if (error.retryable) {
      if (error.retryAfter && error.retryAfter > 60) {
        const minutes = Math.ceil(error.retryAfter / 60);
        message += ` Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`;
      } else {
        message += ' Please try again in a moment.';
      }
    } else {
      message += ' If this problem persists, please contact support.';
    }

    return message;
  }

  /**
   * Log error with appropriate level
   */
  static logError(error: AIError, context?: Record<string, any>): void {
    const logData = {
      type: error.type,
      message: error.message,
      retryable: error.retryable,
      retryAfter: error.retryAfter,
      details: error.details,
      context
    };

    switch (error.type) {
      case AIErrorType.API_KEY:
      case AIErrorType.QUOTA_EXCEEDED:
        console.error('AI Service Error:', logData);
        break;
      
      case AIErrorType.CONNECTIVITY:
      case AIErrorType.TIMEOUT:
        console.warn('AI Service Warning:', logData);
        break;
      
      default:
        console.error('AI Service Error:', logData);
    }
  }
}