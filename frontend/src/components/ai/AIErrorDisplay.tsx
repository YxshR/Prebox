import React from 'react';

export interface AIError {
  type: 'connectivity' | 'api_key' | 'quota_exceeded' | 'rate_limit' | 'invalid_request' | 'service_unavailable' | 'timeout' | 'unknown';
  message: string;
  userMessage: string;
  retryable: boolean;
  retryAfter?: number;
  details?: Record<string, any>;
}

interface AIErrorDisplayProps {
  error: AIError | Error | string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
  showDetails?: boolean;
}

export const AIErrorDisplay: React.FC<AIErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  className = '',
  showDetails = false
}) => {
  // Normalize error to AIError format
  const normalizedError: AIError = React.useMemo(() => {
    if (typeof error === 'string') {
      return {
        type: 'unknown',
        message: error,
        userMessage: error,
        retryable: true
      };
    }

    if (error instanceof Error) {
      return {
        type: 'unknown',
        message: error.message,
        userMessage: error.message,
        retryable: true
      };
    }

    return error;
  }, [error]);

  const getErrorIcon = (type: AIError['type']) => {
    switch (type) {
      case 'connectivity':
      case 'timeout':
        return '🌐';
      case 'api_key':
        return '🔑';
      case 'quota_exceeded':
        return '📊';
      case 'rate_limit':
        return '⏱️';
      case 'service_unavailable':
        return '🔧';
      default:
        return '⚠️';
    }
  };

  const getErrorColor = (type: AIError['type']) => {
    switch (type) {
      case 'connectivity':
      case 'timeout':
        return 'yellow';
      case 'api_key':
      case 'quota_exceeded':
        return 'red';
      case 'rate_limit':
        return 'orange';
      case 'service_unavailable':
        return 'blue';
      default:
        return 'red';
    }
  };

  const color = getErrorColor(normalizedError.type);
  const icon = getErrorIcon(normalizedError.type);

  const colorClasses = {
    red: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      button: 'bg-red-100 hover:bg-red-200 text-red-800'
    },
    yellow: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-200',
      text: 'text-yellow-800',
      button: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800'
    },
    orange: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-800',
      button: 'bg-orange-100 hover:bg-orange-200 text-orange-800'
    },
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      button: 'bg-blue-100 hover:bg-blue-200 text-blue-800'
    }
  };

  const classes = colorClasses[color];

  return (
    <div className={`border rounded-lg p-4 ${classes.bg} ${classes.border} ${className}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 text-lg">
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-medium ${classes.text}`}>
              AI Service Error
            </h3>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className={`text-sm ${classes.text} hover:opacity-75`}
              >
                ✕
              </button>
            )}
          </div>
          
          <p className={`mt-1 text-sm ${classes.text}`}>
            {normalizedError.userMessage}
          </p>

          {normalizedError.retryAfter && (
            <p className={`mt-1 text-xs ${classes.text} opacity-75`}>
              Please wait {normalizedError.retryAfter > 60 
                ? `${Math.ceil(normalizedError.retryAfter / 60)} minute${Math.ceil(normalizedError.retryAfter / 60) > 1 ? 's' : ''}` 
                : `${normalizedError.retryAfter} second${normalizedError.retryAfter > 1 ? 's' : ''}`
              } before retrying.
            </p>
          )}

          {showDetails && normalizedError.details && (
            <details className="mt-2">
              <summary className={`text-xs ${classes.text} cursor-pointer`}>
                Technical Details
              </summary>
              <pre className={`mt-1 text-xs ${classes.text} bg-white bg-opacity-50 p-2 rounded overflow-auto`}>
                {JSON.stringify(normalizedError.details, null, 2)}
              </pre>
            </details>
          )}

          <div className="mt-3 flex items-center space-x-3">
            {normalizedError.retryable && onRetry && (
              <button
                onClick={onRetry}
                className={`text-xs px-3 py-1 rounded ${classes.button}`}
              >
                Try Again
              </button>
            )}
            
            <span className={`text-xs ${classes.text} opacity-75`}>
              Error Type: {normalizedError.type.replace('_', ' ')}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIErrorDisplay;