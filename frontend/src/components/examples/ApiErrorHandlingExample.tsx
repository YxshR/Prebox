'use client';

import React from 'react';
import { useApiState } from '../../hooks/useApiState';
import ErrorDisplay from '../ErrorDisplay';
import LoadingState from '../LoadingState';
import GracefulDegradation from '../GracefulDegradation';
import { apiClient } from '../../lib/api-client';

/**
 * Example component demonstrating the new error handling and user feedback system
 */
export const ApiErrorHandlingExample: React.FC = () => {
  const { state, execute, retry } = useApiState();

  const testApiCall = async () => {
    await execute(async () => {
      // This will test the API connection and error handling
      const response = await apiClient.healthCheck();
      if (!response.success) {
        throw new Error(response.error?.message || 'Health check failed');
      }
      return response.data;
    });
  };

  const testFailingApiCall = async () => {
    await execute(async () => {
      // This will simulate a failing API call
      const response = await apiClient.get('/non-existent-endpoint');
      if (!response.success) {
        throw new Error(response.error?.message || 'API call failed');
      }
      return response.data;
    });
  };

  return (
    <GracefulDegradation>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">API Error Handling Demo</h2>
          
          <div className="space-y-4">
            <div className="flex space-x-4">
              <button
                onClick={testApiCall}
                disabled={state.loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Test Health Check
              </button>
              
              <button
                onClick={testFailingApiCall}
                disabled={state.loading}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                Test Failing Call
              </button>
            </div>

            {state.loading && (
              <LoadingState message="Testing API connection..." />
            )}

            {state.error && (
              <ErrorDisplay 
                error={state.error} 
                onRetry={retry}
                showTechnicalDetails={true}
              />
            )}

            {state.data && !state.loading && !state.error && (
              <div className="p-4 bg-green-50 border border-green-200 rounded">
                <h3 className="font-medium text-green-800">Success!</h3>
                <pre className="mt-2 text-sm text-green-700 overflow-auto">
                  {JSON.stringify(state.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Features Demonstrated</h3>
          <ul className="space-y-2 text-sm text-gray-600">
            <li>• Intelligent error classification and retry logic</li>
            <li>• User-friendly error messages with actionable guidance</li>
            <li>• Loading states with connection status indicators</li>
            <li>• Circuit breaker pattern to prevent cascading failures</li>
            <li>• Graceful degradation when backend is unavailable</li>
            <li>• Automatic retry with exponential backoff</li>
            <li>• Connection monitoring and status display</li>
          </ul>
        </div>
      </div>
    </GracefulDegradation>
  );
};

export default ApiErrorHandlingExample;