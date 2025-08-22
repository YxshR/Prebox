/**
 * End-to-End Error Handling and Graceful Degradation Tests
 * 
 * These tests verify that the application handles various error scenarios
 * gracefully and provides appropriate user feedback and recovery options.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { apiClient } from '../../lib/api-client';
import { googleOAuthService } from '../../lib/googleAuth';
import { useConnectionStatus, useApiErrorHandler } from '../../hooks/useConnectionStatus';
import { useSecurityMonitoring } from '../../hooks/useSecurityMonitoring';
import { apiCircuitBreaker } from '../../lib/retry';
import GoogleAuthButton from '../../components/auth/GoogleAuthButton';
import ConnectionStatus from '../../components/ConnectionStatus';
import ErrorDisplay from '../../components/ErrorDisplay';
import GracefulDegradation from '../../components/GracefulDegradation';

// Mock dependencies
global.fetch = jest.fn();

// Mock components that might not exist yet
jest.mock('../../components/ConnectionStatus', () => {
  return function MockConnectionStatus({ onRetry }: { onRetry?: () => void }) {
    return (
      <div data-testid="connection-status">
        <span>Connection Status</span>
        {onRetry && <button onClick={onRetry} data-testid="retry-button">Retry</button>}
      </div>
    );
  };
});

jest.mock('../../components/ErrorDisplay', () => {
  return function MockErrorDisplay({ error, onRetry }: { error: string; onRetry?: () => void }) {
    return (
      <div data-testid="error-display">
        <span data-testid="error-message">{error}</span>
        {onRetry && <button onClick={onRetry} data-testid="error-retry">Retry</button>}
      </div>
    );
  };
});

jest.mock('../../components/GracefulDegradation', () => {
  return function MockGracefulDegradation({ 
    isOnline, 
    children, 
    fallback 
  }: { 
    isOnline: boolean; 
    children: React.ReactNode; 
    fallback?: React.ReactNode; 
  }) {
    return (
      <div data-testid="graceful-degradation">
        {isOnline ? children : (fallback || <div>Offline Mode</div>)}
      </div>
    );
  };
});

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    button: React.forwardRef<HTMLButtonElement, any>(({ children, ...props }, ref) => (
      <button ref={ref} {...props}>
        {children}
      </button>
    ))
  }
}));

// Mock LoadingState
jest.mock('../../components/LoadingState', () => {
  return function MockLoadingState({ message }: { message: string }) {
    return <div data-testid="loading-state">{message}</div>;
  };
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Mock window.location
const mockLocation = {
  href: '',
  assign: jest.fn(),
  reload: jest.fn()
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
});

describe('Error Handling and Graceful Degradation E2E Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiCircuitBreaker.reset();
    mockLocation.href = '';
    
    // Setup environment
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000/api';
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'test-client-id';
  });

  describe('Network Error Handling', () => {
    it('should handle complete network failure gracefully', async () => {
      // Step 1: Simulate complete network failure
      const networkError = new Error('Network error');
      (networkError as any).code = 'ERR_CONNECTION_REFUSED';
      (global.fetch as jest.Mock).mockRejectedValue(networkError);

      const { result } = renderHook(() => useConnectionStatus());

      // Step 2: Connection status should detect failure
      await act(async () => {
        await result.current.checkConnection();
      });

      await waitFor(() => {
        expect(result.current.status.isConnected).toBe(false);
        expect(result.current.status.error).toContain('Network error');
      });

      // Step 3: User should be able to retry connection
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { status: 'healthy' } })
      });

      await act(async () => {
        await result.current.retryConnection();
      });

      await waitFor(() => {
        expect(result.current.status.isConnected).toBe(true);
        expect(result.current.status.error).toBe(null);
      });
    });

    it('should show appropriate UI during network issues', async () => {
      const TestComponent = () => {
        const { status, retryConnection } = useConnectionStatus();
        
        return (
          <div>
            <ConnectionStatus onRetry={retryConnection} />
            <GracefulDegradation isOnline={status.isConnected}>
              <div data-testid="online-content">Online Content</div>
            </GracefulDegradation>
            {status.error && (
              <ErrorDisplay error={status.error} onRetry={retryConnection} />
            )}
          </div>
        );
      };

      // Step 1: Start with network failure
      const networkError = new Error('Connection failed');
      (global.fetch as jest.Mock).mockRejectedValue(networkError);

      render(<TestComponent />);

      // Step 2: Should show offline state
      await waitFor(() => {
        expect(screen.getByTestId('graceful-degradation')).toBeInTheDocument();
        expect(screen.getByText('Offline Mode')).toBeInTheDocument();
      });

      // Step 3: Network recovers
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { status: 'healthy' } })
      });

      // Step 4: User clicks retry
      const retryButton = screen.getByTestId('retry-button');
      fireEvent.click(retryButton);

      // Step 5: Should show online content
      await waitFor(() => {
        expect(screen.getByTestId('online-content')).toBeInTheDocument();
      });
    });

    it('should handle intermittent network issues', async () => {
      // Step 1: Network works initially
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { message: 'success' } })
      });

      let response = await apiClient.get('/test');
      expect(response.success).toBe(true);

      // Step 2: Network becomes intermittent
      const networkError = new Error('Intermittent failure');
      (networkError as any).code = 'ERR_CONNECTION_REFUSED';

      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { message: 'recovered' } })
        });

      // Step 3: API client should retry and eventually succeed
      response = await apiClient.get('/test');
      expect(response.success).toBe(true);
      expect(response.data.message).toBe('recovered');
      expect(global.fetch).toHaveBeenCalledTimes(4); // 1 initial + 3 for retry
    });
  });

  describe('Authentication Error Handling', () => {
    it('should handle OAuth authentication failures gracefully', async () => {
      const TestAuthComponent = () => {
        const [error, setError] = React.useState<string | null>(null);
        const [loading, setLoading] = React.useState(false);

        const handleAuth = async () => {
          setLoading(true);
          setError(null);
          
          try {
            googleOAuthService.initiateLogin();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Authentication failed');
          } finally {
            setLoading(false);
          }
        };

        return (
          <div>
            <GoogleAuthButton mode="login" disabled={loading} />
            <button onClick={handleAuth} data-testid="manual-auth">
              Manual Auth
            </button>
            {error && <ErrorDisplay error={error} />}
            {loading && <div data-testid="auth-loading">Authenticating...</div>}
          </div>
        );
      };

      // Step 1: OAuth is not configured
      delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

      render(<TestAuthComponent />);

      // Step 2: User attempts authentication
      const manualAuthButton = screen.getByTestId('manual-auth');
      fireEvent.click(manualAuthButton);

      // Step 3: Should show appropriate error
      await waitFor(() => {
        expect(screen.getByTestId('error-display')).toBeInTheDocument();
        expect(screen.getByTestId('error-message')).toHaveTextContent(
          'Google OAuth is not configured'
        );
      });
    });

    it('should handle authentication callback errors', async () => {
      // Step 1: Mock failed OAuth callback
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: false,
          error: {
            code: 'INVALID_CODE',
            message: 'Invalid authorization code'
          }
        })
      });

      // Step 2: Handle callback
      const result = await googleOAuthService.handleCallback('invalid-code');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid authorization code');

      // Step 3: No tokens should be stored
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('should handle token expiration during user session', async () => {
      const { result } = renderHook(() => useApiErrorHandler());

      // Step 1: User starts with valid token
      apiClient.setAuthToken('valid-token');

      // Step 2: Token expires during API call
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({
          success: false,
          error: { code: 'TOKEN_EXPIRED', message: 'Token expired' }
        })
      });

      const response = await apiClient.get('/protected');

      expect(response.success).toBe(false);

      // Step 3: Error handler should detect authentication error
      const isConnectionError = await result.current.handleApiError(response.error);

      expect(isConnectionError).toBe(false); // Auth errors are not connection errors
      expect(result.current.connectionStatus.isConnected).toBe(true);
    });
  });

  describe('Server Error Handling', () => {
    it('should handle server errors with appropriate user feedback', async () => {
      const TestServerErrorComponent = () => {
        const [data, setData] = React.useState(null);
        const [error, setError] = React.useState<string | null>(null);
        const [loading, setLoading] = React.useState(false);

        const fetchData = async () => {
          setLoading(true);
          setError(null);
          
          try {
            const response = await apiClient.get('/data');
            if (response.success) {
              setData(response.data);
            } else {
              setError(response.error?.message || 'Server error occurred');
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
          } finally {
            setLoading(false);
          }
        };

        return (
          <div>
            <button onClick={fetchData} data-testid="fetch-data">
              Fetch Data
            </button>
            {loading && <div data-testid="loading">Loading...</div>}
            {error && <ErrorDisplay error={error} onRetry={fetchData} />}
            {data && <div data-testid="data">Data loaded</div>}
          </div>
        );
      };

      // Step 1: Server returns 500 error
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      render(<TestServerErrorComponent />);

      // Step 2: User attempts to fetch data
      const fetchButton = screen.getByTestId('fetch-data');
      fireEvent.click(fetchButton);

      // Step 3: Should show error with retry option
      await waitFor(() => {
        expect(screen.getByTestId('error-display')).toBeInTheDocument();
        expect(screen.getByTestId('error-retry')).toBeInTheDocument();
      });

      // Step 4: Server recovers
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { message: 'success' } })
      });

      // Step 5: User retries
      const retryButton = screen.getByTestId('error-retry');
      fireEvent.click(retryButton);

      // Step 6: Should show success
      await waitFor(() => {
        expect(screen.getByTestId('data')).toBeInTheDocument();
      });
    });

    it('should handle different types of server errors appropriately', async () => {
      // Test 400 Bad Request
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });

      let response = await apiClient.post('/invalid-data', { invalid: true });
      expect(response.success).toBe(false);
      expect(response.error?.message).toContain('HTTP 400');

      // Test 403 Forbidden
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden'
      });

      response = await apiClient.get('/forbidden');
      expect(response.success).toBe(false);
      expect(response.error?.message).toContain('HTTP 403');

      // Test 404 Not Found
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      response = await apiClient.get('/nonexistent');
      expect(response.success).toBe(false);
      expect(response.error?.message).toContain('HTTP 404');
    });
  });

  describe('Circuit Breaker Error Handling', () => {
    it('should handle circuit breaker activation gracefully', async () => {
      const TestCircuitBreakerComponent = () => {
        const [status, setStatus] = React.useState<string>('normal');
        const [error, setError] = React.useState<string | null>(null);

        const makeRequest = async () => {
          setError(null);
          try {
            const response = await apiClient.get('/test');
            if (response.success) {
              setStatus('success');
            } else {
              setError(response.error?.message || 'Request failed');
              if (response.error?.message?.includes('Circuit breaker')) {
                setStatus('circuit-open');
              }
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
          }
        };

        return (
          <div>
            <div data-testid="status">{status}</div>
            <button onClick={makeRequest} data-testid="make-request">
              Make Request
            </button>
            {error && <ErrorDisplay error={error} />}
          </div>
        );
      };

      // Step 1: Cause multiple failures to open circuit breaker
      const networkError = new Error('Connection refused');
      (networkError as any).code = 'ERR_CONNECTION_REFUSED';
      (global.fetch as jest.Mock).mockRejectedValue(networkError);

      render(<TestCircuitBreakerComponent />);

      // Step 2: Make multiple requests to trigger circuit breaker
      const requestButton = screen.getByTestId('make-request');
      
      for (let i = 0; i < 10; i++) {
        fireEvent.click(requestButton);
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Step 3: Circuit breaker should be open
      await waitFor(() => {
        expect(screen.getByTestId('status')).toHaveTextContent('circuit-open');
      });

      // Step 4: Subsequent requests should fail fast
      fireEvent.click(requestButton);

      await waitFor(() => {
        expect(screen.getByTestId('error-display')).toBeInTheDocument();
        expect(screen.getByTestId('error-message')).toHaveTextContent('Circuit breaker');
      });
    });

    it('should handle circuit breaker recovery', async () => {
      jest.useFakeTimers();

      // Step 1: Open circuit breaker
      const networkError = new Error('Connection refused');
      (networkError as any).code = 'ERR_CONNECTION_REFUSED';
      (global.fetch as jest.Mock).mockRejectedValue(networkError);

      for (let i = 0; i < 10; i++) {
        try {
          await apiClient.get('/test');
        } catch (error) {
          // Expected to fail
        }
      }

      expect(apiCircuitBreaker.getState()).toBe('OPEN');

      // Step 2: Wait for recovery timeout
      jest.advanceTimersByTime(125000); // 2+ minutes

      // Step 3: Service recovers
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { status: 'recovered' } })
      });

      // Step 4: Circuit breaker should allow requests and close
      const response = await apiClient.get('/test');

      expect(response.success).toBe(true);
      expect(apiCircuitBreaker.getState()).toBe('CLOSED');

      jest.useRealTimers();
    });
  });

  describe('Security Monitoring Error Handling', () => {
    it('should handle security monitoring service failures', async () => {
      // Mock security monitoring API
      jest.mock('../../lib/securityMonitoringApi', () => ({
        __esModule: true,
        default: {
          getSecurityMetrics: jest.fn(),
          getThreatAlerts: jest.fn()
        }
      }));

      const { result } = renderHook(() => useSecurityMonitoring());

      // Step 1: Security monitoring service fails
      const SecurityMonitoringApi = require('../../lib/securityMonitoringApi').default;
      SecurityMonitoringApi.getSecurityMetrics.mockRejectedValue(new Error('Security service unavailable'));
      SecurityMonitoringApi.getThreatAlerts.mockRejectedValue(new Error('Security service unavailable'));

      // Step 2: Hook should handle error gracefully
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe('Security service unavailable');
        expect(result.current.metrics).toBe(null);
      });

      // Step 3: User should be able to retry
      SecurityMonitoringApi.getSecurityMetrics.mockResolvedValue({
        failedLogins: 0,
        threatAlerts: 0,
        blockedRequests: 0
      });
      SecurityMonitoringApi.getThreatAlerts.mockResolvedValue({ alerts: [] });

      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.error).toBe(null);
        expect(result.current.metrics).not.toBe(null);
      });
    });
  });

  describe('Graceful Degradation Scenarios', () => {
    it('should provide offline functionality when possible', async () => {
      const TestOfflineComponent = () => {
        const { status } = useConnectionStatus();
        const [offlineData, setOfflineData] = React.useState(null);

        React.useEffect(() => {
          // Simulate loading cached data when offline
          if (!status.isConnected) {
            const cached = localStorage.getItem('cached-data');
            if (cached) {
              setOfflineData(JSON.parse(cached));
            }
          }
        }, [status.isConnected]);

        return (
          <GracefulDegradation 
            isOnline={status.isConnected}
            fallback={
              <div data-testid="offline-mode">
                <div>Offline Mode</div>
                {offlineData && <div data-testid="cached-data">Cached Data Available</div>}
              </div>
            }
          >
            <div data-testid="online-mode">Online Mode</div>
          </GracefulDegradation>
        );
      };

      // Step 1: Setup cached data
      localStorageMock.getItem.mockReturnValue(JSON.stringify({ cached: true }));

      // Step 2: Start offline
      const networkError = new Error('Network unavailable');
      (global.fetch as jest.Mock).mockRejectedValue(networkError);

      render(<TestOfflineComponent />);

      // Step 3: Should show offline mode with cached data
      await waitFor(() => {
        expect(screen.getByTestId('offline-mode')).toBeInTheDocument();
        expect(screen.getByTestId('cached-data')).toBeInTheDocument();
      });

      // Step 4: Come back online
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { status: 'healthy' } })
      });

      // Simulate connection recovery
      const onlineEvent = new Event('online');
      window.dispatchEvent(onlineEvent);

      await waitFor(() => {
        expect(screen.getByTestId('online-mode')).toBeInTheDocument();
      });
    });

    it('should handle partial service degradation', async () => {
      const TestPartialDegradationComponent = () => {
        const [coreFeatures, setCoreFeatures] = React.useState(true);
        const [advancedFeatures, setAdvancedFeatures] = React.useState(true);
        const [error, setError] = React.useState<string | null>(null);

        const testCoreFeatures = async () => {
          try {
            const response = await apiClient.get('/core');
            setCoreFeatures(response.success);
          } catch (err) {
            setCoreFeatures(false);
          }
        };

        const testAdvancedFeatures = async () => {
          try {
            const response = await apiClient.get('/advanced');
            setAdvancedFeatures(response.success);
          } catch (err) {
            setAdvancedFeatures(false);
            setError('Advanced features temporarily unavailable');
          }
        };

        React.useEffect(() => {
          testCoreFeatures();
          testAdvancedFeatures();
        }, []);

        return (
          <div>
            <div data-testid="core-features" data-available={coreFeatures}>
              Core Features
            </div>
            <div data-testid="advanced-features" data-available={advancedFeatures}>
              Advanced Features
            </div>
            {error && <div data-testid="degradation-notice">{error}</div>}
          </div>
        );
      };

      // Step 1: Core features work, advanced features fail
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true })
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable'
        });

      render(<TestPartialDegradationComponent />);

      // Step 2: Should show partial degradation
      await waitFor(() => {
        expect(screen.getByTestId('core-features')).toHaveAttribute('data-available', 'true');
        expect(screen.getByTestId('advanced-features')).toHaveAttribute('data-available', 'false');
        expect(screen.getByTestId('degradation-notice')).toBeInTheDocument();
      });
    });
  });

  describe('User Experience During Errors', () => {
    it('should provide clear error messages and recovery options', async () => {
      const TestUserExperienceComponent = () => {
        const [error, setError] = React.useState<string | null>(null);
        const [loading, setLoading] = React.useState(false);

        const performAction = async () => {
          setLoading(true);
          setError(null);

          try {
            const response = await apiClient.post('/action', { data: 'test' });
            if (!response.success) {
              setError(response.error?.message || 'Action failed');
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
          } finally {
            setLoading(false);
          }
        };

        return (
          <div>
            <button 
              onClick={performAction} 
              disabled={loading}
              data-testid="perform-action"
            >
              {loading ? 'Processing...' : 'Perform Action'}
            </button>
            {error && (
              <ErrorDisplay 
                error={error} 
                onRetry={() => {
                  setError(null);
                  performAction();
                }}
              />
            )}
          </div>
        );
      };

      // Step 1: Action fails with clear error
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 422,
        json: () => Promise.resolve({
          success: false,
          error: {
            message: 'Validation failed: Data is required',
            code: 'VALIDATION_ERROR'
          }
        })
      });

      render(<TestUserExperienceComponent />);

      // Step 2: User performs action
      const actionButton = screen.getByTestId('perform-action');
      fireEvent.click(actionButton);

      // Step 3: Should show clear error with retry option
      await waitFor(() => {
        expect(screen.getByTestId('error-display')).toBeInTheDocument();
        expect(screen.getByTestId('error-message')).toHaveTextContent('HTTP 422');
        expect(screen.getByTestId('error-retry')).toBeInTheDocument();
      });

      // Step 4: User can retry
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { message: 'Success' } })
      });

      const retryButton = screen.getByTestId('error-retry');
      fireEvent.click(retryButton);

      // Step 5: Error should clear
      await waitFor(() => {
        expect(screen.queryByTestId('error-display')).not.toBeInTheDocument();
      });
    });
  });
});