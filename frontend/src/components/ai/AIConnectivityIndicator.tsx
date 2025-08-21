import React from 'react';
import { useAIConnectivity } from '../../hooks/useAIConnectivity';
import { aiConnectivityService } from '../../services/aiConnectivityService';

interface AIConnectivityIndicatorProps {
  showDetails?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const AIConnectivityIndicator: React.FC<AIConnectivityIndicatorProps> = ({
  showDetails = false,
  className = '',
  size = 'md'
}) => {
  const { status, isLoading, refresh } = useAIConnectivity();

  if (isLoading && !status) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-600"></div>
        <span className="text-sm text-gray-600">Checking AI status...</span>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const statusColor = aiConnectivityService.getStatusColor(status);
  const statusText = aiConnectivityService.getStatusText(status);
  const errorMessage = aiConnectivityService.getUIErrorMessage(status);

  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4'
  };

  const colorClasses = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="flex items-center space-x-1">
        <div 
          className={`rounded-full ${sizeClasses[size]} ${colorClasses[statusColor]}`}
          title={errorMessage}
        />
        <span className={`font-medium ${textSizeClasses[size]} ${
          statusColor === 'green' ? 'text-green-700' :
          statusColor === 'yellow' ? 'text-yellow-700' :
          'text-red-700'
        }`}>
          AI {statusText}
        </span>
      </div>

      {showDetails && (
        <div className="flex items-center space-x-2">
          <span className={`${textSizeClasses[size]} text-gray-600`}>
            {status.responseTime && `${status.responseTime}ms`}
          </span>
          <button
            onClick={refresh}
            className={`${textSizeClasses[size]} text-blue-600 hover:text-blue-800 underline`}
            title="Refresh status"
          >
            Refresh
          </button>
        </div>
      )}

      {!status.featuresAvailable && (
        <div className="ml-2">
          <span className={`${textSizeClasses[size]} text-gray-500`} title={errorMessage}>
            ⚠️
          </span>
        </div>
      )}
    </div>
  );
};

export default AIConnectivityIndicator;