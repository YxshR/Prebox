import {
  retryWithBackoff,
  retryApiCall,
  fetchWithRetry,
  CircuitBreaker,
  apiCircuitBreaker,
  getCircuitBreakerStatus,
  ErrorType
} from '../../lib/retry';

// Mock fetch
global.fetch = jest.fn();

describe('Retry Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const result = await retryWithBackoff(mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');

      const promise = retryWithBackoff(mockFn, { maxAttempts: 3 });
      
      // Fast-forward through delays
      jest.runAllTimers();
      
      const result = await promise;
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should fail after max attempts', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Persistent error'));
      
      const promise = retryWithBackoff(mockFn, { maxAttempts: 2 });
      
      jest.runAllTimers();
      
      await expect(promise).rejects.toThrow('Persistent error');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const clientError = new Error('Bad request');
      (clientError as any).response = { status: 400 };
      
      const mockFn = jest.fn().mockRejectedValue(clientError);
      
      await expect(retryWithBackoff(mockFn)).rejects.toThrow('Bad request');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry callback', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');
      
      const onRetry = jest.fn();
      
      const promise = retryWithBackoff(mockFn, { onRetry });
      
      jest.runAllTimers();
      
      await promise;
      
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
    });

    it('should respect custom retry condition', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Custom error'));
      const retryCondition = jest.fn().mockReturnValue(false);
      
      await expect(retryWithBackoff(mockFn, { retryCondition })).rejects.toThrow('Custom error');
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(retryCondition).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  describe('retryApiCall', () => {
    it('should retry network errors', async () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'ERR_CONNECTION_REFUSED';
      
      const mockFn = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');
      
      const promise = retryApiCall(mockFn);
      
      jest.runAllTimers();
      
      const result = await promise;
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should retry server errors', async () => {
      const serverError = new Error('Internal server error');
      (serverError as any).response = { status: 500 };
      
      const mockFn = jest.fn()
        .mockRejectedValueOnce(serverError)
        .mockResolvedValue('success');
      
      const promise = retryApiCall(mockFn);
      
      jest.runAllTimers();
      
      const result = await promise;
      
      expect(result).toBe('success');
    });

    it('should not retry authentication errors', async () => {
      const authError = new Error('Unauthorized');
      (authError as any).response = { status: 401 };
      
      const mockFn = jest.fn().mockRejectedValue(authError);
      
      await expect(retryApiCall(mockFn)).rejects.toThrow('Unauthorized');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry rate limit errors', async () => {
      const rateLimitError = new Error('Too many requests');
      (rateLimitError as any).response = { status: 429 };
      
      const mockFn = jest.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue('success');
      
      const promise = retryApiCall(mockFn);
      
      jest.runAllTimers();
      
      const result = await promise;
      
      expect(result).toBe('success');
    });
  });

  describe('fetchWithRetry', () => {
    it('should make successful fetch request', async () => {
      const mockResponse = { ok: true, json: () => Promise.resolve({ data: 'test' }) };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      const result = await fetchWithRetry('http://test.com');
      
      expect(result).toBe(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith('http://test.com', expect.any(Object));
    });

    it('should handle fetch timeout', async () => {
      (global.fetch as jest.Mock).mockImplementation(() => 
        new Promise((resolve) => {
          setTimeout(() => resolve({ ok: true }), 35000); // Longer than timeout
        })
      );
      
      const promise = fetchWithRetry('http://test.com');
      
      // Fast-forward past timeout
      jest.advanceTimersByTime(35000);
      
      await expect(promise).rejects.toThrow();
    });

    it('should handle non-ok responses', async () => {
      const mockResponse = { 
        ok: false, 
        status: 404, 
        statusText: 'Not Found' 
      };
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      const promise = fetchWithRetry('http://test.com');
      
      jest.runAllTimers();
      
      await expect(promise).rejects.toThrow('HTTP 404: Not Found');
    });

    it('should handle network errors', async () => {
      const networkError = new TypeError('Failed to fetch');
      (global.fetch as jest.Mock).mockRejectedValue(networkError);
      
      const promise = fetchWithRetry('http://test.com');
      
      jest.runAllTimers();
      
      await expect(promise).rejects.toThrow('Network error');
    });
  });

  describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;

    beforeEach(() => {
      circuitBreaker = new CircuitBreaker(3, 5000, 'Test');
    });

    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });

    it('should execute function successfully', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(mockFn);
      
      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });

    it('should open after failure threshold', async () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'ERR_CONNECTION_REFUSED';
      
      const mockFn = jest.fn().mockRejectedValue(networkError);
      
      // Trigger failures to reach threshold
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected to fail
        }
      }
      
      expect(circuitBreaker.getState()).toBe('OPEN');
    });

    it('should reject calls when OPEN', async () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'ERR_CONNECTION_REFUSED';
      
      const mockFn = jest.fn().mockRejectedValue(networkError);
      
      // Open the circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected to fail
        }
      }
      
      // Should reject immediately when open
      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Circuit breaker is OPEN');
    });

    it('should transition to HALF_OPEN after recovery timeout', async () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'ERR_CONNECTION_REFUSED';
      
      const mockFn = jest.fn().mockRejectedValue(networkError);
      
      // Open the circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected to fail
        }
      }
      
      // Fast-forward past recovery timeout
      jest.advanceTimersByTime(6000);
      
      // Next call should transition to HALF_OPEN
      mockFn.mockResolvedValueOnce('success');
      const result = await circuitBreaker.execute(mockFn);
      
      expect(result).toBe('success');
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });

    it('should not count client errors as failures', async () => {
      const clientError = new Error('Bad request');
      (clientError as any).response = { status: 400 };
      
      const mockFn = jest.fn().mockRejectedValue(clientError);
      
      // Try multiple times - should not open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected to fail
        }
      }
      
      expect(circuitBreaker.getState()).toBe('CLOSED');
      expect(circuitBreaker.getFailureCount()).toBe(0);
    });

    it('should reset failure count on success', async () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'ERR_CONNECTION_REFUSED';
      
      const mockFn = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');
      
      // Fail twice
      for (let i = 0; i < 2; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected to fail
        }
      }
      
      expect(circuitBreaker.getFailureCount()).toBe(2);
      
      // Succeed
      await circuitBreaker.execute(mockFn);
      
      expect(circuitBreaker.getFailureCount()).toBe(0);
    });

    it('should provide time until recovery', () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'ERR_CONNECTION_REFUSED';
      
      const mockFn = jest.fn().mockRejectedValue(networkError);
      
      // Open the circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected to fail
        }
      }
      
      const timeUntilRecovery = circuitBreaker.getTimeUntilRecovery();
      expect(timeUntilRecovery).toBeGreaterThan(0);
      expect(timeUntilRecovery).toBeLessThanOrEqual(5000);
    });

    it('should reset manually', async () => {
      const networkError = new Error('Network error');
      (networkError as any).code = 'ERR_CONNECTION_REFUSED';
      
      const mockFn = jest.fn().mockRejectedValue(networkError);
      
      // Open the circuit breaker
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(mockFn);
        } catch (error) {
          // Expected to fail
        }
      }
      
      expect(circuitBreaker.getState()).toBe('OPEN');
      
      circuitBreaker.reset();
      
      expect(circuitBreaker.getState()).toBe('CLOSED');
      expect(circuitBreaker.getFailureCount()).toBe(0);
    });
  });

  describe('getCircuitBreakerStatus', () => {
    it('should return circuit breaker status', () => {
      const status = getCircuitBreakerStatus();
      
      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('failureCount');
      expect(status).toHaveProperty('timeUntilRecovery');
      expect(status).toHaveProperty('isHealthy');
      expect(typeof status.isHealthy).toBe('boolean');
    });
  });
});