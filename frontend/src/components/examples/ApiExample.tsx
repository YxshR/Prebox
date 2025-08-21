'use client';

import React, { useState } from 'react';
import { apiClient } from '../../lib/api-client';
import { useConnectionStatus, useApiErrorHandler } from '../../hooks/useConnectionStatus';
import { ConnectionStatus, ConnectionBanner } from '../common/ConnectionStatus';

/**
 * Example component demonstrating the new API client with retry logic
 */
export function ApiExample() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { status } = useConnectionStatus();
  const { handleApiError } = useApiErrorHandler();

  const testHealthCheck = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiClient.healthCheck();
      setResult(response);
    } catch (err: any) {
      const wasHandled = await handleApiError(err);
      if (!wasHandled) {
        setError(err.message || 'An error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const testDetailedHealth = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await apiClient.detailedHealthCheck();
      setResult(response);
    } catch (err: any) {
      const wasHandled = await handleApiError(err);
      if (!wasHandled) {
        setError(err.message || 'An error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const testApiCall = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Example API call that might fail
      const response = await apiClient.get('/auth/me');
      setResult(response);
    } catch (err: any) {
      const wasHandled = await handleApiError(err);
      if (!wasHandled) {
        setError(err.message || 'An error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        API Connection Testing
      </h1>

      {/* Connection Status Banner */}
      <ConnectionBanner />

      {/* Connection Status Display */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-3">Connection Status</h2>
        <ConnectionStatus showWhenOnline={true} />
        
        <div className="mt-4 text-sm text-gray-600">
          <p><strong>Online:</strong> {status.isOnline ? 'Yes' : 'No'}</p>
          <p><strong>API Connected:</strong> {status.isConnected ? 'Yes' : 'No'}</p>
          <p><strong>Retry Count:</strong> {status.retryCount}</p>
          {status.error && (
            <p><strong>Last Error:</strong> {status.error}</p>
          )}
          {status.lastChecked && (
            <p><strong>Last Checked:</strong> {status.lastChecked.toLocaleString()}</p>
          )}
        </div>
      </div>

      {/* Test Buttons */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-3">API Tests</h2>
        
        <div className="space-x-4">
          <button
            onClick={testHealthCheck}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded font-medium"
          >
            {loading ? 'Testing...' : 'Test Health Check'}
          </button>
          
          <button
            onClick={testDetailedHealth}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded font-medium"
          >
            {loading ? 'Testing...' : 'Test Detailed Health'}
          </button>
          
          <button
            onClick={testApiCall}
            disabled={loading}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white px-4 py-2 rounded font-medium"
          >
            {loading ? 'Testing...' : 'Test API Call'}
          </button>
        </div>
      </div>

      {/* Results Display */}
      {(result || error) && (
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-3">Results</h2>
          
          {error && (
            <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
              <p className="text-red-800 font-medium">Error:</p>
              <p className="text-red-700">{error}</p>
            </div>
          )}
          
          {result && (
            <div className="bg-gray-50 border border-gray-200 rounded p-3">
              <p className="text-gray-800 font-medium mb-2">Response:</p>
              <pre className="text-sm text-gray-700 overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Usage Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-blue-900 mb-3">
          How to Use the Enhanced API Client
        </h2>
        
        <div className="text-blue-800 space-y-2">
          <p>
            <strong>Automatic Retry:</strong> The API client automatically retries failed requests 
            with exponential backoff for network errors and server errors (5xx).
          </p>
          
          <p>
            <strong>Connection Monitoring:</strong> The connection status is monitored continuously 
            and will show real-time status updates.
          </p>
          
          <p>
            <strong>Circuit Breaker:</strong> If too many requests fail, the circuit breaker 
            will temporarily stop making requests to prevent overwhelming the server.
          </p>
          
          <p>
            <strong>Error Handling:</strong> Use the <code>useApiErrorHandler</code> hook to 
            automatically handle connection errors and retry logic.
          </p>
        </div>
      </div>
    </div>
  );
}