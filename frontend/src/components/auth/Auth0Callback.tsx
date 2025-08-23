'use client';

import React, { useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useRouter } from 'next/navigation';

interface Auth0CallbackProps {
  onSuccess?: (user: any) => void;
  onError?: (error: string) => void;
  redirectTo?: string;
}

export function Auth0Callback({ 
  onSuccess, 
  onError, 
  redirectTo = '/dashboard' 
}: Auth0CallbackProps) {
  const { 
    handleRedirectCallback, 
    isAuthenticated, 
    isLoading, 
    error, 
    user 
  } = useAuth0();
  const router = useRouter();
  const [callbackProcessed, setCallbackProcessed] = useState(false);

  useEffect(() => {
    const processCallback = async () => {
      if (callbackProcessed) return;

      try {
        // Handle the Auth0 callback
        await handleRedirectCallback();
        setCallbackProcessed(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Authentication callback failed';
        console.error('Auth0 callback error:', errorMessage);
        onError?.(errorMessage);
        setCallbackProcessed(true);
      }
    };

    // Only process callback if we're not already authenticated and not loading
    if (!isAuthenticated && !isLoading && !callbackProcessed) {
      processCallback();
    }
  }, [handleRedirectCallback, isAuthenticated, isLoading, callbackProcessed, onError]);

  useEffect(() => {
    // Handle successful authentication
    if (isAuthenticated && user && callbackProcessed) {
      onSuccess?.(user);
      
      // Redirect to the specified route
      router.push(redirectTo);
    }
  }, [isAuthenticated, user, callbackProcessed, onSuccess, router, redirectTo]);

  useEffect(() => {
    // Handle Auth0 errors
    if (error) {
      const errorMessage = `Authentication error: ${error.message}`;
      console.error('Auth0 error:', errorMessage);
      onError?.(errorMessage);
    }
  }, [error, onError]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Authentication Failed
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              {error.message}
            </p>
            <button
              onClick={() => router.push('/auth/login')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {isLoading ? 'Authenticating...' : 'Processing...'}
          </h3>
          <p className="text-sm text-gray-500">
            {isLoading 
              ? 'Please wait while we authenticate your account.'
              : 'Completing your authentication...'
            }
          </p>
        </div>
      </div>
    </div>
  );
}