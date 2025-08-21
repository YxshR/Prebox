'use client';

import React, { useState, useEffect } from 'react';
import { connectionMonitor } from '../lib/api-client';
import { getCircuitBreakerStatus } from '../lib/retry';
import { getCircuitBreakerErrorMessage } from '../lib/errorMessages';

interface ConnectionStatusProps {
  showDetails?: boolean;
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ 
  showDetails = false, 
  className = '' 
}) => {
  const [isOnline, setIsOnline] = useState(true);
  const [circuitBreakerStatus, setCircuitBreakerStatus] = useState(getCircuitBreakerStatus());

  useEffect(() => {
    // Subscribe to connection status changes
    const unsubscribe = connectionMonitor.onStatusChange((online) => {
      setIsOnline(online);
    });

    // Update circuit breaker status periodically
    const interval = setInterval(() => {
      setCircuitBreakerStatus(getCircuitBreakerStatus());
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  const getStatusColor = () => {
    if (!isOnline || !circuitBreakerStatus.isHealthy) return 'text-red-500';
    return 'text-green-500';
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (!circuitBreakerStatus.isHealthy) {
      if (circuitBreakerStatus.state === 'OPEN') {
        const minutes = Math.ceil(circuitBreakerStatus.timeUntilRecovery / 60000);
        return `Service unavailable (${minutes}m)`;
      }
      return `Service issues (${circuitBreakerStatus.state})`;
    }
    return 'Connected';
  };

  const getStatusIcon = () => {
    if (!isOnline || !circuitBreakerStatus.isHealthy) {
      return (
        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
      );
    }
    return (
      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
    );
  };

  if (!showDetails && isOnline && circuitBreakerStatus.isHealthy) {
    return null; // Don't show anything when everything is working
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {getStatusIcon()}
      <span className={`text-sm ${getStatusColor()}`}>
        {getStatusText()}
      </span>
      {showDetails && (
        <div className="text-xs text-gray-500">
          (Failures: {circuitBreakerStatus.failureCount})
        </div>
      )}
    </div>
  );
};

export default ConnectionStatus;