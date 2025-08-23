import { Auth0Service } from './auth0.service';
import { PhoneVerificationService } from './phone-verification.service';
import { AuthService } from './auth.service';
import pool from '../config/database';
import { Auth0UserProfile, UserRole, SubscriptionTier } from '../shared/types';

// Mock dependencies
jest.mock('../config/database');
jest.mock('./phone-verification.service');
jest.mock('./auth.service');
jest.mock('auth0');

const mockPool = pool as jest.Mocked<typeof pool>;
const mockPhoneVerificationService = PhoneVerificationService as jest.MockedClass<typeof PhoneVerificationService>;
const mockAuthService = AuthService as jest.MockedClass<typeof AuthService>;

describe('Auth0Service', () => {
  let auth0Service: Auth0Service;
  let mockClient: any;

  const mockAuth0Profile: Auth0UserProfile = {
    sub: 'auth0|123456789',
    email: 'test@example.com',
    email_verified: true,
    name: 'Test User',
    given_name: 'Test',
    family_name: 'User',
    picture: 'https://example.com/avatar.jpg'
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

  afterEach(() => {
    delete process.env.AUTH0_DOMAIN;
    delete process.env.AUTH0_CLIENT_ID;
    delete process.env.AUTH0_CLIENT_SECRET;
    delete process.env.AUTH0_CALLBACK_URL;
  });

  describe('constructor', () => {
    it('should throw error if Auth0 configuration is missing', () => {
      delete process.env.AUTH0_DOMAIN;
      
      expect(() => new Auth0Service()).toThrow('Auth0 configuration is missing');
    });

    it('should initialize with valid configuration', () => {
      expect(() => new Auth0Service()).not.toThrow();
    });
  });

  describe('handleAuth0Callback', () => {
    it('should return existing user if Auth0 ID exists', async () => {
      const existingUser = {
        id: 'user-123',
        email: 'test@example.com',
        auth0_id: 'auth0|123456789',
        tenant_id: 'tenant-123',
        role: UserRole.USER,
        subscription_tier: SubscriptionTier.FREE,
        is_email_verified: true,
        is_phone_verified: true,
        created_at: new Date(),
        last_login_at: new Date()
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [existingUser] }) // Check by Auth0 ID
        .mockResolvedValueOnce({}); // Update last login

      const result = await auth0Service.handleAuth0Callback(mockAuth0Profile);

      expect(result.isNewUser).toBe(false);
      expect(result.requiresPhoneVerification).toBe(false);
      expect(result.user.id).toBe('user-123');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should link accounts if email exists but no Auth0 ID', async () => {
      const existingUser = {
        id: 'user-123',
        email: 'test@example.com',
        auth0_id: null,
        tenant_id: 'tenant-123',
        role: UserRole.USER,
        subscription_tier: SubscriptionTier.FREE,
        is_email_verified: true,
        is_phone_verified: false,
        created_at: new Date(),
        last_login_at: new Date()
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No Auth0 ID match
        .mockResolvedValueOnce({ rows: [existingUser] }) // Email match
        .mockResolvedValueOnce({}) // Update user with Auth0 ID
        .mockResolvedValueOnce({}); // Upsert Auth0 profile

      const result = await auth0Service.handleAuth0Callback(mockAuth0Profile);

      expect(result.isNewUser).toBe(false);
      expect(result.requiresPhoneVerification).toBe(true);
      expect(result.user.id).toBe('user-123');
    });

    it('should create new user if no existing user found', async () => {
      const newUser = {
        id: 'new-user-123',
        email: 'test@example.com',
        auth0_id: 'auth0|123456789',
        tenant_id: 'new-tenant-123',
        role: UserRole.USER,
        subscription_tier: SubscriptionTier.FREE,
        is_email_verified: true,
        is_phone_verified: false,
        first_name: 'Test',
        last_name: 'User',
        created_at: new Date(),
        last_login_at: new Date()
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No Auth0 ID match
        .mockResolvedValueOnce({ rows: [] }) // No email match
        .mockResolvedValueOnce({ rows: [newUser] }) // Insert new user
        .mockResolvedValueOnce({}) // Insert tenant
        .mockResolvedValueOnce({}) // Insert subscription
        .mockResolvedValueOnce({}); // Insert Auth0 profile

      const result = await auth0Service.handleAuth0Callback(mockAuth0Profile);

      expect(result.isNewUser).toBe(true);
      expect(result.requiresPhoneVerification).toBe(true);
      expect(result.user.email).toBe('test@example.com');
    });

    it('should rollback transaction on error', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No Auth0 ID match
        .mockRejectedValueOnce(new Error('Database error'));

      await expect(auth0Service.handleAuth0Callback(mockAuth0Profile))
        .rejects.toThrow('Database error');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('completeAuth0Signup', () => {
    it('should complete signup with phone verification', async () => {
      const userId = 'user-123';
      const phone = '+1234567890';
      const otpId = 'otp-123';

      mockClient.query.mockResolvedValueOnce({ rows: [] }); // No existing phone
      mockClient.query.mockResolvedValueOnce({}); // Update user phone

      const mockPhoneService = mockPhoneVerificationService.prototype;
      mockPhoneService.sendOTP = jest.fn().mockResolvedValue(otpId);

      const result = await auth0Service.completeAuth0Signup(userId, phone);

      expect(result.otpId).toBe(otpId);
      expect(mockPhoneService.sendOTP).toHaveBeenCalledWith(userId, phone, 'registration');
    });

    it('should throw error if phone number already exists', async () => {
      const userId = 'user-123';
      const phone = '+1234567890';

      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 'other-user' }] }); // Existing phone

      await expect(auth0Service.completeAuth0Signup(userId, phone))
        .rejects.toThrow('Phone number is already registered with another account');
    });
  });

  describe('verifyAuth0Phone', () => {
    it('should verify phone and return auth tokens', async () => {
      const otpId = 'otp-123';
      const code = '123456';
      const mockAuthResult = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        user: {
          id: 'user-123',
          email: 'test@example.com',
          isPhoneVerified: false
        }
      };

      const mockPhoneService = mockPhoneVerificationService.prototype;
      mockPhoneService.verifyOTPWithAuth = jest.fn().mockResolvedValue(mockAuthResult);

      mockClient.query.mockResolvedValueOnce({}); // Update phone verification

      const result = await auth0Service.verifyAuth0Phone(otpId, code);

      expect(result.user.isPhoneVerified).toBe(true);
      expect(mockPhoneService.verifyOTPWithAuth).toHaveBeenCalledWith(otpId, code);
    });
  });

  describe('getAuth0Profile', () => {
    it('should return Auth0 profile if exists', async () => {
      const userId = 'user-123';
      const profileRow = {
        id: 'profile-123',
        user_id: userId,
        auth0_id: 'auth0|123456789',
        profile_data: mockAuth0Profile,
        created_at: new Date(),
        updated_at: new Date()
      };

      mockPool.query.mockResolvedValueOnce({ rows: [profileRow] });

      const result = await auth0Service.getAuth0Profile(userId);

      expect(result).toBeTruthy();
      expect(result!.userId).toBe(userId);
      expect(result!.auth0Id).toBe('auth0|123456789');
    });

    it('should return null if profile does not exist', async () => {
      const userId = 'user-123';

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await auth0Service.getAuth0Profile(userId);

      expect(result).toBeNull();
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate correct authorization URL', () => {
      const state = 'test-state';
      const url = auth0Service.getAuthorizationUrl(state);

      expect(url).toContain('https://test-domain.auth0.com/authorize');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('state=test-state');
      expect(url).toContain('scope=openid%20profile%20email');
    });

    it('should generate URL without state parameter', () => {
      const url = auth0Service.getAuthorizationUrl();

      expect(url).toContain('https://test-domain.auth0.com/authorize');
      expect(url).not.toContain('state=');
    });
  });

  describe('error scenarios', () => {
    it('should handle Auth0 API errors gracefully', async () => {
      // Mock Auth0 client to throw error
      const mockAuthClient = {
        oauth: {
          authorizationCodeGrant: jest.fn().mockRejectedValue(new Error('Auth0 API error'))
        }
      };

      // Replace the authentication client
      (auth0Service as any).authenticationClient = mockAuthClient;

      await expect(auth0Service.exchangeCodeForTokens('invalid-code'))
        .rejects.toThrow('Auth0 token exchange failed: Auth0 API error');
    });

    it('should handle database connection errors', async () => {
      mockPool.connect.mockRejectedValue(new Error('Database connection failed'));

      await expect(auth0Service.handleAuth0Callback(mockAuth0Profile))
        .rejects.toThrow('Database connection failed');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete Auth0 signup flow', async () => {
      // Step 1: Handle Auth0 callback for new user
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No Auth0 ID match
        .mockResolvedValueOnce({ rows: [] }) // No email match
        .mockResolvedValueOnce({ rows: [{ id: 'new-user-123' }] }) // Insert new user
        .mockResolvedValueOnce({}) // Insert tenant
        .mockResolvedValueOnce({}) // Insert subscription
        .mockResolvedValueOnce({}); // Insert Auth0 profile

      const callbackResult = await auth0Service.handleAuth0Callback(mockAuth0Profile);
      expect(callbackResult.isNewUser).toBe(true);
      expect(callbackResult.requiresPhoneVerification).toBe(true);

      // Step 2: Complete signup with phone
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // No existing phone
        .mockResolvedValueOnce({}); // Update user phone

      const mockPhoneService = mockPhoneVerificationService.prototype;
      mockPhoneService.sendOTP = jest.fn().mockResolvedValue('otp-123');

      const signupResult = await auth0Service.completeAuth0Signup('new-user-123', '+1234567890');
      expect(signupResult.otpId).toBe('otp-123');

      // Step 3: Verify phone
      mockPhoneService.verifyOTPWithAuth = jest.fn().mockResolvedValue({
        accessToken: 'token',
        refreshToken: 'refresh',
        expiresIn: 900,
        user: { id: 'new-user-123', isPhoneVerified: false }
      });

      mockClient.query.mockResolvedValueOnce({}); // Update phone verification

      const verifyResult = await auth0Service.verifyAuth0Phone('otp-123', '123456');
      expect(verifyResult.user.isPhoneVerified).toBe(true);
    });
  });
});