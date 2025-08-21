import React from 'react';
import { useAIConnectivity } from '../../hooks/useAIConnectivity';
import { aiConnectivityService } from '../../services/aiConnectivityService';

interface AIConnectivityCardProps {
  className?: string;
  onRetry?: () => void;
}

export const AIConnectivityCard: React.FC<AIConnectivityCardProps> = ({
  className = '',
  onRetry
}) => {
  const { status, isLoading, error, refresh } = useAIConnectivity();

  const handleRetry = async () => {
    await refresh();
    onRetry?.();
  };

  if (isLoading && !status) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center justify-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600"></div>
          <span className="text-gray-600">Checking AI service status...</span>
        </div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <div className="h-5 w-5 bg-red-500 rounded-full"></div>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">Connection Error</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button
              onClick={handleRetry}
              className="mt-3 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!status) {
    return null;
  }

  const statusColor = aiConnectivityService.getStatusColor(status);
  const statusText = aiConnectivityService.getStatusText(status);
  const errorMessage = aiConnectivityService.getUIErrorMessage(status);

  const cardColorClasses = {
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    red: 'bg-red-50 border-red-200'
  };

  const iconColorClasses = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    red: 'bg-red-500'
  };

  const textColorClasses = {
    green: 'text-green-800',
    yellow: 'text-yellow-800',
    red: 'text-red-800'
  };

  const buttonColorClasses = {
    green: 'bg-green-100 hover:bg-green-200 text-green-800',
    yellow: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800',
    red: 'bg-red-100 hover:bg-red-200 text-red-800'
  };

  return (
    <div className={`border rounded-lg p-6 ${cardColorClasses[statusColor]} ${className}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className={`h-5 w-5 rounded-full ${iconColorClasses[statusColor]}`}></div>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-medium ${textColorClasses[statusColor]}`}>
              AI Features {statusText}
            </h3>
            <span className="text-xs text-gray-500">
              {status.lastChecked.toLocaleTimeString()}
            </span>
          </div>
          
          <p className={`mt-1 text-sm ${textColorClasses[statusColor]}`}>
            {errorMessage}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="font-medium">Internet:</span>
              <span className={`ml-1 ${status.hasInternetAccess ? 'text-green-600' : 'text-red-600'}`}>
                {status.hasInternetAccess ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div>
              <span className="font-medium">Response Time:</span>
              <span className="ml-1 text-gray-600">
                {status.responseTime ? `${status.responseTime}ms` : 'N/A'}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center space-x-3">
            <button
              onClick={handleRetry}
              disabled={isLoading}
              className={`text-xs px-3 py-1 rounded ${buttonColorClasses[statusColor]} ${
                isLoading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isLoading ? 'Checking...' : 'Refresh Status'}
            </button>
            
            {!status.featuresAvailable && (
              <span className="text-xs text-gray-500">
                AI features are currently unavailable
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIConnectivityCard;