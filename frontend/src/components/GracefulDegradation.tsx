'use client';

import React, { useState, useEffect } from 'react';
import { connectionMonitor } from '../lib/api-client';
import { getCircuitBreakerStatus } from '../lib/retry';
import ConnectionStatus from './ConnectionStatus';
import ErrorDisplay from './ErrorDisplay';

interface GracefulDegradationProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showConnectionStatus?: boolean;
  retryInterval?: number;
}

/**
 * Component that provides graceful degradation when backend is unavailable
 */
export const GracefulDegradation: React.FC<GracefulDegradationProps> = ({
  children,
  fallback,
  showConnectionStatus = true,
  retryInterval = 30000 // 30 seconds
}) => {
  const [isOnline, setIsOnline] = useState(true);
  const [circuitBreakerStatus, setCircuitBreakerStatus] = useState(getCircuitBreakerStatus());
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    // Subscribe to connection status changes
    const unsubscribe = connectionMonitor.onStatusChange((online) => {
      setIsOnline(online);
      setShowFallback(!online);
    });

    // Update circuit breaker status periodically
    const statusInterval = setInterval(() => {
      const status = getCircuitBreakerStatus();
      setCircuitBreakerStatus(status);
      setShowFallback(!isOnline || !status.isHealthy);
    }, 5000);

    // Periodic retry when in degraded state
    const retryInterval = setInterval(() => {
      if (showFallback) {
        // Attempt to check connection
        connectionMonitor.onStatusChange(() => {})(); // Trigger a connection check
      }
    }, retryInterval);

    return () => {
      unsubscribe();
      clearInterval(statusInterval);
      clearInterval(retryInterval);
    };
  }, [isOnline, showFallback, retryInterval]);

  const handleManualRetry = () => {
    // Force a connection check
    setShowFallback(false);
    setTimeout(() => {
      const status = getCircuitBreakerStatus();
      setShowFallback(!isOnline || !status.isHealthy);
    }, 1000);
  };

  if (showFallback) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {showConnectionStatus && (
          <div className="bg-white border-b px-4 py-2">
            <ConnectionStatus showDetails={true} />
          </div>
        )}
        
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            {fallback || (
              <div className="text-center">
                <ErrorDisplay
                  error={{ message: 'Service temporarily unavailable' }}
                  onRetry={handleManualRetry}
                  className="mb-6"
                />
                
                <div className="bg-white rounded-lg p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    Limited Functionality
                  </h2>
                  <p className="text-gray-600 mb-4">
                    Some features may not be available while we're experiencing connectivity issues. 
                    We're working to restore full functionality.
                  </p>
                  <ul className="text-sm text-gray-500 space-y-1">
                    <li>• Cached data may be displayed</li>
                    <li>• Some actions may be temporarily disabled</li>
                    <li>• Changes will sync when connection is restored</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {showConnectionStatus && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-1">
          <ConnectionStatus />
        </div>
      )}
      {children}
    </>
  );
};

export default GracefulDegradation;