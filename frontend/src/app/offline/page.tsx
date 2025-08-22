/**
 * Offline page for when users lose internet connection
 * Provides graceful degradation and helpful information
 */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { WifiIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Set initial state (only on client side)
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleGoHome = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  useEffect(() => {
    if (isOnline && typeof window !== 'undefined') {
      // Redirect to home if back online
      const timer = setTimeout(() => {
        window.location.href = '/';
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center"
      >
        {/* Connection Status Icon */}
        <motion.div
          animate={isOnline ? { scale: [1, 1.1, 1] } : { rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="mb-6"
        >
          <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
            isOnline ? 'bg-green-100' : 'bg-red-100'
          }`}>
            <WifiIcon className={`w-10 h-10 ${
              isOnline ? 'text-green-600' : 'text-red-600'
            }`} />
          </div>
        </motion.div>

        {/* Status Message */}
        <motion.div
          key={isOnline ? 'online' : 'offline'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {isOnline ? (
            <>
              <h1 className="text-2xl font-bold text-green-600 mb-2">
                Back Online!
              </h1>
              <p className="text-gray-600 mb-6">
                Your connection has been restored. Redirecting you back to Perbox...
              </p>
              <div className="flex items-center justify-center">
                <ArrowPathIcon className="w-5 h-5 text-green-600 animate-spin mr-2" />
                <span className="text-green-600">Redirecting...</span>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                You're Offline
              </h1>
              <p className="text-gray-600 mb-6">
                It looks like you've lost your internet connection. Don't worry, 
                some features may still work from your cache.
              </p>

              {/* Offline Features */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                <h3 className="font-semibold text-gray-900 mb-2">
                  What you can still do:
                </h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• View previously loaded pages</li>
                  <li>• Browse cached content</li>
                  <li>• Read documentation</li>
                  <li>• Access basic features</li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleRetry}
                  className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                >
                  <ArrowPathIcon className="w-5 h-5 mr-2" />
                  Try Again {retryCount > 0 && `(${retryCount})`}
                </button>
                
                <button
                  onClick={handleGoHome}
                  className="w-full bg-gray-200 text-gray-800 py-3 px-4 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Go to Home Page
                </button>
              </div>

              {/* Tips */}
              <div className="mt-6 text-xs text-gray-500">
                <p className="mb-2">💡 Tips to get back online:</p>
                <ul className="text-left space-y-1">
                  <li>• Check your WiFi connection</li>
                  <li>• Try switching to mobile data</li>
                  <li>• Move to an area with better signal</li>
                  <li>• Restart your router if needed</li>
                </ul>
              </div>
            </>
          )}
        </motion.div>

        {/* Connection Quality Indicator */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
            <div className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-green-400' : 'bg-red-400'
            }`} />
            <span>
              {isOnline ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}