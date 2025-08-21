/**
 * Error classification for user messages
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
 * User-friendly error messages for different connection failure scenarios
 */
export interface ErrorMessage {
  title: string;
  message: string;
  action?: string;
  severity: 'info' | 'warning' | 'error';
}

/**
 * Get user-friendly error message based on error type and details
 */
export function getUserFriendlyErrorMessage(error: any): ErrorMessage {
  const errorType = classifyErrorForMessage(error);
  
  switch (errorType) {
    case ErrorType.NETWORK:
      return {
        title: 'Connection Problem',
        message: 'Unable to connect to the server. Please check your internet connection.',
        action: 'Try again in a moment',
        severity: 'error'
      };
      
    case ErrorType.SERVER:
      return {
        title: 'Server Error',
        message: 'The server is experiencing issues. Our team has been notified.',
        action: 'Please try again in a few minutes',
        severity: 'error'
      };
      
    case ErrorType.TIMEOUT:
      return {
        title: 'Request Timeout',
        message: 'The request is taking longer than expected.',
        action: 'Please try again',
        severity: 'warning'
      };
      
    case ErrorType.RATE_LIMIT:
      return {
        title: 'Too Many Requests',
        message: 'You\'re making requests too quickly.',
        action: 'Please wait a moment before trying again',
        severity: 'warning'
      };
      
    case ErrorType.AUTH:
      return {
        title: 'Authentication Required',
        message: 'Please log in to continue.',
        action: 'Go to login page',
        severity: 'info'
      };
      
    case ErrorType.CLIENT:
      if (error.response?.status === 404) {
        return {
          title: 'Not Found',
          message: 'The requested resource could not be found.',
          action: 'Please check the URL or try again',
          severity: 'warning'
        };
      }
      return {
        title: 'Invalid Request',
        message: 'There was a problem with your request.',
        action: 'Please check your input and try again',
        severity: 'warning'
      };
      
    default:
      return {
        title: 'Something went wrong',
        message: 'An unexpected error occurred.',
        action: 'Please try again',
        severity: 'error'
      };
  }
}

/**
 * Get circuit breaker specific error message
 */
export function getCircuitBreakerErrorMessage(timeUntilRecovery: number): ErrorMessage {
  const minutes = Math.ceil(timeUntilRecovery / 60000);
  
  return {
    title: 'Service Temporarily Unavailable',
    message: `The service is temporarily unavailable due to connection issues. It will automatically retry in ${minutes} minute${minutes !== 1 ? 's' : ''}.`,
    action: 'Please wait or refresh the page later',
    severity: 'error'
  };
}

/**
 * Classify error for user message (similar to retry logic but focused on user communication)
 */
function classifyErrorForMessage(error: any): ErrorType {
  // Network connectivity errors
  if (error.code === 'ERR_CONNECTION_REFUSED' || 
      error.code === 'ERR_NETWORK' ||
      error.name === 'NetworkError' ||
      error.message?.includes('fetch') ||
      error.message?.includes('Network error') ||
      error.message?.includes('Circuit breaker is OPEN')) {
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
  
  // Client errors
  if (error.response?.status >= 400 && error.response?.status < 500) {
    return ErrorType.CLIENT;
  }
  
  return ErrorType.NETWORK; // Default to network error
}

/**
 * Format error for logging while keeping user message friendly
 */
export function formatErrorForLogging(error: any): {
  userMessage: ErrorMessage;
  technicalDetails: any;
} {
  return {
    userMessage: getUserFriendlyErrorMessage(error),
    technicalDetails: {
      message: error.message,
      status: error.response?.status,
      code: error.code,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }
  };
}