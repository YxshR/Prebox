import { useState, useCallback } from 'react';
import { useAIConnectivity } from './useAIConnectivity';
import { AIError } from '../components/ai/AIErrorDisplay';

export interface UseAIOperationOptions {
  maxRetries?: number;
  retryDelay?: number;
  checkConnectivity?: boolean;
}

export interface UseAIOperationReturn<T> {
  data: T | null;
  isLoading: boolean;
  error: AIError | Error | null;
  execute: (...args: any[]) => Promise<T | null>;
  retry: () => Promise<T | null>;
  reset: () => void;
}

export function useAIOperation<T>(
  operation: (...args: any[]) => Promise<T>,
  options: UseAIOperationOptions = {}
): UseAIOperationReturn<T> {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    checkConnectivity = true
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AIError | Error | null>(null);
  const [lastArgs, setLastArgs] = useState<any[]>([]);

  const { isAvailable, checkConnectivity: checkAIConnectivity } = useAIConnectivity();

  const parseError = useCallback((err: any): AIError => {
    // If it's already an AIError, return as is
    if (err.type && err.userMessage) {
      return err;
    }

    // Parse common error patterns
    if (err.response) {
      const status = err.response.status;
      const data = err.response.data;

      switch (status) {
        case 401:
          return {
            type: 'api_key',
            message: 'Authentication failed',
            userMessage: 'AI service authentication failed. Please contact support.',
            retryable: false
          };

        case 403:
          return {
            type: 'quota_exceeded',
            message: 'Quota exceeded',
            userMessage: 'AI service quota exceeded. Please try again later or upgrade your plan.',
            retryable: true,
            retryAfter: 3600
          };

        case 429:
          const retryAfter = err.response.headers['retry-after'] 
            ? parseInt(err.response.headers['retry-after']) 
            : 60;
          
          return {
            type: 'rate_limit',
            message: 'Rate limit exceeded',
            userMessage: `Too many requests. Please wait ${retryAfter} seconds before trying again.`,
            retryable: true,
            retryAfter
          };

        case 500:
        case 502:
        case 503:
        case 504:
          return {
            type: 'service_unavailable',
            message: `Service error (${status})`,
            userMessage: 'AI service is temporarily unavailable. Please try again in a few minutes.',
            retryable: true,
            retryAfter: 300
          };

        default:
          return {
            type: 'unknown',
            message: err.message || `HTTP ${status}`,
            userMessage: 'An unexpected error occurred. Please try again.',
            retryable: true
          };
      }
    }

    // Network errors
    if (err.code === 'NETWORK_ERROR' || err.message?.includes('Network Error')) {
      return {
        type: 'connectivity',
        message: 'Network error',
        userMessage: 'Unable to connect to AI service. Please check your internet connection.',
        retryable: true,
        retryAfter: 30
      };
    }

    // Timeout errors
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
      return {
        type: 'timeout',
        message: 'Request timeout',
        userMessage: 'AI service request timed out. Please try again.',
        retryable: true,
        retryAfter: 10
      };
    }

    // Generic error
    return {
      type: 'unknown',
      message: err.message || 'Unknown error',
      userMessage: err.message || 'An unexpected error occurred. Please try again.',
      retryable: true
    };
  }, []);

  const sleep = useCallback((ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  }, []);

  const executeWithRetry = useCallback(async (
    args: any[],
    attempt: number = 1
  ): Promise<T | null> => {
    try {
      // Check connectivity if enabled
      if (checkConnectivity && !isAvailable) {
        await checkAIConnectivity();
        if (!isAvailable) {
          throw new Error('AI services are currently unavailable');
        }
      }

      const result = await operation(...args);
      setData(result);
      setError(null);
      return result;

    } catch (err) {
      const aiError = parseError(err);
      
      // Determine if we should retry
      const shouldRetry = aiError.retryable && attempt < maxRetries;
      
      if (shouldRetry) {
        console.log(`AI operation failed (attempt ${attempt}/${maxRetries}), retrying...`, aiError);
        
        // Calculate delay (use error-specific delay or exponential backoff)
        const delay = aiError.retryAfter 
          ? aiError.retryAfter * 1000 
          : retryDelay * Math.pow(2, attempt - 1);
        
        await sleep(Math.min(delay, 30000)); // Max 30 seconds
        return executeWithRetry(args, attempt + 1);
      }

      // No more retries, set error
      setError(aiError);
      setData(null);
      return null;
    }
  }, [operation, checkConnectivity, isAvailable, checkAIConnectivity, maxRetries, retryDelay, parseError, sleep]);

  const execute = useCallback(async (...args: any[]): Promise<T | null> => {
    setIsLoading(true);
    setError(null);
    setLastArgs(args);

    try {
      return await executeWithRetry(args);
    } finally {
      setIsLoading(false);
    }
  }, [executeWithRetry]);

  const retry = useCallback(async (): Promise<T | null> => {
    if (lastArgs.length === 0) {
      throw new Error('No previous operation to retry');
    }
    return execute(...lastArgs);
  }, [execute, lastArgs]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
    setLastArgs([]);
  }, []);

  return {
    data,
    isLoading,
    error,
    execute,
    retry,
    reset
  };
}

export default useAIOperation;