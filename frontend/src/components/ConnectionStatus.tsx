import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { Button } from './ui/Button';

interface ConnectionStatusProps {
  onRetry?: () => void;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ onRetry }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    checkApiConnection();
  }, [isOnline]);

  const checkApiConnection = async () => {
    setApiStatus('checking');
    
    try {
      const response = await fetch('/api/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      if (response.ok) {
        setApiStatus('online');
      } else {
        setApiStatus('offline');
      }
    } catch (error) {
      console.warn('API connection check failed:', error);
      setApiStatus('offline');
    }
  };

  const handleRetry = () => {
    checkApiConnection();
    onRetry?.();
  };

  if (!isOnline) {
    return (
      <Alert className="mb-4 border-orange-200 bg-orange-50">
        <AlertDescription className="text-orange-800">
          <div className="flex items-center justify-between">
            <span>You&apos;re currently offline. Some features may not work properly.</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetry}
              className="ml-4"
            >
              Retry Connection
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (apiStatus === 'offline') {
    return (
      <Alert className="mb-4 border-red-200 bg-red-50">
        <AlertDescription className="text-red-800">
          <div className="flex items-center justify-between">
            <span>Unable to connect to the server. Some features may not work properly.</span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleRetry}
              className="ml-4"
            >
              Retry Connection
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (apiStatus === 'checking') {
    return (
      <Alert className="mb-4 border-blue-200 bg-blue-50">
        <AlertDescription className="text-blue-800">
          Checking connection status...
        </AlertDescription>
      </Alert>
    );
  }

  return null; // Don't show anything when connection is good
};

export default ConnectionStatus;