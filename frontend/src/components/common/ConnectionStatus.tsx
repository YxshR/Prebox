'use client';

import React from 'react';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';

interface ConnectionStatusProps {
  showWhenOnline?: boolean;
  className?: string;
}

export function ConnectionStatus({ 
  showWhenOnline = false, 
  className = '' 
}: ConnectionStatusProps) {
  const { status, isRetrying, retryConnection } = useConnectionStatus();

  // Don't show anything if online and showWhenOnline is false
  if (status.isOnline && status.isConnected && !showWhenOnline) {
    return null;
  }

  const getStatusColor = () => {
    if (!status.isOnline) return 'bg-gray-500';
    if (!status.isConnected) return 'bg-red-500';
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (!status.isOnline) return 'Offline';
    if (!status.isConnected) return 'Disconnected';
    return 'Connected';
  };

  const getStatusMessage = () => {
    if (!status.isOnline) {
      return 'No internet connection. Please check your network.';
    }
    if (!status.isConnected) {
      return status.error || 'Unable to connect to server. Retrying...';
    }
    return 'Connected to server';
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Status indicator */}
      <div className="flex items-center space-x-2">
        <div 
          className={`w-2 h-2 rounded-full ${getStatusColor()} ${
            isRetrying ? 'animate-pulse' : ''
          }`}
        />
        <span className="text-sm font-medium text-gray-700">
          {getStatusText()}
        </span>
      </div>

      {/* Detailed status for disconnected state */}
      {(!status.isOnline || !status.isConnected) && (
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500">
            {getStatusMessage()}
          </span>
          
          {/* Retry button */}
          {status.isOnline && !status.isConnected && !isRetrying && (
            <button
              onClick={retryConnection}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Retry
            </button>
          )}
          
          {/* Retry indicator */}
          {isRetrying && (
            <div className="flex items-center space-x-1">
              <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-blue-600">Retrying...</span>
            </div>
          )}
        </div>
      )}

      {/* Last checked time */}
      {status.lastChecked && (
        <span className="text-xs text-gray-400">
          Last checked: {status.lastChecked.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}

/**
 * Compact connection status indicator
 */
export function ConnectionIndicator({ className = '' }: { className?: string }) {
  const { status } = useConnectionStatus();

  const getIndicatorClass = () => {
    if (!status.isOnline) return 'bg-gray-500';
    if (!status.isConnected) return 'bg-red-500 animate-pulse';
    return 'bg-green-500';
  };

  return (
    <div 
      className={`w-3 h-3 rounded-full ${getIndicatorClass()} ${className}`}
      title={status.isOnline && status.isConnected ? 'Connected' : 'Disconnected'}
    />
  );
}

/**
 * Connection status banner for critical connection issues
 */
export function ConnectionBanner() {
  const { status, isRetrying, retryConnection } = useConnectionStatus();

  // Only show for critical connection issues
  if (status.isOnline && status.isConnected) {
    return null;
  }

  return (
    <div className="bg-red-50 border-l-4 border-red-400 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg 
              className="h-5 w-5 text-red-400" 
              viewBox="0 0 20 20" 
              fill="currentColor"
            >
              <path 
                fillRule="evenodd" 
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" 
                clipRule="evenodd" 
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Connection Issue
            </h3>
            <div className="mt-1 text-sm text-red-700">
              {!status.isOnline 
                ? 'No internet connection. Please check your network settings.'
                : 'Unable to connect to the server. Some features may not work properly.'
              }
            </div>
          </div>
        </div>
        
        {/* Retry section */}
        {status.isOnline && !status.isConnected && (
          <div className="flex items-center space-x-2">
            {isRetrying ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border border-red-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-red-700">Retrying...</span>
              </div>
            ) : (
              <button
                onClick={retryConnection}
                className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded text-sm font-medium transition-colors"
              >
                Retry Connection
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}