import { useState, useEffect, useCallback } from 'react';
import { connectionMonitor, apiClient } from '../lib/api-client';

export interface ConnectionStatus {
  isOnline: boolean;
  isConnected: boolean;
  lastChecked: Date | null;
  retryCount: number;
  error: string | null;
}

/**
 * Hook for monitoring API connection status
 */
export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>({
    isOnline: navigator?.onLine ?? true,
    isConnected: true,
    lastChecked: null,
    retryCount: 0,
    error: null
  });

  const [isRetrying, setIsRetrying] = useState(false);

  /**
   * Check API connection
   */
  const checkConnection = useCallback(async () => {
    try {
      const response = await apiClient.healthCheck();
      
      setStatus(prev => ({
        ...prev,
        isConnected: response.success,
        lastChecked: new Date(),
        error: response.success ? null : response.error?.message || 'API connection failed',
        retryCount: response.success ? 0 : prev.retryCount
      }));

      return response.success;
    } catch (error: any) {
      setStatus(prev => ({
        ...prev,
        isConnected: false,
        lastChecked: new Date(),
        error: error.message || 'Network error',
        retryCount: prev.retryCount + 1
      }));

      return false;
    }
  }, []);

  /**
   * Retry connection with exponential backoff
   */
  const retryConnection = useCallback(async () => {
    if (isRetrying) return;

    setIsRetrying(true);
    
    try {
      const maxRetries = 5;
      let delay = 1000; // Start with 1 second

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`Connection retry attempt ${attempt}/${maxRetries}`);
        
        const isConnected = await checkConnection();
        
        if (isConnected) {
          console.log('Connection restored successfully');
          break;
        }

        if (attempt < maxRetries) {
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        }
      }
    } finally {
      setIsRetrying(false);
    }
  }, [checkConnection, isRetrying]);

  /**
   * Force refresh connection status
   */
  const refreshStatus = useCallback(() => {
    checkConnection();
  }, [checkConnection]);

  // Set up connection monitoring
  useEffect(() => {
    // Initial connection check
    checkConnection();

    // Listen to connection monitor events
    const unsubscribe = connectionMonitor.onStatusChange((online) => {
      setStatus(prev => ({
        ...prev,
        isConnected: online,
        lastChecked: new Date(),
        error: online ? null : 'API connection lost'
      }));
    });

    // Listen to browser online/offline events
    const handleOnline = () => {
      setStatus(prev => ({ ...prev, isOnline: true }));
      checkConnection();
    };

    const handleOffline = () => {
      setStatus(prev => ({ 
        ...prev, 
        isOnline: false,
        isConnected: false,
        error: 'No internet connection'
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [checkConnection]);

  return {
    status,
    isRetrying,
    checkConnection,
    retryConnection,
    refreshStatus
  };
}

/**
 * Hook for handling API errors with retry logic
 */
export function useApiErrorHandler() {
  const { status, retryConnection } = useConnectionStatus();

  const handleApiError = useCallback(async (error: any) => {
    // Check if it's a connection error
    const isConnectionError = 
      error.code === 'ERR_CONNECTION_REFUSED' ||
      error.code === 'NETWORK_ERROR' ||
      error.message?.includes('fetch') ||
      error.response?.status >= 500;

    if (isConnectionError && !status.isConnected) {
      console.log('Connection error detected, attempting to retry...');
      await retryConnection();
    }

    return isConnectionError;
  }, [status.isConnected, retryConnection]);

  return {
    handleApiError,
    isConnectionError: !status.isConnected,
    connectionStatus: status
  };
}

/**
 * Hook for automatic retry on failed requests
 */
export function useAutoRetry<T>(
  apiCall: () => Promise<T>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleApiError } = useApiErrorHandler();

  const executeWithRetry = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiCall();
      setData(result);
    } catch (err: any) {
      const wasConnectionError = await handleApiError(err);
      
      if (!wasConnectionError) {
        setError(err.message || 'An error occurred');
      } else {
        // Try again after connection recovery
        try {
          const result = await apiCall();
          setData(result);
        } catch (retryErr: any) {
          setError(retryErr.message || 'Connection failed');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [apiCall, handleApiError]);

  useEffect(() => {
    executeWithRetry();
  }, dependencies);

  return {
    data,
    loading,
    error,
    retry: executeWithRetry
  };
}