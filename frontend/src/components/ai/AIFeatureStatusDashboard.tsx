import React from 'react';
import { useAIFeatures } from '../../hooks/useAIFeatures';
import { AIFeatureStatus } from '../../services/aiFeatureManager';

interface AIFeatureStatusDashboardProps {
  className?: string;
  showDetails?: boolean;
  onFeatureClick?: (featureId: keyof Omit<AIFeatureStatus, 'overall'>) => void;
}

export const AIFeatureStatusDashboard: React.FC<AIFeatureStatusDashboardProps> = ({
  className = '',
  showDetails = true,
  onFeatureClick
}) => {
  const { status, isLoading, refresh } = useAIFeatures();

  if (isLoading && !status) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center justify-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600"></div>
          <span className="text-gray-600">Loading AI feature status...</span>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <div className="text-center">
          <h3 className="text-sm font-medium text-red-800">Unable to Load Feature Status</h3>
          <p className="mt-1 text-sm text-red-700">Failed to retrieve AI feature status.</p>
          <button
            onClick={refresh}
            className="mt-3 text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const getOverallStatusColor = () => {
    switch (status.overall.status) {
      case 'all_available':
        return 'green';
      case 'partial_available':
        return 'yellow';
      case 'none_available':
        return 'red';
      default:
        return 'gray';
    }
  };

  const getOverallStatusText = () => {
    switch (status.overall.status) {
      case 'all_available':
        return 'All AI features are available';
      case 'partial_available':
        return `${status.overall.available} of ${status.overall.total} AI features available`;
      case 'none_available':
        return 'No AI features are currently available';
      default:
        return 'Unknown status';
    }
  };

  const getFeatureStatusColor = (isAvailable: boolean, fallbackAvailable: boolean) => {
    if (isAvailable) return 'green';
    if (fallbackAvailable) return 'yellow';
    return 'red';
  };

  const getFeatureStatusIcon = (isAvailable: boolean, fallbackAvailable: boolean) => {
    if (isAvailable) return '✅';
    if (fallbackAvailable) return '⚠️';
    return '❌';
  };

  const overallColor = getOverallStatusColor();
  const overallColorClasses = {
    green: 'bg-green-50 border-green-200',
    yellow: 'bg-yellow-50 border-yellow-200',
    red: 'bg-red-50 border-red-200',
    gray: 'bg-gray-50 border-gray-200'
  };

  const features = [
    { id: 'templateGeneration' as const, feature: status.templateGeneration },
    { id: 'templateCustomization' as const, feature: status.templateCustomization },
    { id: 'contentSuggestions' as const, feature: status.contentSuggestions }
  ];

  return (
    <div className={`border rounded-lg ${overallColorClasses[overallColor]} ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`h-3 w-3 rounded-full ${
              overallColor === 'green' ? 'bg-green-500' :
              overallColor === 'yellow' ? 'bg-yellow-500' :
              overallColor === 'red' ? 'bg-red-500' : 'bg-gray-500'
            }`}></div>
            <h3 className="text-lg font-medium text-gray-900">AI Features Status</h3>
          </div>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
          >
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-600">{getOverallStatusText()}</p>
      </div>

      {/* Feature List */}
      <div className="p-4">
        <div className="space-y-3">
          {features.map(({ id, feature }) => {
            const statusColor = getFeatureStatusColor(feature.isAvailable, feature.fallbackAvailable);
            const statusIcon = getFeatureStatusIcon(feature.isAvailable, feature.fallbackAvailable);

            return (
              <div
                key={id}
                className={`flex items-start space-x-3 p-3 rounded-lg border ${
                  onFeatureClick ? 'cursor-pointer hover:bg-gray-50' : ''
                } ${
                  statusColor === 'green' ? 'bg-green-50 border-green-200' :
                  statusColor === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-red-50 border-red-200'
                }`}
                onClick={() => onFeatureClick?.(id)}
              >
                <div className="flex-shrink-0 text-lg">
                  {statusIcon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-gray-900">
                      {feature.name}
                    </h4>
                    <span className="text-xs text-gray-500">
                      {feature.lastChecked.toLocaleTimeString()}
                    </span>
                  </div>
                  
                  {showDetails && (
                    <>
                      <p className="mt-1 text-sm text-gray-600">
                        {feature.description}
                      </p>
                      
                      <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                        <span>
                          Internet: {feature.requiresInternet ? 'Required' : 'Not required'}
                        </span>
                        <span>
                          API Key: {feature.requiresApiKey ? 'Required' : 'Not required'}
                        </span>
                        {feature.fallbackAvailable && (
                          <span className="text-yellow-600">
                            Fallback available
                          </span>
                        )}
                      </div>

                      {feature.errorMessage && (
                        <p className="mt-2 text-xs text-red-600">
                          {feature.errorMessage}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            Last updated: {status.templateGeneration.lastChecked.toLocaleString()}
          </span>
          <span>
            {status.overall.available}/{status.overall.total} features available
          </span>
        </div>
      </div>
    </div>
  );
};

export default AIFeatureStatusDashboard;