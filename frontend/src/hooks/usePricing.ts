import { useState, useEffect, useCallback } from 'react';
import { PricingTier, PricingLoadingState } from '../types/pricing';
import { pricingApi } from '../lib/pricingApi';

export interface UsePricingOptions {
  autoLoad?: boolean;
  retryOnError?: boolean;
  maxRetries?: number;
  retryDelay?: number;
}

export interface UsePricingReturn {
  pricing: PricingLoadingState;
  refreshPricing: () => Promise<void>;
  validatePricing: (planId: string, amount: number, currency?: string) => Promise<boolean>;
  validatePurchase: (planId: string, amount: number, currency?: string) => Promise<{
    isValid: boolean;
    validatedAmount?: number;
    error?: string;
  }>;
  checkServiceHealth: () => Promise<{
    isHealthy: boolean;
    status: string;
    error?: string;
  }>;
  isLoading: boolean;
  error: string | null;
  plans: PricingTier[];
}

/**
 * Custom hook for managing pricing data with server-side validation
 * Requirement 4.4: Add loading states and error handling for pricing data
 */
export function usePricing(options: UsePricingOptions = {}): UsePricingReturn {
  const {
    autoLoad = true,
    retryOnError = true,
    maxRetries = 3,
    retryDelay = 1000
  } = options;

  const [pricing, setPricing] = useState<PricingLoadingState>({
    loading: autoLoad,
    data: undefined,
    error: undefined
  });

  const [retryCount, setRetryCount] = useState(0);

  /**
   * Load pricing data with error handling and retry logic
   */
  const loadPricing = useCallback(async (isRetry = false) => {
    try {
      if (!isRetry) {
        setPricing(prev => ({ ...prev, loading: true, error: undefined }));
      }

      const result = await pricingApi.getPricingWithLoadingState();
      
      if (result.error) {
        throw new Error(result.error);
      }

      setPricing({
        loading: false,
        data: result.data,
        error: undefined
      });

      setRetryCount(0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load pricing data';
      
      console.error('Pricing load error:', error);

      // Retry logic
      if (retryOnError && retryCount < maxRetries && !isRetry) {
        console.log(`Retrying pricing load (attempt ${retryCount + 1}/${maxRetries})`);
        setRetryCount(prev => prev + 1);
        
        setTimeout(() => {
          loadPricing(true);
        }, retryDelay * Math.pow(2, retryCount)); // Exponential backoff
      } else {
        setPricing({
          loading: false,
          data: undefined,
          error: errorMessage
        });
      }
    }
  }, [retryOnError, maxRetries, retryDelay, retryCount]);

  /**
   * Refresh pricing data manually
   */
  const refreshPricing = useCallback(async () => {
    setRetryCount(0);
    await loadPricing();
  }, [loadPricing]);

  /**
   * Validate pricing data against server
   * Requirement 4.2: Implement server-side validation for pricing displays
   */
  const validatePricing = useCallback(async (
    planId: string, 
    amount: number, 
    currency: string = 'INR'
  ): Promise<boolean> => {
    try {
      return await pricingApi.validatePricing(planId, amount, currency);
    } catch (error) {
      console.error('Pricing validation error:', error);
      return false;
    }
  }, []);

  /**
   * Validate purchase request with detailed response
   * Requirement 4.3: Ensure data integrity and accuracy
   */
  const validatePurchase = useCallback(async (
    planId: string, 
    amount: number, 
    currency: string = 'INR'
  ): Promise<{
    isValid: boolean;
    validatedAmount?: number;
    error?: string;
  }> => {
    try {
      const result = await pricingApi.validatePurchaseRequest(planId, amount, currency);
      return {
        isValid: result.isValid,
        validatedAmount: result.validatedAmount,
        error: result.error
      };
    } catch (error) {
      console.error('Purchase validation error:', error);
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Purchase validation failed'
      };
    }
  }, []);

  /**
   * Check pricing service health
   */
  const checkServiceHealth = useCallback(async (): Promise<{
    isHealthy: boolean;
    status: string;
    error?: string;
  }> => {
    try {
      const result = await pricingApi.checkPricingServiceHealth();
      return {
        isHealthy: result.isHealthy,
        status: result.status,
        error: result.error
      };
    } catch (error) {
      console.error('Service health check error:', error);
      return {
        isHealthy: false,
        status: 'error',
        error: error instanceof Error ? error.message : 'Health check failed'
      };
    }
  }, []);

  // Auto-load pricing data on mount
  useEffect(() => {
    if (autoLoad) {
      loadPricing();
    }
  }, [autoLoad, loadPricing]);

  return {
    pricing,
    refreshPricing,
    validatePricing,
    validatePurchase,
    checkServiceHealth,
    isLoading: pricing.loading,
    error: pricing.error || null,
    plans: pricing.data || []
  };
}

/**
 * Hook for validating a specific pricing plan
 * Requirement 4.1: Display server-validated pricing information
 */
export function usePricingPlan(planId: string) {
  const [plan, setPlan] = useState<PricingTier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const planData = await pricingApi.getValidatedPricingPlan(planId);
      setPlan(planData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load pricing plan';
      setError(errorMessage);
      setPlan(null);
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    if (planId) {
      loadPlan();
    }
  }, [planId, loadPlan]);

  return {
    plan,
    loading,
    error,
    refresh: loadPlan
  };
}

/**
 * Hook for managing pricing cache (admin only)
 * Requirement 4.2: Add caching mechanism for pricing data
 */
export function usePricingCache() {
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const refreshCache = useCallback(async (): Promise<{
    success: boolean;
    message?: string;
    error?: string;
  }> => {
    try {
      setRefreshing(true);
      
      const result = await pricingApi.refreshPricingCache();
      
      if (result.success) {
        setLastRefresh(new Date());
      }
      
      return result;
    } catch (error) {
      console.error('Cache refresh error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Cache refresh failed'
      };
    } finally {
      setRefreshing(false);
    }
  }, []);

  return {
    refreshCache,
    refreshing,
    lastRefresh
  };
}