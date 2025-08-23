import { Auth0Service } from './auth0.service';
import pool from '../config/database';
import { Auth0UserProfile } from '../shared/types';

// Mock dependencies
jest.mock('../config/database');
jest.mock('auth0');

const mockPool = pool as jest.Mocked<typeof pool>;

describe('Auth0Service Error Scenarios', () => {
  let auth0Service: Auth0Service;
  let mockClient: any;

  const mockAuth0Profile: Auth0UserProfile = {
    sub: 'auth0|123456789',
    email: 'test@example.com',
    email_verified: true,
    name: 'Test User',
    given_name: 'Test',
    family_name: 'User'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.AUTH0_DOMAIN = 'test-domain.auth0.com';
    process.env.AUTH0_CLIENT_ID = 'test-client-id';
    process.env.AUTH0_CLIENT_SECRET = 'test-client-secret';
    process.env.AUTH0_CALLBACK_URL = 'http://localhost:8000/api/auth/auth0/callback';

    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    mockPool.connect.mockResolvedValue(mockClient);
    auth0Service = new Auth0Service();
  });

  describe('Database Connection Failures', () => {
    it('should handle database connection failure in handleAuth0Callback', async () => {
      mockPool.connect.mockRejectedValue(new Error('Database connection failed'));

      await expect(auth0Service.handleAuth0Callback(mockAuth0Profile))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle database connection failure in completeAuth0Signup', async () => {
      mockPool.connect.mockRejectedValue(new Error('Database connection failed'));

      await expect(auth0Service.completeAuth0Signup('user-123', '+1234567890'))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle database connection failure in verifyAuth0Phone', async () => {
      mockPool.connect.mockRejectedValue(new Error('Database connection failed'));

      await expect(auth0Service.verifyAuth0Phone('otp-123', '123456'))
        .rejects.toThrow('Database connection failed');
    });
  });

  describe('Database Query Failures', () => {
    it('should rollback transaction on user creation failure', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No Auth0 ID match
        .mockResolvedValueOnce({ rows: [] }) // No email match
        .mockRejectedValueOnce(new Error('User creation failed')); // Insert user fails

      await expect(auth0Service.handleAuth0Callback(mockAuth0Profile))
        .rejects.toThrow('User creation failed');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback transaction on tenant creation failure', async () => {
      const newUser = {
        id: 'new-user-123',
        email: 'test@example.com',
        auth0_id: 'auth0|123456789'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No Auth0 ID match
        .mockResolvedValueOnce({ rows: [] }) // No email match
        .mockResolvedValueOnce({ rows: [newUser] }) // Insert user succeeds
        .mockRejectedValueOnce(new Error('Tenant creation failed')); // Insert tenant fails

      await expect(auth0Service.handleAuth0Callback(mockAuth0Profile))
        .rejects.toThrow('Tenant creation failed');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should rollback transaction on subscription creation failure', async () => {
      const newUser = {
        id: 'new-user-123',
        email: 'test@example.com',
        auth0_id: 'auth0|123456789'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No Auth0 ID match
        .mockResolvedValueOnce({ rows: [] }) // No email match
        .mockResolvedValueOnce({ rows: [newUser] }) // Insert user succeeds
        .mockResolvedValueOnce({}) // Insert tenant succeeds
        .mockRejectedValueOnce(new Error('Subscription creation failed')); // Insert subscription fails

      await expect(auth0Service.handleAuth0Callback(mockAuth0Profile))
        .rejects.toThrow('Subscription creation failed');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('Auth0 API Failures', () => {
    it('should handle Auth0 token exchange failure', async () => {
      const mockAuthClient = {
        oauth: {
          authorizationCodeGrant: jest.fn().mockRejectedValue(new Error('Invalid authorization code'))
        }
      };

      (auth0Service as any).authenticationClient = mockAuthClient;

      await expect(auth0Service.exchangeCodeForTokens('invalid-code'))
        .rejects.toThrow('Auth0 token exchange failed: Invalid authorization code');
    });

    it('should handle Auth0 user info fetch failure', async () => {
      const mockAuthClient = {
        oauth: {
          authorizationCodeGrant: jest.fn().mockResolvedValue({
            data: { access_token: 'valid-token' }
          })
        },
        users: {
          getInfo: jest.fn().mockRejectedValue(new Error('User info fetch failed'))
        }
      };

      (auth0Service as any).authenticationClient = mockAuthClient;

      await expect(auth0Service.exchangeCodeForTokens('valid-code'))
        .rejects.toThrow('Auth0 token exchange failed: User info fetch failed');
    });

    it('should handle Auth0 network timeout', async () => {
      const mockAuthClient = {
        oauth: {
          authorizationCodeGrant: jest.fn().mockRejectedValue(new Error('Network timeout'))
        }
      };

      (auth0Service as any).authenticationClient = mockAuthClient;

      await expect(auth0Service.exchangeCodeForTokens('valid-code'))
        .rejects.toThrow('Auth0 token exchange failed: Network timeout');
    });
  });

  describe('Data Validation Failures', () => {
    it('should handle invalid Auth0 profile data', async () => {
      const invalidProfile = {
        sub: '', // Empty sub
        email: 'invalid-email', // Invalid email format
        email_verified: true
      } as Auth0UserProfile;

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No Auth0 ID match
        .mockResolvedValueOnce({ rows: [] }) // No email match
        .mockRejectedValueOnce(new Error('Invalid email format')); // Database validation fails

      await expect(auth0Service.handleAuth0Callback(invalidProfile))
        .rejects.toThrow('Invalid email format');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should handle missing required Auth0 profile fields', async () => {
      const incompleteProfile = {
        sub: 'auth0|123456789'
        // Missing email field
      } as Auth0UserProfile;

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No Auth0 ID match
        .mockResolvedValueOnce({ rows: [] }) // No email match
        .mockRejectedValueOnce(new Error('Email is required')); // Database constraint fails

      await expect(auth0Service.handleAuth0Callback(incompleteProfile))
        .rejects.toThrow('Email is required');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('Phone Verification Service Failures', () => {
    it('should handle phone verification service failure in completeAuth0Signup', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No existing phone
        .mockResolvedValueOnce({}); // Update user phone succeeds

      const mockPhoneService = {
        sendOTP: jest.fn().mockRejectedValue(new Error('SMS service unavailable'))
      };

      (auth0Service as any).phoneVerificationService = mockPhoneService;

      await expect(auth0Service.completeAuth0Signup('user-123', '+1234567890'))
        .rejects.toThrow('SMS service unavailable');
    });

    it('should handle phone verification failure in verifyAuth0Phone', async () => {
      const mockPhoneService = {
        verifyOTPWithAuth: jest.fn().mockRejectedValue(new Error('Invalid OTP'))
      };

      (auth0Service as any).phoneVerificationService = mockPhoneService;

      await expect(auth0Service.verifyAuth0Phone('otp-123', '123456'))
        .rejects.toThrow('Invalid OTP');
    });
  });

  describe('Concurrent Access Issues', () => {
    it('should handle race condition when creating user with same email', async () => {
      // Simulate race condition where another process creates user between checks
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No Auth0 ID match (first check)
        .mockResolvedValueOnce({ rows: [] }) // No email match (first check)
        .mockRejectedValueOnce(new Error('duplicate key value violates unique constraint "users_email_key"')); // Insert fails due to race condition

      await expect(auth0Service.handleAuth0Callback(mockAuth0Profile))
        .rejects.toThrow('duplicate key value violates unique constraint');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should handle race condition when updating phone number', async () => {
      // Simulate race condition where phone number is taken between check and update
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No existing phone (first check)
        .mockRejectedValueOnce(new Error('duplicate key value violates unique constraint "users_phone_key"')); // Update fails due to race condition

      await expect(auth0Service.completeAuth0Signup('user-123', '+1234567890'))
        .rejects.toThrow('duplicate key value violates unique constraint');
    });
  });

  describe('Resource Cleanup', () => {
    it('should always release database connection even on error', async () => {
      mockClient.query.mockRejectedValue(new Error('Database error'));

      await expect(auth0Service.handleAuth0Callback(mockAuth0Profile))
        .rejects.toThrow('Database error');

      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle connection release failure gracefully', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });
      mockClient.release.mockRejectedValue(new Error('Connection release failed'));

      // Should not throw error even if release fails
      await expect(auth0Service.handleAuth0Callback(mockAuth0Profile))
        .resolves.toBeDefined();
    });
  });

  describe('Configuration Errors', () => {
    it('should throw error on missing Auth0 domain', () => {
      delete process.env.AUTH0_DOMAIN;

      expect(() => new Auth0Service())
        .toThrow('Auth0 configuration is missing');
    });

    it('should throw error on missing Auth0 client ID', () => {
      delete process.env.AUTH0_CLIENT_ID;

      expect(() => new Auth0Service())
        .toThrow('Auth0 configuration is missing');
    });

    it('should throw error on missing Auth0 client secret', () => {
      delete process.env.AUTH0_CLIENT_SECRET;

      expect(() => new Auth0Service())
        .toThrow('Auth0 configuration is missing');
    });
  });

  describe('Edge Cases', () => {
    it('should handle Auth0 profile with null values', async () => {
      const profileWithNulls = {
        sub: 'auth0|123456789',
        email: 'test@example.com',
        email_verified: true,
        name: null,
        given_name: null,
        family_name: null,
        picture: null
      } as Auth0UserProfile;

      const newUser = {
        id: 'new-user-123',
        email: 'test@example.com',
        auth0_id: 'auth0|123456789',
        first_name: null,
        last_name: null
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No Auth0 ID match
        .mockResolvedValueOnce({ rows: [] }) // No email match
        .mockResolvedValueOnce({ rows: [newUser] }) // Insert user succeeds
        .mockResolvedValueOnce({}) // Insert tenant succeeds
        .mockResolvedValueOnce({}) // Insert subscription succeeds
        .mockResolvedValueOnce({}); // Insert Auth0 profile succeeds

      const result = await auth0Service.handleAuth0Callback(profileWithNulls);

      expect(result.isNewUser).toBe(true);
      expect(result.user.firstName).toBeNull();
      expect(result.user.lastName).toBeNull();
    });

    it('should handle very long Auth0 profile data', async () => {
      const profileWithLongData = {
        ...mockAuth0Profile,
        name: 'A'.repeat(1000), // Very long name
        picture: 'https://example.com/' + 'a'.repeat(2000) // Very long URL
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No Auth0 ID match
        .mockResolvedValueOnce({ rows: [] }) // No email match
        .mockRejectedValueOnce(new Error('value too long for type character varying(255)')); // Database constraint fails

      await expect(auth0Service.handleAuth0Callback(profileWithLongData))
        .rejects.toThrow('value too long for type character varying');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });
});