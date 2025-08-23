'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePricing } from '../../hooks/usePricing';
import { useAuth } from '../../hooks/useAuth';
import PricingDisplay from './PricingDisplay';
import PricingFallback from './PricingFallback';

interface PricingContainerProps {
  onPlanSelect?: (planId: string, amount: number) => void;
  showComparison?: boolean;
  billingCycle?: 'monthly' | 'yearly';
  className?: string;
  autoRetry?: boolean;
  maxRetries?: number;
}

/**
 * Comprehensive Pricing Container Component
 * Requirement 4.1: Create PricingDisplay component with database integration
 * Requirement 4.2: Implement PricingFallback component for error scenarios
 * Requirement 4.3: Add loading states and error handling for pricing data
 * Requirement 4.4: Integrate pricing components with authentication state
 */
export default function PricingContainer({
  onPlanSelect,
  showComparison = false,
  billingCycle = 'monthly',
  className = '',
  autoRetry = true,
  maxRetries = 3
}: PricingContainerProps) {
  const { 
    plans, 
    isLoading, 
    error, 
    refreshPricing,
    checkServiceHealth 
  } = usePricing();

  const { isAuthenticated, user } = useAuth();

  const [retryCount, setRetryCount] = useState(0);
  const [showFallback, setShowFallback] = useState(false);
  const [serviceHealth, setServiceHealth] = useState<{
    isHealthy: boolean;
    status: string;
    error?: string;
  } | null>(null);

  // Check service health on mount and when error occurs
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const health = await checkServiceHealth();
        setServiceHealth(health);
        
        // If service is unhealthy and we have an error, show fallback
        if (!health.isHealthy && error) {
          setShowFallback(true);
        }
      } catch (err) {
        console.error('Health check failed:', err);
        setServiceHealth({
          isHealthy: false,
          status: 'error',
          error: 'Health check failed'
        });
      }
    };

    if (error) {
      checkHealth();
    }
  }, [error, checkServiceHealth]);

  // Auto-retry logic
  useEffect(() => {
    if (error && autoRetry && retryCount < maxRetries) {
      const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
      
      const timer = setTimeout(async () => {
        console.log(`Auto-retrying pricing load (attempt ${retryCount + 1}/${maxRetries})`);
        setRetryCount(prev => prev + 1);
        await refreshPricing();
      }, retryDelay);

      return () => clearTimeout(timer);
    }
  }, [error, autoRetry, retryCount, maxRetries, refreshPricing]);

  // Reset retry count on successful load
  useEffect(() => {
    if (!error && !isLoading) {
      setRetryCount(0);
      setShowFallback(false);
    }
  }, [error, isLoading]);

  const handleRetry = async () => {
    setRetryCount(0);
    setShowFallback(false);
    await refreshPricing();
  };

  const handlePlanSelect = (planId: string, amount: number) => {
    // Add authentication context to plan selection
    console.log('Plan selected:', {
      planId,
      amount,
      isAuthenticated,
      userId: user?.id,
      userEmail: user?.email
    });

    onPlanSelect?.(planId, amount);
  };

  // Show fallback if explicitly set or if we've exceeded retry attempts
  if (showFallback || (error && retryCount >= maxRetries)) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="fallback"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
        >
          <PricingFallback
            onRetry={handleRetry}
            className={className}
            showContactSupport={true}
          />
        </motion.div>
      </AnimatePresence>
    );
  }

  // Show main pricing display
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="display"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className={className}
      >
        {/* Service Health Indicator (for debugging) */}
        {process.env.NODE_ENV === 'development' && serviceHealth && (
          <div className="mb-4 text-center">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs ${
              serviceHealth.isHealthy 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${
                serviceHealth.isHealthy ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              Service: {serviceHealth.status}
              {retryCount > 0 && ` (Retry ${retryCount}/${maxRetries})`}
            </div>
          </div>
        )}

        <PricingDisplay
          onPlanSelect={handlePlanSelect}
          showComparison={showComparison}
          billingCycle={billingCycle}
          showFallbackOnError={false} // We handle fallback at container level
        />

        {/* Retry Information */}
        {error && retryCount > 0 && retryCount < maxRetries && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
              <svg className="animate-spin w-4 h-4 text-yellow-600 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm text-yellow-800">
                Retrying... ({retryCount}/{maxRetries})
              </span>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}