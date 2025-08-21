'use client';

import React, { useState, useEffect, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';
import { ConnectionBanner } from './ConnectionStatus';

interface GracefulDegradationProps {
  children: ReactNode;
  fallbackContent?: ReactNode;
  requiresConnection?: boolean;
  showConnectionBanner?: boolean;
  retryInterval?: number;
  className?: string;
}

/**
 * Component that provides graceful degradation when backend services are unavailable
 */
export function GracefulDegradation({
  children,
  fallbackContent,
  requiresConnection = true,
  showConnectionBanner = true,
  retryInterval = 30000, // 30 seconds
  className = ''
}: GracefulDegradationProps) {
  const { status, isRetrying, retryConnection } = useConnectionStatus();
  const [showFallback, setShowFallback] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Determine if we should show fallback content
  useEffect(() => {
    if (requiresConnection) {
      const shouldShowFallback = !status.isOnline || !status.isConnected;
      setShowFallback(shouldShowFallback);
    }
  }, [status.isOnline, status.isConnected, requiresConnection]);

  // Auto-retry mechanism
  useEffect(() => {
    if (showFallback && retryInterval > 0) {
      const interval = setInterval(() => {
        if (!isRetrying) {
          setRetryCount(prev => prev + 1);
          retryConnection();
        }
      }, retryInterval);

      return () => clearInterval(interval);
    }
  }, [showFallback, retryInterval, isRetrying, retryConnection]);

  const defaultFallbackContent = (
    <div className="min-h-[400px] flex items-center justify-center p-8">
      <div className="max-w-md w-full text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-20 h-20 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center"
        >
          <svg
            className="w-10 h-10 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </motion.div>
        
        <h3 className="text-xl font-semibold text-gray-900 mb-4">
          Service Temporarily Unavailable
        </h3>
        
        <p className="text-gray-600 mb-6">
          We're experiencing connectivity issues. The page will automatically retry connecting.
        </p>

        <div className="space-y-4">
          {/* Retry status */}
          <div className="flex items-center justify-center space-x-2">
            {isRetrying ? (
              <>
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-blue-600">Reconnecting...</span>
              </>
            ) : (
              <span className="text-sm text-gray-500">
                {retryCount > 0 && `Retry attempt: ${retryCount}`}
              </span>
            )}
          </div>

          {/* Manual retry button */}
          <button
            onClick={retryConnection}
            disabled={isRetrying}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isRetrying ? 'Retrying...' : 'Try Again'}
          </button>
        </div>

        {/* Offline capabilities notice */}
        {!status.isOnline && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              You're currently offline. Some features may be limited until your connection is restored.
            </p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={className}>
      {/* Connection status banner */}
      {showConnectionBanner && (
        <AnimatePresence>
          {showFallback && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <ConnectionBanner />
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Main content or fallback */}
      <AnimatePresence mode="wait">
        {showFallback ? (
          <motion.div
            key="fallback"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            {fallbackContent || defaultFallbackContent}
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Higher-order component for wrapping components with graceful degradation
 */
export function withGracefulDegradation<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<GracefulDegradationProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <GracefulDegradation {...options}>
      <Component {...props} />
    </GracefulDegradation>
  );

  WrappedComponent.displayName = `withGracefulDegradation(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * Specialized graceful degradation for different contexts
 */

// API-dependent content
export const ApiDependentContent: React.FC<{
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
}> = ({ children, fallback, className }) => (
  <GracefulDegradation
    requiresConnection={true}
    showConnectionBanner={false}
    fallbackContent={fallback}
    className={className}
  >
    {children}
  </GracefulDegradation>
);

// Critical features that need connection
export const CriticalFeature: React.FC<{
  children: ReactNode;
  featureName?: string;
  className?: string;
}> = ({ children, featureName = 'feature', className }) => (
  <GracefulDegradation
    requiresConnection={true}
    showConnectionBanner={true}
    fallbackContent={
      <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
        <div className="w-12 h-12 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {featureName} Unavailable
        </h3>
        <p className="text-gray-600">
          This feature requires an internet connection. Please check your connection and try again.
        </p>
      </div>
    }
    className={className}
  >
    {children}
  </GracefulDegradation>
);

// Optional features that can work offline
export const OptionalFeature: React.FC<{
  children: ReactNode;
  offlineMessage?: string;
  className?: string;
}> = ({ children, offlineMessage, className }) => {
  const { status } = useConnectionStatus();

  if (!status.isOnline || !status.isConnected) {
    return (
      <div className={`p-4 bg-yellow-50 border border-yellow-200 rounded-lg ${className}`}>
        <div className="flex items-center">
          <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-yellow-800 text-sm">
            {offlineMessage || 'This feature is not available offline'}
          </span>
        </div>
      </div>
    );
  }

  return <div className={className}>{children}</div>;
};