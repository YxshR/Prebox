import { useState, useEffect, useCallback } from 'react';
import { aiConnectivityService, ConnectivityStatus } from '../services/aiConnectivityService';

export interface UseAIConnectivityReturn {
  status: ConnectivityStatus | null;
  isLoading: boolean;
  isAvailable: boolean;
  error: string | null;
  checkConnectivity: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAIConnectivity(): UseAIConnectivityReturn {
  const [status, setStatus] = useState<ConnectivityStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkConnectivity = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const newStatus = await aiConnectivityService.checkConnectivity();
      setStatus(newStatus);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to check connectivity';
      setError(errorMessage);
      console.error('Connectivity check failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const newStatus = await aiConnectivityService.getConnectivityStatus(false);
      setStatus(newStatus);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh status';
      setError(errorMessage);
      console.error('Status refresh failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load - try to get cached status first
    const cachedStatus = aiConnectivityService.getCachedStatus();
    if (cachedStatus) {
      setStatus(cachedStatus);
      setIsLoading(false);
    } else {
      // No cached status, perform initial check
      checkConnectivity();
    }

    // Subscribe to status changes
    const unsubscribe = aiConnectivityService.onStatusChange((newStatus) => {
      setStatus(newStatus);
      setError(null);
    });

    return () => {
      unsubscribe();
    };
  }, [checkConnectivity]);

  return {
    status,
    isLoading,
    isAvailable: status?.featuresAvailable === true,
    error,
    checkConnectivity,
    refresh
  };
}

export default useAIConnectivity;