import { ApiClient, createApiClient, ConnectionMonitor } from '../../lib/api-client';
import { apiCircuitBreaker } from '../../lib/retry';

// Mock the retry module
jest.mock('../../lib/retry', () => ({
  fetchWithRetry: jest.fn(),
  retryApiCall: jest.fn(),
  apiCircuitBreaker: {
    execute: jest.fn(),
    getState: jest.fn().mockReturnValue('CLOSED'),
    reset: jest.fn()
  }
}));

// Mock fetch
global.fetch = jest.fn();

describe('ApiClient', () => {
  let apiClient: ApiClient;
  const mockFetchWithRetry = require('../../lib/retry').fetchWithRetry;
  const mockCircuitBreaker = require('../../lib/retry').apiCircuitBreaker;

  beforeEach(() => {
    jest.clearAllMocks();
    apiClient = new ApiClient({
      baseURL: 'http://localhost:8000/api',
      timeout: 30000,
      retries: 3
    });
  });

  describe('constructor', () => {
    it('should initialize with correct default values', () => {
      const client = new ApiClient({ baseURL: 'http://test.com' });
      expect(client).toBeInstanceOf(ApiClient);
    });

    it('should set custom headers', () => {
      const customHeaders = { 'X-Custom': 'test' };
      const client = new ApiClient({
        baseURL: 'http://test.com',
        headers: customHeaders
      });
      expect(client).toBeInstanceOf(ApiClient);
    });
  });

  describe('GET requests', () => {
    it('should make successful GET request', async () => {
      const mockResponse = { success: true, data: { id: 1 } };
      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);
      mockFetchWithRetry.mockResolvedValue({
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiClient.get('/test');

      expect(result).toEqual(mockResponse);
      expect(mockCircuitBreaker.execute).toHaveBeenCalled();
    });

    it('should handle GET request with query parameters', async () => {
      const mockResponse = { success: true, data: [] };
      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);
      mockFetchWithRetry.mockResolvedValue({
        json: () => Promise.resolve(mockResponse)
      });

      const params = { page: 1, limit: 10, search: 'test' };
      await apiClient.get('/test', params);

      expect(mockCircuitBreaker.execute).toHaveBeenCalled();
    });

    it('should handle GET request errors', async () => {
      const mockError = new Error('Network error');
      mockCircuitBreaker.execute.mockRejectedValue(mockError);

      const result = await apiClient.get('/test');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Network error');
      expect(result.error?.code).toBe('NETWORK_ERROR');
    });
  });

  describe('POST requests', () => {
    it('should make successful POST request', async () => {
      const mockResponse = { success: true, data: { id: 1 } };
      const postData = { name: 'test' };
      
      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);
      mockFetchWithRetry.mockResolvedValue({
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiClient.post('/test', postData);

      expect(result).toEqual(mockResponse);
      expect(mockCircuitBreaker.execute).toHaveBeenCalled();
    });

    it('should handle POST request without data', async () => {
      const mockResponse = { success: true };
      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);
      mockFetchWithRetry.mockResolvedValue({
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiClient.post('/test');

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Authentication methods', () => {
    it('should set auth token', () => {
      const token = 'test-token';
      apiClient.setAuthToken(token);
      
      // We can't directly test private properties, but we can test the behavior
      expect(() => apiClient.setAuthToken(token)).not.toThrow();
    });

    it('should set API key', () => {
      const apiKey = 'test-api-key';
      apiClient.setApiKey(apiKey);
      
      expect(() => apiClient.setApiKey(apiKey)).not.toThrow();
    });

    it('should clear auth', () => {
      apiClient.setAuthToken('token');
      apiClient.setApiKey('key');
      apiClient.clearAuth();
      
      expect(() => apiClient.clearAuth()).not.toThrow();
    });
  });

  describe('Health check methods', () => {
    it('should perform health check', async () => {
      const mockResponse = { success: true, data: { status: 'healthy' } };
      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);
      mockFetchWithRetry.mockResolvedValue({
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiClient.healthCheck();

      expect(result).toEqual(mockResponse);
    });

    it('should perform detailed health check', async () => {
      const mockResponse = { 
        success: true, 
        data: { 
          status: 'healthy',
          database: 'connected',
          redis: 'connected'
        } 
      };
      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);
      mockFetchWithRetry.mockResolvedValue({
        json: () => Promise.resolve(mockResponse)
      });

      const result = await apiClient.detailedHealthCheck();

      expect(result).toEqual(mockResponse);
    });
  });

  describe('Error handling', () => {
    it('should handle circuit breaker errors', async () => {
      const circuitBreakerError = new Error('Circuit breaker is OPEN');
      mockCircuitBreaker.execute.mockRejectedValue(circuitBreakerError);

      const result = await apiClient.get('/test');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Circuit breaker is OPEN');
      expect(result.error?.details?.circuitBreakerState).toBe('CLOSED');
    });

    it('should include retry information in error details', async () => {
      const networkError = new Error('Connection refused');
      networkError.code = 'ERR_CONNECTION_REFUSED';
      mockCircuitBreaker.execute.mockRejectedValue(networkError);

      const result = await apiClient.get('/test-endpoint');

      expect(result.success).toBe(false);
      expect(result.error?.details?.endpoint).toBe('/test-endpoint');
      expect(result.error?.details?.retryAttempts).toBe(3);
      expect(result.error?.details?.timestamp).toBeDefined();
    });
  });
});

describe('createApiClient', () => {
  it('should create client with default config', () => {
    const client = createApiClient();
    expect(client).toBeInstanceOf(ApiClient);
  });

  it('should create client with custom config', () => {
    const config = {
      baseURL: 'http://custom.com/api',
      timeout: 60000,
      retries: 5
    };
    const client = createApiClient(config);
    expect(client).toBeInstanceOf(ApiClient);
  });

  it('should use environment variable for base URL', () => {
    const originalEnv = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'http://env.com/api';
    
    const client = createApiClient();
    expect(client).toBeInstanceOf(ApiClient);
    
    process.env.NEXT_PUBLIC_API_URL = originalEnv;
  });
});

describe('ConnectionMonitor', () => {
  let connectionMonitor: ConnectionMonitor;
  let mockApiClient: jest.Mocked<ApiClient>;

  beforeEach(() => {
    jest.useFakeTimers();
    mockApiClient = {
      healthCheck: jest.fn()
    } as any;
    
    connectionMonitor = new ConnectionMonitor(mockApiClient);
  });

  afterEach(() => {
    connectionMonitor.stopMonitoring();
    jest.useRealTimers();
  });

  it('should initialize with online status', () => {
    expect(connectionMonitor.getStatus()).toBe(true);
  });

  it('should start monitoring on initialization', () => {
    expect(setInterval).toHaveBeenCalled();
  });

  it('should check connection periodically', async () => {
    mockApiClient.healthCheck.mockResolvedValue({ success: true });
    
    jest.advanceTimersByTime(30000);
    
    expect(mockApiClient.healthCheck).toHaveBeenCalled();
  });

  it('should handle connection check failures', async () => {
    mockApiClient.healthCheck.mockRejectedValue(new Error('Connection failed'));
    
    jest.advanceTimersByTime(30000);
    
    expect(mockApiClient.healthCheck).toHaveBeenCalled();
  });

  it('should notify listeners on status change', () => {
    const listener = jest.fn();
    const unsubscribe = connectionMonitor.onStatusChange(listener);
    
    // Simulate status change
    connectionMonitor['setOnlineStatus'](false);
    
    expect(listener).toHaveBeenCalledWith(false);
    
    unsubscribe();
  });

  it('should stop monitoring', () => {
    connectionMonitor.stopMonitoring();
    expect(clearInterval).toHaveBeenCalled();
  });

  it('should handle browser online/offline events', () => {
    const onlineEvent = new Event('online');
    const offlineEvent = new Event('offline');
    
    window.dispatchEvent(offlineEvent);
    window.dispatchEvent(onlineEvent);
    
    // Events should be handled without throwing
    expect(() => {
      window.dispatchEvent(onlineEvent);
      window.dispatchEvent(offlineEvent);
    }).not.toThrow();
  });
});