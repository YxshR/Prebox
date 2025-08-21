/**
 * Unit tests for GoogleOAuthService
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { GoogleOAuthService, googleOAuthService } from '../googleAuth';
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

// Mock window.location
const mockLocation = {
  href: '',
  assign: jest.fn(),
  replace: jest.fn(),
  reload: jest.fn(),
};

// Mock window.location in jest.setup.js style
delete (window as any).location;
(window as any).location = mockLocation;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

describe('GoogleOAuthService', () => {
  let service: GoogleOAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.href = '';
    mockLocalStorage.setItem.mockClear();
    
    // Mock localStorage on window
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
    
    // Reset environment variables
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000/api';
    
    service = new GoogleOAuthService();
  });

  describe('Constructor and Configuration', () => {
    it('initializes with correct default configuration', () => {
      const config = service.getConfigStatus();
      
      expect(config.configured).toBe(true);
      expect(config.clientId).toBe('Set');
      expect(config.redirectUri).toBe('http://localhost:3000/auth/google/callback');
    });

    it('handles missing client ID', () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      
      const newService = new GoogleOAuthService();
      const config = newService.getConfigStatus();
      
      expect(config.configured).toBe(false);
      expect(config.clientId).toBe('Not set');
    });

    it('uses custom app URL when provided', () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://myapp.com';
      
      const newService = new GoogleOAuthService();
      const config = newService.getConfigStatus();
      
      expect(config.redirectUri).toBe('https://myapp.com/auth/google/callback');
    });

    it('falls back to default app URL when not provided', () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      
      const newService = new GoogleOAuthService();
      const config = newService.getConfigStatus();
      
      expect(config.redirectUri).toBe('http://localhost:3000/auth/google/callback');
    });
  });

  describe('initiateLogin', () => {
    it('redirects to Google OAuth endpoint', () => {
      service.initiateLogin();
      
      expect(mockLocation.href).toBe('http://localhost:8000/api/auth/google');
      expect(SecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_INITIATE',
        'Google OAuth login initiated'
      );
    });

    it('uses custom API URL when provided', () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://api.myapp.com';
      
      service.initiateLogin();
      
      expect(mockLocation.href).toBe('https://api.myapp.com/auth/google');
    });

    it('falls back to default API URL when not provided', () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      
      service.initiateLogin();
      
      expect(mockLocation.href).toBe('http://localhost:8000/api/auth/google');
    });

    it('throws error when client ID is not configured', () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      const newService = new GoogleOAuthService();
      
      expect(() => newService.initiateLogin()).toThrow(
        'Google OAuth is not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID environment variable.'
      );
    });

    it('logs security event', () => {
      service.initiateLogin();
      
      expect(SecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_INITIATE',
        'Google OAuth login initiated'
      );
    });
  });

  describe('handleCallback', () => {
    const mockCode = 'auth-code-123';

    it('handles successful callback', async () => {
      const mockResponse = {
        success: true,
        data: {
          accessToken: 'access-token-123',
          refreshToken: 'refresh-token-123',
          user: {
            id: 'user-123',
            email: 'user@example.com',
            name: 'Test User',
          },
        },
      };

      (secureApiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.handleCallback(mockCode);

      expect(secureApiClient.post).toHaveBeenCalledWith('/auth/google/callback', {
        code: mockCode,
        redirectUri: 'http://localhost:3000/auth/google/callback',
      });

      expect(result).toEqual({
        success: true,
        user: mockResponse.data.user,
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('accessToken', 'access-token-123');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('refreshToken', 'refresh-token-123');

      expect(SecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_CALLBACK',
        'Processing Google OAuth callback'
      );
      expect(SecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_SUCCESS',
        'Google OAuth authentication successful'
      );
    });

    it('handles callback without tokens', async () => {
      const mockResponse = {
        success: true,
        data: {
          user: {
            id: 'user-123',
            email: 'user@example.com',
            name: 'Test User',
          },
        },
      };

      (secureApiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.handleCallback(mockCode);

      expect(result).toEqual({
        success: true,
        user: mockResponse.data.user,
      });

      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();
    });

    it('handles API failure response', async () => {
      const mockResponse = {
        success: false,
        error: {
          message: 'Invalid authorization code',
          code: 'INVALID_CODE',
        },
      };

      (secureApiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.handleCallback(mockCode);

      expect(result).toEqual({
        success: false,
        error: 'Invalid authorization code',
      });

      expect(mockLocalStorage.setItem).not.toHaveBeenCalled();

      expect(SecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_FAILED',
        'Google OAuth authentication failed',
        { error: mockResponse.error }
      );
    });

    it('handles API error without message', async () => {
      const mockResponse = {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
        },
      };

      (secureApiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.handleCallback(mockCode);

      expect(result).toEqual({
        success: false,
        error: 'Google authentication failed',
      });
    });

    it('handles network errors', async () => {
      const networkError = new Error('Network error');
      (secureApiClient.post as jest.Mock).mockRejectedValue(networkError);

      const result = await service.handleCallback(mockCode);

      expect(result).toEqual({
        success: false,
        error: 'Network error',
      });

      expect(SecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_ERROR',
        'Google OAuth authentication error',
        { error: 'Network error' }
      );
    });

    it('handles non-Error exceptions', async () => {
      (secureApiClient.post as jest.Mock).mockRejectedValue('String error');

      const result = await service.handleCallback(mockCode);

      expect(result).toEqual({
        success: false,
        error: 'Google authentication failed',
      });
    });

    it('uses correct redirect URI in callback', async () => {
      process.env.NEXT_PUBLIC_APP_URL = 'https://myapp.com';
      const newService = new GoogleOAuthService();

      const mockResponse = { success: true, data: {} };
      (secureApiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      await newService.handleCallback(mockCode);

      expect(secureApiClient.post).toHaveBeenCalledWith('/auth/google/callback', {
        code: mockCode,
        redirectUri: 'https://myapp.com/auth/google/callback',
      });
    });
  });

  describe('getProfile', () => {
    const mockToken = 'bearer-token-123';

    it('retrieves user profile successfully', async () => {
      const mockProfile = {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
      };

      const mockResponse = {
        success: true,
        data: mockProfile,
      };

      (secureApiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      const result = await service.getProfile(mockToken);

      expect(secureApiClient.get).toHaveBeenCalledWith('/auth/google/profile', {
        headers: {
          'Authorization': `Bearer ${mockToken}`,
        },
      });

      expect(result).toEqual(mockProfile);

      expect(SecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_PROFILE_REQUEST',
        'Requesting Google user profile'
      );
      expect(SecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_PROFILE_SUCCESS',
        'Google profile retrieved successfully'
      );
    });

    it('handles API failure response', async () => {
      const mockResponse = {
        success: false,
        error: {
          message: 'Invalid token',
          code: 'INVALID_TOKEN',
        },
      };

      (secureApiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await expect(service.getProfile(mockToken)).rejects.toThrow('Invalid token');

      expect(SecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_PROFILE_ERROR',
        'Google profile request failed',
        { error: 'Invalid token' }
      );
    });

    it('handles API error without message', async () => {
      const mockResponse = {
        success: false,
        error: {
          code: 'UNKNOWN_ERROR',
        },
      };

      (secureApiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await expect(service.getProfile(mockToken)).rejects.toThrow('Failed to get Google profile');
    });

    it('handles network errors', async () => {
      const networkError = new Error('Network timeout');
      (secureApiClient.get as jest.Mock).mockRejectedValue(networkError);

      await expect(service.getProfile(mockToken)).rejects.toThrow('Network timeout');

      expect(SecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_PROFILE_ERROR',
        'Google profile request failed',
        { error: 'Network timeout' }
      );
    });

    it('handles non-Error exceptions', async () => {
      (secureApiClient.get as jest.Mock).mockRejectedValue('String error');

      await expect(service.getProfile(mockToken)).rejects.toThrow('Failed to get Google profile');
    });
  });

  describe('Configuration Methods', () => {
    it('correctly identifies configured state', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('correctly identifies unconfigured state', () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      const newService = new GoogleOAuthService();
      
      expect(newService.isConfigured()).toBe(false);
    });

    it('returns correct configuration status', () => {
      const status = service.getConfigStatus();
      
      expect(status).toEqual({
        configured: true,
        clientId: 'Set',
        redirectUri: 'http://localhost:3000/auth/google/callback',
      });
    });

    it('returns correct configuration status when not configured', () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      const newService = new GoogleOAuthService();
      const status = newService.getConfigStatus();
      
      expect(status).toEqual({
        configured: false,
        clientId: 'Not set',
        redirectUri: 'http://localhost:3000/auth/google/callback',
      });
    });
  });

  describe('Singleton Instance', () => {
    it('exports a singleton instance', () => {
      expect(googleOAuthService).toBeInstanceOf(GoogleOAuthService);
    });

    it('singleton instance is properly configured', () => {
      expect(googleOAuthService.isConfigured()).toBe(true);
    });

    it('singleton instance methods work correctly', () => {
      expect(() => googleOAuthService.initiateLogin()).not.toThrow();
      expect(mockLocation.href).toBe('http://localhost:8000/api/auth/google');
    });
  });

  describe('Security Considerations', () => {
    it('logs all authentication attempts', () => {
      service.initiateLogin();
      
      expect(SecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_INITIATE',
        'Google OAuth login initiated'
      );
    });

    it('logs callback processing', async () => {
      const mockResponse = { success: true, data: {} };
      (secureApiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      await service.handleCallback('test-code');

      expect(SecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_CALLBACK',
        'Processing Google OAuth callback'
      );
    });

    it('logs authentication failures', async () => {
      const mockResponse = {
        success: false,
        error: { message: 'Authentication failed' },
      };
      (secureApiClient.post as jest.Mock).mockResolvedValue(mockResponse);

      await service.handleCallback('test-code');

      expect(SecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_FAILED',
        'Google OAuth authentication failed',
        { error: mockResponse.error }
      );
    });

    it('logs profile requests', async () => {
      const mockResponse = { success: true, data: {} };
      (secureApiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await service.getProfile('test-token');

      expect(SecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_PROFILE_REQUEST',
        'Requesting Google user profile'
      );
    });

    it('does not expose sensitive data in logs', async () => {
      await service.handleCallback('sensitive-auth-code');

      // Verify that the auth code is not logged
      const logCalls = (SecurityLogger.log as jest.Mock).mock.calls;
      const logMessages = logCalls.map(call => JSON.stringify(call));
      
      logMessages.forEach(message => {
        expect(message).not.toContain('sensitive-auth-code');
      });
    });
  });

  describe('Error Handling Edge Cases', () => {
    it('handles empty authorization code', async () => {
      const result = await service.handleCallback('');

      expect(secureApiClient.post).toHaveBeenCalledWith('/auth/google/callback', {
        code: '',
        redirectUri: 'http://localhost:3000/auth/google/callback',
      });
    });

    it('handles null authorization code', async () => {
      const result = await service.handleCallback(null as any);

      expect(secureApiClient.post).toHaveBeenCalledWith('/auth/google/callback', {
        code: null,
        redirectUri: 'http://localhost:3000/auth/google/callback',
      });
    });

    it('handles empty token in getProfile', async () => {
      const mockResponse = { success: true, data: {} };
      (secureApiClient.get as jest.Mock).mockResolvedValue(mockResponse);

      await service.getProfile('');

      expect(secureApiClient.get).toHaveBeenCalledWith('/auth/google/profile', {
        headers: {
          'Authorization': 'Bearer ',
        },
      });
    });

    it('handles localStorage errors during token storage', async () => {
      const mockResponse = {
        success: true,
        data: {
          accessToken: 'access-token-123',
          refreshToken: 'refresh-token-123',
          user: { id: 'user-123' },
        },
      };

      (secureApiClient.post as jest.Mock).mockResolvedValue(mockResponse);
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage is full');
      });

      // Should not throw, but should handle the error gracefully
      const result = await service.handleCallback('test-code');

      expect(result.success).toBe(true);
      expect(result.user).toEqual({ id: 'user-123' });
    });
  });

  describe('Environment Variable Handling', () => {
    it('handles missing NEXT_PUBLIC_API_URL', () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      
      service.initiateLogin();
      
      expect(mockLocation.href).toBe('http://localhost:8000/api/auth/google');
    });

    it('handles empty NEXT_PUBLIC_API_URL', () => {
      process.env.NEXT_PUBLIC_API_URL = '';
      
      service.initiateLogin();
      
      expect(mockLocation.href).toBe('http://localhost:8000/api/auth/google');
    });

    it('handles missing NEXT_PUBLIC_APP_URL', () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      const newService = new GoogleOAuthService();
      
      const config = newService.getConfigStatus();
      expect(config.redirectUri).toBe('http://localhost:3000/auth/google/callback');
    });

    it('handles empty NEXT_PUBLIC_APP_URL', () => {
      process.env.NEXT_PUBLIC_APP_URL = '';
      const newService = new GoogleOAuthService();
      
      const config = newService.getConfigStatus();
      expect(config.redirectUri).toBe('http://localhost:3000/auth/google/callback');
    });
  });
});