'use client';

import { useState, useCallback } from 'react';
import { formatErrorForLogging } from '../lib/errorMessages';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: any | null;
}

interface UseApiStateReturn<T> {
  state: ApiState<T>;
  execute: (apiCall: () => Promise<T>) => Promise<T | null>;
  reset: () => void;
  retry: () => Promise<T | null>;
}

/**
 * Hook for managing API call states with loading, error handling, and retry functionality
 */
export function useApiState<T = any>(initialData: T | null = null): UseApiStateReturn<T> {
  const [state, setState] = useState<ApiState<T>>({
    data: initialData,
    loading: false,
    error: null
  });
  
  const [lastApiCall, setLastApiCall] = useState<(() => Promise<T>) | null>(null);

  const execute = useCallback(async (apiCall: () => Promise<T>): Promise<T | null> => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    setLastApiCall(() => apiCall);

    try {
      const result = await apiCall();
      setState({
        data: result,
        loading: false,
        error: null
      });
      return result;
    } catch (error: any) {
      const { userMessage, technicalDetails } = formatErrorForLogging(error);
      
      // Log technical details for debugging
      console.error('API call failed:', technicalDetails);
      
      setState({
        data: null,
        loading: false,
        error: error
      });
      
      return null;
    }
  }, []);

  const retry = useCallback(async (): Promise<T | null> => {
    if (lastApiCall) {
      return execute(lastApiCall);
    }
    return null;
  }, [lastApiCall, execute]);

  const reset = useCallback(() => {
    setState({
      data: initialData,
      loading: false,
      error: null
    });
    setLastApiCall(null);
  }, [initialData]);

  return {
    state,
    execute,
    reset,
    retry
  };
}

/**
 * Hook specifically for API calls that return lists/arrays
 */
export function useApiList<T = any>(initialData: T[] = []): UseApiStateReturn<T[]> {
  return useApiState<T[]>(initialData);
}

/**
 * Hook for API calls with automatic retry on mount
 */
export function useApiWithRetry<T = any>(
  apiCall: () => Promise<T>,
  dependencies: any[] = []
): UseApiStateReturn<T> {
  const apiState = useApiState<T>();

  React.useEffect(() => {
    apiState.execute(apiCall);
  }, dependencies);

  return apiState;
}

// Import React for useEffect in useApiWithRetry
import React from 'react';