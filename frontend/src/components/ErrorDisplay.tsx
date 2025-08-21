'use client';

import React from 'react';
import { getUserFriendlyErrorMessage, getCircuitBreakerErrorMessage, ErrorMessage } from '../lib/errorMessages';
import { getCircuitBreakerStatus } from '../lib/retry';

interface ErrorDisplayProps {
  error: any;
  onRetry?: () => void;
  className?: string;
  showTechnicalDetails?: boolean;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ 
  error, 
  onRetry,
  className = '',
  showTechnicalDetails = false
}) => {
  const circuitBreakerStatus = getCircuitBreakerStatus();
  
  // Check if this is a circuit breaker error
  const isCircuitBreakerError = error?.message?.includes('Circuit breaker is OPEN') || 
                                !circuitBreakerStatus.isHealthy;
  
  const errorMessage: ErrorMessage = isCircuitBreakerError 
    ? getCircuitBreakerErrorMessage(circuitBreakerStatus.timeUntilRecovery)
    : getUserFriendlyErrorMessage(error);

  const getSeverityColor = () => {
    switch (errorMessage.severity) {
      case 'error':
        return 'border-red-200 bg-red-50 text-red-800';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50 text-yellow-800';
      case 'info':
        return 'border-blue-200 bg-blue-50 text-blue-800';
      default:
        return 'border-gray-200 bg-gray-50 text-gray-800';
    }
  };

  const getSeverityIcon = () => {
    switch (errorMessage.severity) {
      case 'error':
        return (
          <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`border rounded-lg p-4 ${getSeverityColor()} ${className}`}>
      <div className="flex items-start space-x-3">
        {getSeverityIcon()}
        <div className="flex-1">
          <h3 className="font-medium">{errorMessage.title}</h3>
          <p className="mt-1 text-sm">{errorMessage.message}</p>
          {errorMessage.action && (
            <p className="mt-2 text-sm font-medium">{errorMessage.action}</p>
          )}
          
          {onRetry && !isCircuitBreakerError && (
            <button
              onClick={onRetry}
              className="mt-3 px-3 py-1 text-sm bg-white border border-current rounded hover:bg-opacity-10 transition-colors"
            >
              Try Again
            </button>
          )}
          
          {isCircuitBreakerError && circuitBreakerStatus.timeUntilRecovery > 0 && (
            <div className="mt-2 text-xs opacity-75">
              Automatic retry in {Math.ceil(circuitBreakerStatus.timeUntilRecovery / 60000)} minute(s)
            </div>
          )}
          
          {showTechnicalDetails && (
            <details className="mt-3">
              <summary className="text-xs cursor-pointer hover:underline">
                Technical Details
              </summary>
              <pre className="mt-2 text-xs bg-black bg-opacity-10 p-2 rounded overflow-auto">
                {JSON.stringify({
                  message: error?.message,
                  status: error?.response?.status,
                  code: error?.code,
                  circuitBreaker: circuitBreakerStatus
                }, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};

export default ErrorDisplay;