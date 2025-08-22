import { GoogleOAuthService, googleOAuthService } from '../../lib/googleAuth';
import { secureApiClient } from '../../lib/secureApiClient';
import { SecurityLogger } from '../../lib/security';

// Mock dependencies
jest.mock('../../lib/secureApiClient', () => ({
  secureApiClient: {
    post: jest.fn(),
    get: jest.fn()
  }
}));

jest.mock('../../lib/security', () => ({
  SecurityLogger: {
    log: jest.fn()
  }
}));

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

describe('GoogleOAuthService', () => {
  let service: GoogleOAuthService;
  const mockSecureApiClient = secureApiClient as jest.Mocked<typeof secureApiClient>;
  const mockSecurityLogger = SecurityLogger as jest.Mocked<typeof SecurityLogger>;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    mockLocation.href = '';
    
    // Set up environment variables
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000/api';
    
    service = new GoogleOAuthService();
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(service).toBeInstanceOf(GoogleOAuthService);
    });

    it('should use environment variables for configuration', () => {
      const configStatus = service.getConfigStatus();
      expect(configStatus.configured).toBe(true);
      expect(configStatus.clientId).toBe('Set');
      expect(configStatus.redirectUri).toBe('http://localhost:3000/auth/google/callback');
    });

    it('should handle missing environment variables', () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      const newService = new GoogleOAuthService();
      const configStatus = newService.getConfigStatus();
      
      expect(configStatus.configured).toBe(false);
      expect(configStatus.clientId).toBe('Not set');
    });
  });

  describe('initiateLogin', () => {
    it('should redirect to Google OAuth endpoint', () => {
      service.initiateLogin();
      
      expect(mockLocation.href).toBe('http://localhost:8000/api/auth/google');
      expect(mockSecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_INITIATE',
        'Google OAuth login initiated'
      );
    });

    it('should throw error when not configured', () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      const unconfiguredService = new GoogleOAuthService();
      
      expect(() => unconfiguredService.initiateLogin()).toThrow(
        'Google OAuth is not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID environment variable.'
      );
    });

    it('should use default API URL when not set', () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      const newService = new GoogleOAuthService();
      
      newService.initiateLogin();
      
      expect(mockLocation.href).toBe('http://localhost:8000/api/auth/google');
    });
  });

  describe('handleCallback', () => {
    it('should handle successful callback', async () => {
      const mockResponse = {
        success: true,
        data: {
          user: { id: '1', email: 'test@example.com' },
          accessToken: 'access-token',
          refreshToken: 'refresh-token'
        }
      };
      
      mockSecureApiClient.post.mockResolvedValue(mockResponse);
      
      const result = await service.handleCallback('auth-code');
      
      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockResponse.data.user);
      expect(localStorageMock.setItem).toHaveBeenCalledWith('accessToken', 'access-token');
      expect(localStorageMock.setItem).toHaveBeenCalledWith('refreshToken', 'refresh-token');
      expect(mockSecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_CALLBACK',
        'Processing Google OAuth callback'
      );
      expect(mockSecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_SUCCESS',
        'Google OAuth authentication successful'
      );
    });

    it('should handle callback without tokens', async () => {
      const mockResponse = {
        success: true,
        data: {
          user: { id: '1', email: 'test@example.com' }
        }
      };
      
      mockSecureApiClient.post.mockResolvedValue(mockResponse);
      
      const result = await service.handleCallback('auth-code');
      
      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockResponse.data.user);
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('should handle failed callback response', async () => {
      const mockResponse = {
        success: false,
        error: { message: 'Invalid authorization code' }
      };
      
      mockSecureApiClient.post.mockResolvedValue(mockResponse);
      
      const result = await service.handleCallback('invalid-code');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid authorization code');
      expect(mockSecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_FAILED',
        'Google OAuth authentication failed',
        { error: mockResponse.error }
      );
    });

    it('should handle callback API errors', async () => {
      const apiError = new Error('Network error');
      mockSecureApiClient.post.mockRejectedValue(apiError);
      
      const result = await service.handleCallback('auth-code');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
      expect(mockSecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_AUTH_ERROR',
        'Google OAuth authentication error',
        { error: 'Network error' }
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockSecureApiClient.post.mockRejectedValue('String error');
      
      const result = await service.handleCallback('auth-code');
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Google authentication failed');
    });

    it('should call API with correct parameters', async () => {
      const mockResponse = { success: true, data: { user: {} } };
      mockSecureApiClient.post.mockResolvedValue(mockResponse);
      
      await service.handleCallback('test-code');
      
      expect(mockSecureApiClient.post).toHaveBeenCalledWith('/auth/google/callback', {
        code: 'test-code',
        redirectUri: 'http://localhost:3000/auth/google/callback'
      });
    });
  });

  describe('getProfile', () => {
    it('should get user profile successfully', async () => {
      const mockProfile = {
        success: true,
        data: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User'
        }
      };
      
      mockSecureApiClient.get.mockResolvedValue(mockProfile);
      
      const result = await service.getProfile('access-token');
      
      expect(result).toEqual(mockProfile.data);
      expect(mockSecureApiClient.get).toHaveBeenCalledWith('/auth/google/profile', {
        headers: {
          'Authorization': 'Bearer access-token'
        }
      });
      expect(mockSecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_PROFILE_REQUEST',
        'Requesting Google user profile'
      );
      expect(mockSecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_PROFILE_SUCCESS',
        'Google profile retrieved successfully'
      );
    });

    it('should handle profile API failure', async () => {
      const mockResponse = {
        success: false,
        error: { message: 'Invalid token' }
      };
      
      mockSecureApiClient.get.mockResolvedValue(mockResponse);
      
      await expect(service.getProfile('invalid-token')).rejects.toThrow('Invalid token');
      expect(mockSecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_PROFILE_ERROR',
        'Google profile request failed',
        { error: 'Invalid token' }
      );
    });

    it('should handle profile API errors', async () => {
      const apiError = new Error('Network error');
      mockSecureApiClient.get.mockRejectedValue(apiError);
      
      await expect(service.getProfile('token')).rejects.toThrow('Network error');
      expect(mockSecurityLogger.log).toHaveBeenCalledWith(
        'GOOGLE_PROFILE_ERROR',
        'Google profile request failed',
        { error: 'Network error' }
      );
    });

    it('should handle non-Error exceptions in profile', async () => {
      mockSecureApiClient.get.mockRejectedValue('String error');
      
      await expect(service.getProfile('token')).rejects.toThrow('Failed to get Google profile');
    });
  });

  describe('isConfigured', () => {
    it('should return true when client ID is set', () => {
      expect(service.isConfigured()).toBe(true);
    });

    it('should return false when client ID is not set', () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      const unconfiguredService = new GoogleOAuthService();
      
      expect(unconfiguredService.isConfigured()).toBe(false);
    });
  });

  describe('getConfigStatus', () => {
    it('should return configuration status', () => {
      const status = service.getConfigStatus();
      
      expect(status).toEqual({
        configured: true,
        clientId: 'Set',
        redirectUri: 'http://localhost:3000/auth/google/callback'
      });
    });

    it('should return not configured status', () => {
      delete process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      const unconfiguredService = new GoogleOAuthService();
      const status = unconfiguredService.getConfigStatus();
      
      expect(status).toEqual({
        configured: false,
        clientId: 'Not set',
        redirectUri: 'http://localhost:3000/auth/google/callback'
      });
    });
  });

  describe('singleton instance', () => {
    it('should export singleton instance', () => {
      expect(googleOAuthService).toBeInstanceOf(GoogleOAuthService);
    });
  });
});