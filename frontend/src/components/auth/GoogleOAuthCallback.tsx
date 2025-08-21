'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import LoadingState from '../LoadingState';
import ErrorDisplay from '../ErrorDisplay';

interface GoogleOAuthCallbackProps {
  onSuccess?: (user: any) => void;
  onError?: (error: string) => void;
}

export default function GoogleOAuthCallback({ 
  onSuccess, 
  onError 
}: GoogleOAuthCallbackProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for error parameters
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        
        if (errorParam) {
          const errorMessage = errorDescription || 'Google authentication failed';
          setError(errorMessage);
          toast.error(errorMessage);
          onError?.(errorMessage);
          return;
        }

        // Check for success parameters
        const token = searchParams.get('token');
        const refreshToken = searchParams.get('refresh_token');
        const user = searchParams.get('user');
        const success = searchParams.get('success');

        if (success === 'true' && token && refreshToken) {
          // Store tokens
          localStorage.setItem('accessToken', token);
          localStorage.setItem('refreshToken', refreshToken);

          // Parse user data if provided
          let userData = null;
          if (user) {
            try {
              userData = JSON.parse(decodeURIComponent(user));
            } catch (e) {
              console.warn('Failed to parse user data:', e);
            }
          }

          toast.success('Google authentication successful!');
          onSuccess?.(userData);
          
          // Redirect to dashboard
          router.push('/dashboard');
        } else if (success === 'false' || (!token && !refreshToken)) {
          // Authentication failed or no tokens received
          const errorMessage = searchParams.get('message') || 'Authentication failed - no tokens received';
          setError(errorMessage);
          toast.error(errorMessage);
          onError?.(errorMessage);
        } else {
          // Fallback case
          const errorMessage = 'Authentication status unclear';
          setError(errorMessage);
          toast.error(errorMessage);
          onError?.(errorMessage);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Authentication failed';
        setError(errorMessage);
        toast.error(errorMessage);
        onError?.(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    handleCallback();
  }, [searchParams, router, onSuccess, onError]);

  const handleRetry = () => {
    router.push('/auth/login');
  };

  const handleGoHome = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white shadow-lg rounded-lg p-8 max-w-md w-full mx-4"
        >
          <div className="text-center">
            <LoadingState message="Completing Google authentication..." />
            <p className="text-gray-600 mt-4">
              Please wait while we sign you in...
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white shadow-lg rounded-lg p-8 max-w-md w-full mx-4"
        >
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Failed</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            
            <div className="space-y-3">
              <button
                onClick={handleRetry}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={handleGoHome}
                className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 transition-colors"
              >
                Go Home
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // This should not be reached, but just in case
  return null;
}