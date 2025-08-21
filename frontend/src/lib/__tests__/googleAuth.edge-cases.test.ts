/**
 * Additional Google OAuth Service Tests - Edge Cases and Error Scenarios
 * Requirements: 2.4, 2.5
 */

import { GoogleOAuthService } from '../googleAuth';
import { secureApiClient } from '../secureApiClient';
import { SecurityLogger } from '../security';

// Mock dependencies
jest.mock('../secureApiClient', () => ({
  secureApiClient: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

jest.mock('../security', () => ({
  SecurityLogger: {
    log: jest.fn(),
  },
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

describe('GoogleOAuthService - Edge Cases and Error Scenarios', () => {
  let service: GoogleOAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.setItem.mockClear();
    
    // Reset environment variables
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000/api';
    
    service = new GoogleOAuthService();
  });

  describe('Network and Connectivity Edge Cases', () => {
    it('handles network timeout during callback', async () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.name = 'TimeoutError';
      (secureApiClient.post as jest.Mock).mockRejectedValue(timeoutError);

      const result = await service.handleCallback('test-code');

      expect(result).toEqual({
        success: false,
        error: 'Network timeout',
      });

      expect(SecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_ERROR',
        'Google OAuth authentication error',
        { error: 'Network timeout' }
      );
    });

    it('handles DNS resolution failures', async () => {
      const dnsError = new Error('getaddrinfo ENOTFOUND api.example.com');
      (secureApiClient.post as jest.Mock).mockRejectedValue(dnsError);

      const result = await service.handleCallback('test-code');

      expect(result).toEqual({
        success: false,
        error: 'getaddrinfo ENOTFOUND api.example.com',
      });
    });

    it('handles connection refused errors', async () => {
      const connectionError = new Error('connect ECONNREFUSED 127.0.0.1:8000');
      (secureApiClient.post as jest.Mock).mockRejectedValue(connectionError);

      const result = await service.handleCallback('test-code');

      expect(result).toEqual({
        success: false,
        error: 'connect ECONNREFUSED 127.0.0.1:8000',
      });
    });

    it('handles SSL certificate errors', async () => {
      const sslError = new Error('certificate verify failed');
      (secureApiClient.post as jest.Mock).mockRejectedValue(sslError);

      const result = await service.handleCallback('test-code');

      expect(result).toEqual({
        success: false,
        error: 'certificate verify failed',
      });
    });
  });

  describe('API Response Edge Cases', () => {
    it('handles malformed JSON responses', async () => {
      const malformedResponse = {
        success: true,
        data: 'invalid-json-string',
      };
      (secureApiClient.post as jest.Mock).mockResolvedValue(malformedResponse);

      const result = await service.handleCallback('test-code');

      expect(result).toEqual({
        success: true,
        user: undefined,
      });
    });

    it('handles responses with missing required fields', async () => {
      const incompleteResponse = {
        success: true,
        data: {
          // Missing user field
          accessToken: 'token-123',
        },
      };
      (secureApiClient.post as jest.Mock).mockResolvedValue(incompleteResponse);

      const result = await service.handleCallback('test-code');

      expect(result).toEqual({
        success: true,
        user: undefined,
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('accessToken', 'token-123');
    });

    it('handles responses with null values', async () => {
      const nullResponse = {
        success: true,
        data: {
          accessToken: null,
          refreshToken: null,
          user: null,
        },
      };
      (secureApiClient.post as jest.Mock).mockResolvedValue(nullResponse);

      const result = await service.handleCallback('test-code');

      expect(result).toEqual({
        success: true,
        user: null,
      });

      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('handles extremely large response payloads', async () => {
      const largeData = 'x'.repeat(1000000); // 1MB string
      const largeResponse = {
        success: true,
        data: {
          accessToken: largeData,
          refreshToken: largeData,
          user: {
            id: 'user-123',
            name: largeData,
            email: 'user@example.com',
          },
        },
      };
      (secureApiClient.post as jest.Mock).mockResolvedValue(largeResponse);

      const result = await service.handleCallback('test-code');

      expect(result.success).toBe(true);
      expect(result.user?.name).toBe(largeData);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('accessToken', largeData);
    });
  });

  describe('Security Edge Cases', () => {
    it('handles authorization codes with special characters', async () => {
      const specialCode = 'code-with-!@#$%^&*()_+-=[]{}|;:,.<>?';
      const mockResponse = {
        success: true,
        data: {
          accessToken: 'token-123',
          user: { id: 'user-123' },
        },
      };
      (secureApiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.handleCallback(specialCode);

      expect(result.success).toBe(true);
      expect(secureApiClient.post).toHaveBeenCalledWith('/auth/google/callback', {
        code: specialCode,
        redirectUri: 'http://localhost:3000/auth/google/callback',
      });
    });

    it('handles extremely long authorization codes', async () => {
      const longCode = 'a'.repeat(10000);
      const mockResponse = {
        success: true,
        data: {
          accessToken: 'token-123',
          user: { id: 'user-123' },
        },
      };
      (secureApiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.handleCallback(longCode);

      expect(result.success).toBe(true);
      expect(secureApiClient.post).toHaveBeenCalledWith('/auth/google/callback', {
        code: longCode,
        redirectUri: 'http://localhost:3000/auth/google/callback',
      });
    });

    it('handles potential XSS in user data', async () => {
      const xssPayload = '<script>alert("xss")</script>';
      const mockResponse = {
        success: true,
        data: {
          accessToken: 'token-123',
          user: {
            id: 'user-123',
            name: xssPayload,
            email: 'user@example.com',
          },
        },
      };
      (secureApiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.handleCallback('test-code');

      expect(result.success).toBe(true);
      expect(result.user?.name).toBe(xssPayload);
      // The service should return the data as-is; sanitization happens at the UI level
    });

    it('handles SQL injection attempts in authorization codes', async () => {
      const sqlInjection = "'; DROP TABLE users; --";
      const mockResponse = {
        success: false,
        error: {
          message: 'Invalid authorization code',
          code: 'INVALID_CODE',
        },
      };
      (secureApiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.handleCallback(sqlInjection);

      expect(result).toEqual({
        success: false,
        error: 'Invalid authorization code',
      });
    });
  });

  describe('Browser Compatibility Edge Cases', () => {
    it('handles missing localStorage', async () => {
      // Mock localStorage to be undefined
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        writable: true,
      });

      const mockResponse = {
        success: true,
        data: {
          accessToken: 'token-123',
          refreshToken: 'refresh-123',
          user: { id: 'user-123' },
        },
      };
      (secureApiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.handleCallback('test-code');

      expect(result.success).toBe(true);
      // Should not throw error even without localStorage

      // Restore localStorage
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });
    });

    it('handles localStorage quota exceeded', async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      const mockResponse = {
        success: true,
        data: {
          accessToken: 'token-123',
          refreshToken: 'refresh-123',
          user: { id: 'user-123' },
        },
      };
      (secureApiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.handleCallback('test-code');

      expect(result.success).toBe(true);
      expect(result.user).toEqual({ id: 'user-123' });
      // Should handle localStorage errors gracefully
    });

    it('handles disabled cookies/storage', async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('Storage disabled');
      });

      const mockResponse = {
        success: true,
        data: {
          accessToken: 'token-123',
          user: { id: 'user-123' },
        },
      };
      (secureApiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.handleCallback('test-code');

      expect(result.success).toBe(true);
    });
  });

  describe('Configuration Edge Cases', () => {
    it('handles missing environment variables gracefully', async () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.NEXT_PUBLIC_API_URL;

      const newService = new GoogleOAuthService();

      expect(newService.isConfigured()).toBe(false);
      expect(() => newService.initiateLogin()).toThrow(
        'Google OAuth is not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID environment variable.'
      );
    });

    it('handles malformed environment variables', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'not-a-valid-url';
      process.env.NEXT_PUBLIC_API_URL = 'also-not-valid';

      const newService = new GoogleOAuthService();
      const config = newService.getConfigStatus();

      expect(config.redirectUri).toBe('not-a-valid-url/auth/google/callback');
    });

    it('handles empty string environment variables', async () => {
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = '';
      process.env.NEXT_PUBLIC_APP_URL = '';
      process.env.NEXT_PUBLIC_API_URL = '';

      const newService = new GoogleOAuthService();

      expect(newService.isConfigured()).toBe(false);
      expect(newService.getConfigStatus().redirectUri).toBe('http://localhost:3000/auth/google/callback');
    });
  });

  describe('Rate Limiting and Throttling', () => {
    it('handles rate limiting errors from API', async () => {
      const rateLimitError = {
        success: false,
        error: {
          message: 'Rate limit exceeded',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: 60,
        },
      };
      (secureApiClient.post as jest.Mock).mockResolvedValue(rateLimitError);

      const result = await service.handleCallback('test-code');

      expect(result).toEqual({
        success: false,
        error: 'Rate limit exceeded',
      });

      expect(SecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_FAILED',
        'Google OAuth authentication failed',
        { error: rateLimitError.error }
      );
    });

    it('handles concurrent callback requests', async () => {
      const mockResponse = {
        success: true,
        data: {
          accessToken: 'token-123',
          user: { id: 'user-123' },
        },
      };
      (secureApiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      // Make multiple concurrent requests
      const promises = Array.from({ length: 5 }, () => 
        service.handleCallback('test-code')
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // API should be called for each request
      expect(secureApiClient.post).toHaveBeenCalledTimes(5);
    });
  });

  describe('Profile Retrieval Edge Cases', () => {
    it('handles profile retrieval with invalid token', async () => {
      const errorResponse = {
        success: false,
        error: {
          message: 'Invalid or expired token',
          code: 'INVALID_TOKEN',
        },
      };
      (secureApiClient.get as jest.Mock).mockResolvedValue(errorResponse);

      await expect(service.getProfile('invalid-token')).rejects.toThrow('Invalid or expired token');

      expect(SecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_PROFILE_ERROR',
        'Google profile request failed',
        { error: 'Invalid or expired token' }
      );
    });

    it('handles profile retrieval with network errors', async () => {
      const networkError = new Error('Network unreachable');
      (secureApiClient.get as jest.Mock).mockRejectedValue(networkError);

      await expect(service.getProfile('valid-token')).rejects.toThrow('Network unreachable');

      expect(SecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_PROFILE_ERROR',
        'Google profile request failed',
        { error: 'Network unreachable' }
      );
    });

    it('handles profile retrieval with malformed response', async () => {
      const malformedResponse = {
        success: true,
        data: null, // Unexpected null data
      };
      (secureApiClient.get as jest.Mock).mockResolvedValue(malformedResponse);

      const result = await service.getProfile('valid-token');

      expect(result).toBeNull();
      expect(SecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_PROFILE_SUCCESS',
        'Google profile retrieved successfully'
      );
    });

    it('handles profile retrieval with partial data', async () => {
      const partialResponse = {
        success: true,
        data: {
          id: 'user-123',
          // Missing name, email, picture
        },
      };
      (secureApiClient.get as jest.Mock).mockResolvedValue(partialResponse);

      const result = await service.getProfile('valid-token');

      expect(result).toEqual({
        id: 'user-123',
      });
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('handles memory pressure during token storage', async () => {
      let memoryPressureCount = 0;
      mockLocalStorage.setItem.mockImplementation(() => {
        memoryPressureCount++;
        if (memoryPressureCount <= 2) {
          throw new Error('Out of memory');
        }
      });

      const mockResponse = {
        success: true,
        data: {
          accessToken: 'token-123',
          refreshToken: 'refresh-123',
          user: { id: 'user-123' },
        },
      };
      (secureApiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.handleCallback('test-code');

      expect(result.success).toBe(true);
      // Should handle storage errors gracefully
    });

    it('handles high-frequency authentication attempts', async () => {
      const mockResponse = {
        success: true,
        data: {
          accessToken: 'token-123',
          user: { id: 'user-123' },
        },
      };
      (secureApiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const startTime = Date.now();
      
      // Make 100 rapid authentication attempts
      const promises = Array.from({ length: 100 }, (_, i) => 
        service.handleCallback(`code-${i}`)
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should complete within reasonable time (less than 5 seconds)
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });

  describe('Logging and Monitoring Edge Cases', () => {
    it('handles logging failures gracefully', async () => {
      (SecurityLogger.log as jest.Mock).mockImplementation(() => {
        throw new Error('Logging service unavailable');
      });

      const mockResponse = {
        success: true,
        data: {
          accessToken: 'token-123',
          user: { id: 'user-123' },
        },
      };
      (secureApiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      // Should not throw even if logging fails
      const result = await service.handleCallback('test-code');

      expect(result.success).toBe(true);
    });

    it('handles sensitive data in logs appropriately', async () => {
      const sensitiveResponse = {
        success: true,
        data: {
          accessToken: 'sensitive-token-123',
          refreshToken: 'sensitive-refresh-123',
          user: {
            id: 'user-123',
            email: 'user@example.com',
            ssn: '123-45-6789', // Sensitive data that shouldn't be logged
          },
        },
      };
      (secureApiClient.post as jest.Mock).mockResolvedValue(sensitiveResponse);

      await service.handleCallback('test-code');

      // Verify that sensitive data is not logged
      const logCalls = (SecurityLogger.log as jest.Mock).mock.calls;
      const logMessages = logCalls.map(call => JSON.stringify(call));
      
      logMessages.forEach(message => {
        expect(message).not.toContain('sensitive-token-123');
        expect(message).not.toContain('sensitive-refresh-123');
        expect(message).not.toContain('123-45-6789');
      });
    });
  });
});