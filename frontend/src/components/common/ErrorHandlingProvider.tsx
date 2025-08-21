'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ErrorBoundary } from './ErrorBoundary';
import { GracefulDegradation } from './GracefulDegradation';
import { OfflineCapable } from './OfflineCapable';
import { UserFriendlyError } from './UserFriendlyError';
import { ConnectionBanner } from './ConnectionStatus';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';

interface ErrorState {
  id: string;
  error: any;
  timestamp: Date;
  context?: string;
}

interface ErrorHandlingContextType {
  errors: ErrorState[];
  showError: (error: any, context?: string) => string;
  dismissError: (id: string) => void;
  clearAllErrors: () => void;
  hasErrors: boolean;
}

const ErrorHandlingContext = createContext<ErrorHandlingContextType | null>(null);

interface ErrorHandlingProviderProps {
  children: ReactNode;
  showGlobalErrorBanner?: boolean;
  enableOfflineMode?: boolean;
  enableGracefulDegradation?: boolean;
  maxErrors?: number;
}

/**
 * Comprehensive error handling provider that manages all error states
 */
export function ErrorHandlingProvider({
  children,
  showGlobalErrorBanner = true,
  enableOfflineMode = true,
  enableGracefulDegradation = true,
  maxErrors = 5
}: ErrorHandlingProviderProps) {
  const [errors, setErrors] = useState<ErrorState[]>([]);
  const { status } = useConnectionStatus();

  const showError = useCallback((error: any, context?: string): string => {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newError: ErrorState = {
      id: errorId,
      error,
      timestamp: new Date(),
      context
    };

    setErrors(prev => {
      const updated = [newError, ...prev];
      // Keep only the most recent errors
      return updated.slice(0, maxErrors);
    });

    // Auto-dismiss non-critical errors after 10 seconds
    if (!isCriticalError(error)) {
      setTimeout(() => {
        dismissError(errorId);
      }, 10000);
    }

    return errorId;
  }, [maxErrors]);

  const dismissError = useCallback((id: string) => {
    setErrors(prev => prev.filter(error => error.id !== id));
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const isCriticalError = (error: any): boolean => {
    if (typeof error === 'object' && error !== null) {
      const status = error.status || error.response?.status;
      const code = error.code;
      
      // Critical errors that should not auto-dismiss
      return (
        status >= 500 || // Server errors
        code === 'ERR_CONNECTION_REFUSED' ||
        code === 'NETWORK_ERROR' ||
        error.critical === true
      );
    }
    return false;
  };

  const contextValue: ErrorHandlingContextType = {
    errors,
    showError,
    dismissError,
    clearAllErrors,
    hasErrors: errors.length > 0
  };

  const WrapperComponent = enableGracefulDegradation ? GracefulDegradation : 
                          enableOfflineMode ? OfflineCapable : 
                          React.Fragment;

  const wrapperProps = enableGracefulDegradation ? {
    showConnectionBanner: showGlobalErrorBanner,
    requiresConnection: false // Let individual components decide
  } : enableOfflineMode ? {
    showOfflineIndicator: showGlobalErrorBanner
  } : {};

  return (
    <ErrorHandlingContext.Provider value={contextValue}>
      <ErrorBoundary
        onError={(error, errorInfo) => {
          showError(error, 'React Error Boundary');
        }}
      >
        <WrapperComponent {...wrapperProps}>
          {/* Global connection banner */}
          {showGlobalErrorBanner && (
            <AnimatePresence>
              {(!status.isOnline || !status.isConnected) && (
                <ConnectionBanner />
              )}
            </AnimatePresence>
          )}

          {/* Global error toasts */}
          <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
            <AnimatePresence>
              {errors.slice(0, 3).map((errorState) => (
                <UserFriendlyError
                  key={errorState.id}
                  error={errorState.error}
                  variant="toast"
                  onDismiss={() => dismissError(errorState.id)}
                  showRetry={isCriticalError(errorState.error)}
                  onRetry={() => {
                    // Retry logic could be implemented here
                    dismissError(errorState.id);
                  }}
                />
              ))}
            </AnimatePresence>
          </div>

          {/* Error count indicator for development */}
          {process.env.NODE_ENV === 'development' && errors.length > 3 && (
            <div className="fixed bottom-4 right-4 z-50 bg-red-600 text-white px-3 py-1 rounded-full text-sm">
              +{errors.length - 3} more errors
            </div>
          )}

          {children}
        </WrapperComponent>
      </ErrorBoundary>
    </ErrorHandlingContext.Provider>
  );
}

/**
 * Hook to use error handling context
 */
export function useErrorHandling() {
  const context = useContext(ErrorHandlingContext);
  
  if (!context) {
    throw new Error('useErrorHandling must be used within an ErrorHandlingProvider');
  }
  
  return context;
}

/**
 * Hook for handling API errors with automatic retry and user-friendly messages
 */
export function useApiErrorHandler() {
  const { showError } = useErrorHandling();
  const { status, retryConnection } = useConnectionStatus();

  const handleApiError = useCallback(async (error: any, context?: string) => {
    // Check if it's a connection error
    const isConnectionError = 
      error.code === 'ERR_CONNECTION_REFUSED' ||
      error.code === 'NETWORK_ERROR' ||
      error.message?.includes('fetch') ||
      error.response?.status >= 500;

    if (isConnectionError && !status.isConnected) {
      // Try to reconnect first
      await retryConnection();
      
      // If still not connected, show error
      if (!status.isConnected) {
        return showError(error, context || 'API Error');
      }
    } else {
      // Show error immediately for non-connection errors
      return showError(error, context || 'API Error');
    }
  }, [showError, status.isConnected, retryConnection]);

  return {
    handleApiError,
    isConnectionError: !status.isConnected,
    connectionStatus: status
  };
}

/**
 * Higher-order component that provides error handling to any component
 */
export function withErrorHandling<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    enableGracefulDegradation?: boolean;
    enableOfflineMode?: boolean;
    errorContext?: string;
  }
) {
  const WrappedComponent = (props: P) => {
    const { handleApiError } = useApiErrorHandler();

    return (
      <Component
        {...props}
        onError={(error: any) => {
          handleApiError(error, options?.errorContext);
        }}
      />
    );
  };

  WrappedComponent.displayName = `withErrorHandling(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * Component for displaying error summary (useful for admin/debug views)
 */
export function ErrorSummary({ className = '' }: { className?: string }) {
  const { errors, clearAllErrors } = useErrorHandling();

  if (errors.length === 0) {
    return null;
  }

  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-red-800">
          Recent Errors ({errors.length})
        </h3>
        <button
          onClick={clearAllErrors}
          className="text-xs text-red-600 hover:text-red-800 underline"
        >
          Clear All
        </button>
      </div>
      
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {errors.map((errorState) => (
          <div key={errorState.id} className="text-xs text-red-700 bg-red-100 p-2 rounded">
            <div className="font-medium">
              {errorState.context || 'Unknown Context'}
            </div>
            <div className="text-red-600">
              {typeof errorState.error === 'string' 
                ? errorState.error 
                : errorState.error.message || 'Unknown error'
              }
            </div>
            <div className="text-red-500 mt-1">
              {errorState.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}