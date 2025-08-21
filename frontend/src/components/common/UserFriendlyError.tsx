'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ErrorDetails {
  code?: string;
  message?: string;
  status?: number;
  timestamp?: Date;
  errorId?: string;
  stack?: string;
}

interface UserFriendlyErrorProps {
  error: ErrorDetails | Error | string;
  title?: string;
  showRetry?: boolean;
  showDetails?: boolean;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  variant?: 'inline' | 'modal' | 'banner' | 'toast';
}

/**
 * Maps technical errors to user-friendly messages without exposing security details
 */
const ERROR_MESSAGES: Record<string, { title: string; message: string; action?: string }> = {
  // Network errors
  'ERR_CONNECTION_REFUSED': {
    title: 'Connection Problem',
    message: 'We\'re having trouble connecting to our servers. Please check your internet connection and try again.',
    action: 'Check your connection'
  },
  'ERR_NETWORK': {
    title: 'Network Error',
    message: 'There seems to be a network issue. Please try again in a moment.',
    action: 'Try again'
  },
  'NETWORK_ERROR': {
    title: 'Connection Issue',
    message: 'Unable to connect to our services. Please check your internet connection.',
    action: 'Check connection'
  },
  
  // HTTP status errors
  '400': {
    title: 'Invalid Request',
    message: 'There was an issue with your request. Please check your input and try again.',
    action: 'Check your input'
  },
  '401': {
    title: 'Authentication Required',
    message: 'Please sign in to access this feature.',
    action: 'Sign in'
  },
  '403': {
    title: 'Access Denied',
    message: 'You don\'t have permission to access this feature.',
    action: 'Contact support'
  },
  '404': {
    title: 'Not Found',
    message: 'The requested resource could not be found.',
    action: 'Go back'
  },
  '429': {
    title: 'Too Many Requests',
    message: 'You\'re making requests too quickly. Please wait a moment and try again.',
    action: 'Wait and retry'
  },
  '500': {
    title: 'Server Error',
    message: 'We\'re experiencing technical difficulties. Our team has been notified.',
    action: 'Try again later'
  },
  '502': {
    title: 'Service Unavailable',
    message: 'Our service is temporarily unavailable. Please try again in a few minutes.',
    action: 'Try again later'
  },
  '503': {
    title: 'Service Unavailable',
    message: 'We\'re performing maintenance. Please try again shortly.',
    action: 'Try again later'
  },
  
  // Application errors
  'VALIDATION_ERROR': {
    title: 'Validation Error',
    message: 'Please check your input and make sure all required fields are filled correctly.',
    action: 'Check your input'
  },
  'TIMEOUT_ERROR': {
    title: 'Request Timeout',
    message: 'The request took too long to complete. Please try again.',
    action: 'Try again'
  },
  'RATE_LIMIT_ERROR': {
    title: 'Rate Limit Exceeded',
    message: 'You\'re making too many requests. Please wait a moment before trying again.',
    action: 'Wait and retry'
  },
  
  // Default fallback
  'UNKNOWN_ERROR': {
    title: 'Something Went Wrong',
    message: 'We encountered an unexpected error. Please try again or contact support if the problem persists.',
    action: 'Try again'
  }
};

/**
 * Extracts error information and maps to user-friendly message
 */
function processError(error: ErrorDetails | Error | string): {
  userMessage: { title: string; message: string; action?: string };
  technicalDetails: ErrorDetails;
} {
  let technicalDetails: ErrorDetails = {};
  
  if (typeof error === 'string') {
    technicalDetails = { message: error };
  } else if (error instanceof Error) {
    technicalDetails = {
      message: error.message,
      stack: error.stack,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
  } else {
    technicalDetails = { ...error };
  }

  // Add timestamp if not present
  if (!technicalDetails.timestamp) {
    technicalDetails.timestamp = new Date();
  }

  // Determine error type for user-friendly message
  let errorKey = 'UNKNOWN_ERROR';
  
  if (technicalDetails.code) {
    errorKey = technicalDetails.code;
  } else if (technicalDetails.status) {
    errorKey = technicalDetails.status.toString();
  } else if (technicalDetails.message) {
    // Check for common error patterns in message
    const message = technicalDetails.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch')) {
      errorKey = 'NETWORK_ERROR';
    } else if (message.includes('timeout')) {
      errorKey = 'TIMEOUT_ERROR';
    } else if (message.includes('validation')) {
      errorKey = 'VALIDATION_ERROR';
    } else if (message.includes('rate limit')) {
      errorKey = 'RATE_LIMIT_ERROR';
    }
  }

  const userMessage = ERROR_MESSAGES[errorKey] || ERROR_MESSAGES['UNKNOWN_ERROR'];

  return { userMessage, technicalDetails };
}

/**
 * User-friendly error display component
 */
