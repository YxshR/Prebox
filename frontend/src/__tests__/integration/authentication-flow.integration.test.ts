import { googleOAuthService } from '../../lib/googleAuth';
import { secureApiClient } from '../../lib/secureApiClient';
import { SecurityLogger } from '../../lib/security';

// Mock dependencies
jest.mock('../../lib/secureApiClient');
jest.mock('../../lib/security');

const mockSecureApiClient = secureApiClient as jest.Mocked<typeof secureApiClient>;
const mockSecurityLogger = SecurityLogger as jest.Mocked<typeof SecurityLogger>;

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
  href: ''
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
});

describe('Authentication Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    mockLocation.href = '';
    
    // Set up environment variables
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000/api';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  describe('Complete Google OAuth Flow', () => {
    it('should complete successful Google OAuth authentication flow', async () => {
      // Step 1: Initiate OAuth
      googleOAuthService.initiateLogin();
      
      expect(mockLocation.href).toBe('http://localhost:8000/api/auth/google');
      expect(mockSecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_INITIATE',
        'Google OAuth login initiated'
      );

      // Step 2: Handle callback with successful response
      const mockUser = {
        id: 'google-user-id',
        email: 'user@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg'
      };

      const mockCallbackResponse = {
        success: true,
        data: {
          user: mockUser,
          accessToken: 'jwt-access-token',
          refreshToken: 'jwt-refresh-token'
        }
      };

      mockSecureApiClient.post.mockResolvedValue(mockCallbackResponse);

      const result = await googleOAuthService.handleCallback('auth-code-from-google');

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      
      // Verify tokens are stored
      expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', 'jwt-access-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('refreshToken', 'jwt-refresh-token');
      
      // Verify security logging
      expect(mockSecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_CALLBACK',
        'Processing Google OAuth callback'
      );
      expect(mockSecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_SUCCESS',
        'Google OAuth authentication successful'
      );

      // Step 3: Verify profile can be retrieved
      const mockProfileResponse = {
        success: true,
        data: {
          ...mockUser,
          verified_email: true,
          locale: 'en'
        }
      };

      mockSecureApiClient.get.mockResolvedValue(mockProfileResponse);

      const profile = await googleOAuthService.getProfile('jwt-access-token');

      expect(profile).toEqual(mockProfileResponse.data);
      expect(mockSecureApiClient.get).toHaveBeenCalledWith('/auth/google/profile', {
        headers: {
          'Authorization': 'Bearer jwt-access-token'
        }
      });
    });

    it('should handle OAuth flow with backend authentication failure', async () => {
      // Initiate OAuth
      googleOAuthService.initiateLogin();
      
      // Handle callback with backend failure
      const mockErrorResponse = {
        success: false,
        error: {
          message: 'Invalid authorization code',
          code: 'INVALID_AUTH_CODE'
        }
      };

      mockSecureApiClient.post.mockResolvedValue(mockErrorResponse);

      const result = await googleOAuthService.handleCallback('invalid-auth-code');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid authorization code');
      
      // Verify no tokens are stored on failure
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
      
      // Verify error logging
      expect(mockSecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_FAILED',
        'Google OAuth authentication failed',
        { error: mockErrorResponse.error }
      );
    });

    it('should handle OAuth flow with network errors', async () => {
      // Initiate OAuth
      googleOAuthService.initiateLogin();
      
      // Handle callback with network error
      const networkError = new Error('Network connection failed');
      mockSecureApiClient.post.mockRejectedValue(networkError);

      const result = await googleOAuthService.handleCallback('auth-code');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Network connection failed');
      
      // Verify error logging
      expect(mockSecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_ERROR',
        'Google OAuth authentication error',
        { error: 'Network connection failed' }
      );
    });

    it('should handle OAuth flow with expired tokens', async () => {
      // Successful initial authentication
      const mockCallbackResponse = {
        success: true,
        data: {
          user: { id: '1', email: 'user@example.com' },
          accessToken: 'expired-token'
        }
      };

      mockSecureApiClient.post.mockResolvedValue(mockCallbackResponse);
      await googleOAuthService.handleCallback('auth-code');

      // Try to get profile with expired token
      const expiredTokenResponse = {
        success: false,
        error: { message: 'Token expired' }
      };

      mockSecureApiClient.get.mockResolvedValue(expiredTokenResponse);

      await expect(googleOAuthService.getProfile('expired-token')).rejects.toThrow('Token expired');
      
      expect(mockSecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_PROFILE_ERROR',
        'Google profile request failed',
        { error: 'Token expired' }
      );
    });
  });

  describe('Authentication State Management', () => {
    it('should maintain authentication state across page reloads', async () => {
      // Simulate successful authentication
      const mockCallbackResponse = {
        success: true,
        data: {
          user: { id: '1', email: 'user@example.com' },
          accessToken: 'stored-token',
          refreshToken: 'stored-refresh-token'
        }
      };

      mockSecureApiClient.post.mockResolvedValue(mockCallbackResponse);
      await googleOAuthService.handleCallback('auth-code');

      // Verify tokens are stored
      expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', 'stored-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('refreshToken', 'stored-refresh-token');

      // Simulate page reload - tokens should be retrievable
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === 'accessToken') return 'stored-token';
        if (key === 'refreshToken') return 'stored-refresh-token';
        return null;
      });

      expect(localStorageMock.getItem('accessToken')).toBe('stored-token');
      expect(localStorageMock.getItem('refreshToken')).toBe('stored-refresh-token');
    });

    it('should handle authentication without refresh token', async () => {
      const mockCallbackResponse = {
        success: true,
        data: {
          user: { id: '1', email: 'user@example.com' },
          accessToken: 'access-only-token'
          // No refresh token
        }
      };

      mockSecureApiClient.post.mockResolvedValue(mockCallbackResponse);
      const result = await googleOAuthService.handleCallback('auth-code');

      expect(result.success).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', 'access-only-token');
      expect(localStorageMock.setItem).not.toHaveBeenCalledWith('refreshToken', expect.anything());
    });
  });

  describe('OAuth Configuration Validation', () => {
    it('should validate OAuth configuration before initiating flow', () => {
      expect(googleOAuthService.isConfigured()).toBe(true);
      
      const configStatus = googleOAuthService.getConfigStatus();
      expect(configStatus.configured).toBe(true);
      expect(configStatus.clientId).toBe('Set');
      expect(configStatus.redirectUri).toBe('http://localhost:3000/auth/google/callback');
    });

    it('should prevent OAuth flow when not configured', () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      
      // Create new service instance to pick up env change
      const unconfiguredService = new (googleOAuthService.constructor as any)();
      
      expect(() => unconfiguredService.initiateLogin()).toThrow(
        'Google OAuth is not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID environment variable.'
      );
    });

    it('should handle missing environment variables gracefully', () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.NEXT_PUBLIC_API_URL;
      
      const serviceWithDefaults = new (googleOAuthService.constructor as any)();
      
      // Should still work with defaults
      expect(() => serviceWithDefaults.initiateLogin()).not.toThrow();
    });
  });

  describe('Security Logging Integration', () => {
    it('should log all authentication events for security monitoring', async () => {
      // Test initiation logging
      googleOAuthService.initiateLogin();
      expect(mockSecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_INITIATE',
        'Google OAuth login initiated'
      );

      // Test callback processing logging
      const mockResponse = {
        success: true,
        data: { user: { id: '1' }, accessToken: 'token' }
      };
      mockSecureApiClient.post.mockResolvedValue(mockResponse);
      
      await googleOAuthService.handleCallback('code');
      
      expect(mockSecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_CALLBACK',
        'Processing Google OAuth callback'
      );
      expect(mockSecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_SUCCESS',
        'Google OAuth authentication successful'
      );

      // Test profile request logging
      mockSecureApiClient.get.mockResolvedValue({
        success: true,
        data: { id: '1', email: 'user@example.com' }
      });
      
      await googleOAuthService.getProfile('token');
      
      expect(mockSecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_PROFILE_REQUEST',
        'Requesting Google user profile'
      );
      expect(mockSecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_PROFILE_SUCCESS',
        'Google profile retrieved successfully'
      );
    });

    it('should log authentication failures for security analysis', async () => {
      // Test callback failure logging
      const errorResponse = {
        success: false,
        error: { message: 'Authentication failed' }
      };
      mockSecureApiClient.post.mockResolvedValue(errorResponse);
      
      await googleOAuthService.handleCallback('invalid-code');
      
      expect(mockSecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_FAILED',
        'Google OAuth authentication failed',
        { error: errorResponse.error }
      );

      // Test profile failure logging
      const profileError = new Error('Profile access denied');
      mockSecureApiClient.get.mockRejectedValue(profileError);
      
      await expect(googleOAuthService.getProfile('invalid-token')).rejects.toThrow();
      
      expect(mockSecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_PROFILE_ERROR',
        'Google profile request failed',
        { error: 'Profile access denied' }
      );
    });
  });

  describe('API Integration Points', () => {
    it('should call correct backend endpoints with proper parameters', async () => {
      // Test callback endpoint
      const mockResponse = { success: true, data: { user: {} } };
      mockSecureApiClient.post.mockResolvedValue(mockResponse);
      
      await googleOAuthService.handleCallback('test-auth-code');
      
      expect(mockSecureApiClient.post).toHaveBeenCalledWith('/auth/google/callback', {
        code: 'test-auth-code',
        redirectUri: 'http://localhost:3000/auth/google/callback'
      });

      // Test profile endpoint
      mockSecureApiClient.get.mockResolvedValue({
        success: true,
        data: { id: '1', email: 'user@example.com' }
      });
      
      await googleOAuthService.getProfile('test-token');
      
      expect(mockSecureApiClient.get).toHaveBeenCalledWith('/auth/google/profile', {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
    });

    it('should handle API client errors gracefully', async () => {
      // Test network timeout
      const timeoutError = new Error('Request timeout');
      (timeoutError as any).code = 'ECONNABORTED';
      
      mockSecureApiClient.post.mockRejectedValue(timeoutError);
      
      const result = await googleOAuthService.handleCallback('code');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timeout');

      // Test server error
      const serverError = new Error('Internal server error');
      (serverError as any).response = { status: 500 };
      
      mockSecureApiClient.get.mockRejectedValue(serverError);
      
      await expect(googleOAuthService.getProfile('token')).rejects.toThrow('Internal server error');
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle malformed callback responses', async () => {
      // Test response without required fields
      const malformedResponse = {
        success: true,
        data: {} // Missing user data
      };
      
      mockSecureApiClient.post.mockResolvedValue(malformedResponse);
      
      const result = await googleOAuthService.handleCallback('code');
      
      expect(result.success).toBe(true);
      expect(result.user).toEqual({});
    });

    it('should handle concurrent authentication attempts', async () => {
      const mockResponse = {
        success: true,
        data: { user: { id: '1' }, accessToken: 'token' }
      };
      
      mockSecureApiClient.post.mockResolvedValue(mockResponse);
      
      // Simulate concurrent callback handling
      const promises = [
        googleOAuthService.handleCallback('code1'),
        googleOAuthService.handleCallback('code2'),
        googleOAuthService.handleCallback('code3')
      ];
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle storage failures gracefully', async () => {
      // Mock localStorage failure
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      const mockResponse = {
        success: true,
        data: {
          user: { id: '1' },
          accessToken: 'token',
          refreshToken: 'refresh'
        }
      };
      
      mockSecureApiClient.post.mockResolvedValue(mockResponse);
      
      // Should not throw even if storage fails
      const result = await googleOAuthService.handleCallback('code');
      
      expect(result.success).toBe(true);
      expect(result.user).toEqual({ id: '1' });
    });
  });
});