import { apiClient, createApiClient, connectionMonitor } from '../../lib/api-client';
import { apiCircuitBreaker } from '../../lib/retry';

// Mock fetch for integration tests
global.fetch = jest.fn();

describe('API Connectivity Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    apiCircuitBreaker.reset();
  });

  describe('Frontend-Backend API Connection', () => {
    it('should successfully connect to backend health endpoint', async () => {
      const mockHealthResponse = {
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          services: {
            database: 'connected',
            redis: 'connected'
          }
        }
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockHealthResponse)
      });

      const response = await apiClient.healthCheck();

      expect(response.success).toBe(true);
      expect(response.data.status).toBe('healthy');
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/health',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle backend connection failures gracefully', async () => {
      const connectionError = new Error('Connection refused');
      (connectionError as any).code = 'ERR_CONNECTION_REFUSED';

      (global.fetch as jest.Mock).mockRejectedValue(connectionError);

      const response = await apiClient.healthCheck();

      expect(response.success).toBe(false);
      expect(response.error?.code).toBe('NETWORK_ERROR');
      expect(response.error?.details?.endpoint).toBe('/health');
    });

    it('should retry failed requests with exponential backoff', async () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'ERR_CONNECTION_REFUSED';

      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { status: 'healthy' } })
        });

      const response = await apiClient.healthCheck();

      expect(response.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle HTTP error responses correctly', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({
          success: false,
          error: { message: 'Database connection failed' }
        })
      });

      const response = await apiClient.get('/test-endpoint');

      expect(response.success).toBe(false);
      expect(response.error?.message).toContain('HTTP 500');
    });

    it('should maintain authentication state across requests', async () => {
      const token = 'test-jwt-token';
      apiClient.setAuthToken(token);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { authenticated: true } })
      });

      await apiClient.get('/protected-endpoint');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${token}`
          })
        })
      );
    });

    it('should handle API key authentication', async () => {
      const apiKey = 'test-api-key';
      apiClient.setApiKey(apiKey);

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { authenticated: true } })
      });

      await apiClient.get('/api-endpoint');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-API-Key': apiKey
          })
        })
      );
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should open circuit breaker after multiple failures', async () => {
      const networkError = new Error('Connection refused');
      (networkError as any).code = 'ERR_CONNECTION_REFUSED';

      (global.fetch as jest.Mock).mockRejectedValue(networkError);

      // Trigger enough failures to open circuit breaker
      for (let i = 0; i < 10; i++) {
        try {
          await apiClient.get('/test');
        } catch (error) {
          // Expected to fail
        }
      }

      expect(apiCircuitBreaker.getState()).toBe('OPEN');
    });

    it('should reject requests immediately when circuit breaker is open', async () => {
      const networkError = new Error('Connection refused');
      (networkError as any).code = 'ERR_CONNECTION_REFUSED';

      (global.fetch as jest.Mock).mockRejectedValue(networkError);

      // Open circuit breaker
      for (let i = 0; i < 10; i++) {
        try {
          await apiClient.get('/test');
        } catch (error) {
          // Expected to fail
        }
      }

      // Next request should be rejected immediately
      const start = Date.now();
      const response = await apiClient.get('/test');
      const duration = Date.now() - start;

      expect(response.success).toBe(false);
      expect(response.error?.message).toContain('Circuit breaker is OPEN');
      expect(duration).toBeLessThan(100); // Should fail fast
    });

    it('should transition to half-open and recover', async () => {
      jest.useFakeTimers();
      
      const networkError = new Error('Connection refused');
      (networkError as any).code = 'ERR_CONNECTION_REFUSED';

      (global.fetch as jest.Mock).mockRejectedValue(networkError);

      // Open circuit breaker
      for (let i = 0; i < 10; i++) {
        try {
          await apiClient.get('/test');
        } catch (error) {
          // Expected to fail
        }
      }

      expect(apiCircuitBreaker.getState()).toBe('OPEN');

      // Fast-forward past recovery timeout
      jest.advanceTimersByTime(125000); // 2+ minutes

      // Mock successful response for recovery
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { status: 'recovered' } })
      });

      const response = await apiClient.get('/test');

      expect(response.success).toBe(true);
      expect(apiCircuitBreaker.getState()).toBe('CLOSED');

      jest.useRealTimers();
    });
  });

  describe('Connection Monitoring Integration', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      connectionMonitor.stopMonitoring();
      jest.useRealTimers();
    });

    it('should monitor connection status periodically', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { status: 'healthy' } })
      });

      const statusChanges: boolean[] = [];
      connectionMonitor.onStatusChange((online) => {
        statusChanges.push(online);
      });

      // Fast-forward to trigger connection check
      jest.advanceTimersByTime(30000);
      await Promise.resolve(); // Allow async operations

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.any(Object)
      );
    });

    it('should detect connection failures and notify listeners', async () => {
      const networkError = new Error('Network error');
      (global.fetch as jest.Mock).mockRejectedValue(networkError);

      const statusChanges: boolean[] = [];
      connectionMonitor.onStatusChange((online) => {
        statusChanges.push(online);
      });

      // Fast-forward to trigger connection check
      jest.advanceTimersByTime(30000);
      await Promise.resolve();

      // Should detect offline status
      expect(statusChanges).toContain(false);
    });

    it('should handle browser online/offline events', () => {
      const statusChanges: boolean[] = [];
      connectionMonitor.onStatusChange((online) => {
        statusChanges.push(online);
      });

      // Simulate browser going offline
      const offlineEvent = new Event('offline');
      window.dispatchEvent(offlineEvent);

      // Simulate browser coming online
      const onlineEvent = new Event('online');
      window.dispatchEvent(onlineEvent);

      // Should handle events without throwing
      expect(() => {
        window.dispatchEvent(offlineEvent);
        window.dispatchEvent(onlineEvent);
      }).not.toThrow();
    });
  });

  describe('API Client Configuration', () => {
    it('should create client with environment-based configuration', () => {
      const originalEnv = process.env.NEXT_PUBLIC_API_URL;
      process.env.NEXT_PUBLIC_API_URL = 'http://custom-api.com/api';

      const client = createApiClient();

      expect(client).toBeInstanceOf(Object);
      
      process.env.NEXT_PUBLIC_API_URL = originalEnv;
    });

    it('should create client with custom configuration', () => {
      const customConfig = {
        baseURL: 'http://test-api.com/api',
        timeout: 60000,
        retries: 5,
        headers: {
          'X-Custom-Header': 'test-value'
        }
      };

      const client = createApiClient(customConfig);

      expect(client).toBeInstanceOf(Object);
    });

    it('should handle missing environment variables gracefully', () => {
      const originalEnv = process.env.NEXT_PUBLIC_API_URL;
      delete process.env.NEXT_PUBLIC_API_URL;

      const client = createApiClient();

      expect(client).toBeInstanceOf(Object);
      
      process.env.NEXT_PUBLIC_API_URL = originalEnv;
    });
  });

  describe('Request/Response Flow Integration', () => {
    it('should handle complete GET request flow', async () => {
      const mockData = { users: [{ id: 1, name: 'Test User' }] };
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: mockData })
      });

      const response = await apiClient.get('/users', { page: 1, limit: 10 });

      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockData);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/users?page=1&limit=10',
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    it('should handle complete POST request flow', async () => {
      const postData = { name: 'New User', email: 'user@example.com' };
      const responseData = { id: 1, ...postData };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, data: responseData })
      });

      const response = await apiClient.post('/users', postData);

      expect(response.success).toBe(true);
      expect(response.data).toEqual(responseData);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(postData)
        })
      );
    });

    it('should handle PUT, PATCH, and DELETE requests', async () => {
      const mockResponse = { success: true, data: { updated: true } };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      // Test PUT
      await apiClient.put('/users/1', { name: 'Updated User' });
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/users/1'),
        expect.objectContaining({ method: 'PUT' })
      );

      // Test PATCH
      await apiClient.patch('/users/1', { name: 'Patched User' });
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/users/1'),
        expect.objectContaining({ method: 'PATCH' })
      );

      // Test DELETE
      await apiClient.delete('/users/1');
      expect(global.fetch).toHaveBeenLastCalledWith(
        expect.stringContaining('/users/1'),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('Error Recovery Integration', () => {
    it('should recover from temporary network issues', async () => {
      const networkError = new Error('Temporary network error');
      (networkError as any).code = 'ERR_CONNECTION_REFUSED';

      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { recovered: true } })
        });

      const response = await apiClient.get('/test-recovery');

      expect(response.success).toBe(true);
      expect(response.data.recovered).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should handle server errors with retry logic', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error'
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          statusText: 'Bad Gateway'
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ success: true, data: { recovered: true } })
        });

      const response = await apiClient.get('/test-server-error');

      expect(response.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should not retry client errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request'
      });

      const response = await apiClient.get('/test-client-error');

      expect(response.success).toBe(false);
      expect(global.fetch).toHaveBeenCalledTimes(1); // No retries for client errors
    });
  });

  describe('Timeout Handling Integration', () => {
    it('should handle request timeouts', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => 
        new Promise((resolve) => {
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
          }), 35000); // Longer than timeout
        })
      );

      jest.useFakeTimers();
      
      const responsePromise = apiClient.get('/slow-endpoint');
      
      // Fast-forward past timeout
      jest.advanceTimersByTime(35000);
      
      const response = await responsePromise;

      expect(response.success).toBe(false);
      expect(response.error?.message).toContain('timeout');

      jest.useRealTimers();
    });
  });
});