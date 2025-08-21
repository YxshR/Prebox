import React from 'react';
import { useAIFeatures } from '../../hooks/useAIFeatures';
import { AIFeatureStatus } from '../../services/aiFeatureManager';
import { AIErrorDisplay } from './AIErrorDisplay';

interface AIFeatureGuardProps {
  feature: keyof Omit<AIFeatureStatus, 'overall'>;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showError?: boolean;
  allowFallback?: boolean;
  className?: string;
  onRetry?: () => void;
}

export const AIFeatureGuard: React.FC<AIFeatureGuardProps> = ({
  feature,
  children,
  fallback,
  showError = true,
  allowFallback = true,
  className = '',
  onRetry
}) => {
  const { 
    isFeatureAvailable, 
    getFeature, 
    getStatusMessage, 
    getRecommendedAction,
    refresh 
  } = useAIFeatures();

  const featureData = getFeature(feature);
  const isAvailable = isFeatureAvailable(feature);

  // If feature is available, render children
  if (isAvailable) {
    return <>{children}</>;
  }

  // If feature has fallback and we allow it, render children with warning
  if (allowFallback && featureData?.fallbackAvailable) {
    return (
      <div className={className}>
        {showError && (
          <div className="mb-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <div className="flex-shrink-0 text-yellow-600">
                  ⚠️
                </div>
                <div className="flex-1">
                  <p className="text-sm text-yellow-800">
                    {getStatusMessage(feature)}
                  </p>
                  <p className="mt-1 text-xs text-yellow-700">
                    Limited functionality available. {getRecommendedAction(feature)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        {children}
      </div>
    );
  }

  // If we have a custom fallback, render it
  if (fallback) {
    return <div className={className}>{fallback}</div>;
  }

  // Show error state
  if (showError && featureData) {
    const handleRetry = async () => {
      await refresh();
      onRetry?.();
    };

    return (
      <div className={className}>
        <AIErrorDisplay
          error={{
            type: 'service_unavailable',
            message: featureData.errorMessage || 'Feature unavailable',
            userMessage: getStatusMessage(feature),
            retryable: true
          }}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  // Default: render nothing
  return null;
};

export default AIFeatureGuard;