export function UserFriendlyError({
  error,
  title,
  showRetry = true,
  showDetails = false,
  onRetry,
  onDismiss,
  className = '',
  variant = 'inline'
}: UserFriendlyErrorProps) {
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const { userMessage, technicalDetails } = processError(error);

  const displayTitle = title || userMessage.title;
  const displayMessage = userMessage.message;

  const getVariantStyles = () => {
    switch (variant) {
      case 'modal':
        return 'fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4';
      case 'banner':
        return 'w-full bg-red-50 border-l-4 border-red-400 p-4';
      case 'toast':
        return 'fixed top-4 right-4 z-50 max-w-sm bg-white shadow-lg rounded-lg border border-red-200';
      default:
        return 'bg-red-50 border border-red-200 rounded-lg p-4';
    }
  };

  const getContentStyles = () => {
    switch (variant) {
      case 'modal':
        return 'bg-white rounded-lg shadow-xl max-w-md w-full p-6';
      case 'toast':
        return 'p-4';
      default:
        return '';
    }
  };

  const ErrorContent = () => (
    <div className={getContentStyles()}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="w-6 h-6 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            {displayTitle}
          </h3>
          
          <div className="mt-1 text-sm text-red-700">
            <p>{displayMessage}</p>
          </div>

          {/* Technical details (only in development or when explicitly requested) */}
          {showDetails && (process.env.NODE_ENV === 'development' || showTechnicalDetails) && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-red-600 hover:text-red-800">
                Technical Details
              </summary>
              <div className="mt-2 p-2 bg-red-100 rounded text-xs font-mono text-red-800 overflow-auto max-h-32">
                {technicalDetails.errorId && (
                  <div className="mb-1">
                    <strong>Error ID:</strong> {technicalDetails.errorId}
                  </div>
                )}
                {technicalDetails.code && (
                  <div className="mb-1">
                    <strong>Code:</strong> {technicalDetails.code}
                  </div>
                )}
                {technicalDetails.status && (
                  <div className="mb-1">
                    <strong>Status:</strong> {technicalDetails.status}
                  </div>
                )}
                {technicalDetails.timestamp && (
                  <div className="mb-1">
                    <strong>Time:</strong> {technicalDetails.timestamp.toISOString()}
                  </div>
                )}
                {technicalDetails.message && (
                  <div className="mb-1">
                    <strong>Message:</strong> {technicalDetails.message}
                  </div>
                )}
              </div>
            </details>
          )}

          {/* Action buttons */}
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            {showRetry && onRetry && (
              <button
                onClick={onRetry}
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
              >
                {userMessage.action || 'Try Again'}
              </button>
            )}
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300 transition-colors"
              >
                Dismiss
              </button>
            )}

            {showDetails && process.env.NODE_ENV === 'development' && (
              <button
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="text-red-600 hover:text-red-800 text-sm underline"
              >
                {showTechnicalDetails ? 'Hide' : 'Show'} Details
              </button>
            )}
          </div>

          {/* Error ID for support */}
          {technicalDetails.errorId && (
            <div className="mt-3 text-xs text-gray-500">
              Reference ID: {technicalDetails.errorId}
            </div>
          )}
        </div>

        {/* Close button for toast/modal variants */}
        {(variant === 'toast' || variant === 'modal') && onDismiss && (
          <div className="ml-4 flex-shrink-0">
            <button
              onClick={onDismiss}
              className="bg-red-50 rounded-md p-1.5 text-red-400 hover:bg-red-100 hover:text-red-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (variant === 'modal') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={`${getVariantStyles()} ${className}`}
          onClick={onDismiss}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <ErrorContent />
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (variant === 'toast') {
    return (
      <motion.div
        initial={{ opacity: 0, x: 300 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 300 }}
        className={`${getVariantStyles()} ${className}`}
      >
        <ErrorContent />
      </motion.div>
    );
  }

  return (
    <div className={`${getVariantStyles()} ${className}`}>
      <ErrorContent />
    </div>
  );
}

/**
 * Hook for managing error state with user-friendly messages
 */
export function useUserFriendlyError() {
  const [error, setError] = useState<ErrorDetails | null>(null);

  const showError = (errorData: ErrorDetails | Error | string) => {
    const { technicalDetails } = processError(errorData);
    setError(technicalDetails);
    
    // Log technical details for debugging (but don't expose to user)
    console.error('Error occurred:', technicalDetails);
  };

  const clearError = () => {
    setError(null);
  };

  return {
    error,
    showError,
    clearError,
    hasError: !!error
  };
}

/**
 * Higher-order component for wrapping components with error handling
 */
export function withUserFriendlyError<P extends object>(
  Component: React.ComponentType<P>,
  errorProps?: Partial<UserFriendlyErrorProps>
) {
  const WrappedComponent = (props: P) => {
    const { error, showError, clearError } = useUserFriendlyError();

    if (error) {
      return (
        <UserFriendlyError
          error={error}
          onRetry={clearError}
          onDismiss={clearError}
          {...errorProps}
        />
      );
    }

    return (
      <Component
        {...props}
        onError={showError}
      />
    );
  };

  WrappedComponent.displayName = `withUserFriendlyError(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}