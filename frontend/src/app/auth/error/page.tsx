'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Button from '../../../components/ui/Button';

function ErrorPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const error = searchParams.get('error') || 'Authentication failed';
  const message = searchParams.get('message') || 'An error occurred during authentication. Please try again.';

  const handleRetry = () => {
    router.push('/auth/login');
  };

  const handleGoHome = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white shadow-lg rounded-lg p-8 max-w-md w-full mx-auto text-center"
      >
        {/* Error Icon */}
        <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>

        {/* Error Content */}
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Authentication Error</h1>
        <p className="text-gray-600 mb-2 font-medium">{error}</p>
        <p className="text-gray-500 mb-8 text-sm">{message}</p>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleRetry}
            className="w-full"
            size="lg"
          >
            Try Again
          </Button>
          <Button
            onClick={handleGoHome}
            variant="outline"
            className="w-full"
            size="lg"
          >
            Go Home
          </Button>
        </div>

        {/* Help Text */}
        <p className="text-xs text-gray-500 mt-6">
          If you continue to experience issues, please contact support.
        </p>
      </motion.div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    }>
      <ErrorPageContent />
    </Suspense>
  );
}