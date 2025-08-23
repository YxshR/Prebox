import request from 'supertest';
import express from 'express';
import { Auth0Service } from './auth0.service';
import { AuthMiddleware } from './auth.middleware';
import auth0Routes from './auth0.routes';
import { Auth0UserProfile } from '../shared/types';

// Mock dependencies
jest.mock('./auth0.service');
jest.mock('./auth.middleware');

const mockAuth0Service = Auth0Service as jest.MockedClass<typeof Auth0Service>;
const mockAuthMiddleware = AuthMiddleware as jest.MockedClass<typeof AuthMiddleware>;

describe('Auth0 Routes Integration', () => {
  let app: express.Application;
  let mockAuth0ServiceInstance: jest.Mocked<Auth0Service>;
  let mockAuthMiddlewareInstance: jest.Mocked<AuthMiddleware>;

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

    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/auth/auth0', auth0Routes);

    // Mock Auth0Service instance
    mockAuth0ServiceInstance = {
      getAuthorizationUrl: jest.fn(),
      exchangeCodeForTokens: jest.fn(),
      handleAuth0Callback: jest.fn(),
      completeAuth0Signup: jest.fn(),
      verifyAuth0Phone: jest.fn(),
      getAuth0Profile: jest.fn(),
      updateAuth0Profile: jest.fn(),
      authService: {} as any
    } as any;

    mockAuth0Service.mockImplementation(() => mockAuth0ServiceInstance);

    // Mock AuthMiddleware instance
    mockAuthMiddlewareInstance = {
      authenticate: jest.fn((req, res, next) => {
        (req as any).user = { id: 'user-123', email: 'test@example.com' };
        next();
      })
    } as any;

    mockAuthMiddleware.mockImplementation(() => mockAuthMiddlewareInstance);

    // Set environment variables
    process.env.AUTH0_ERROR_REDIRECT = 'http://localhost:3000/auth/error';
    process.env.AUTH0_SUCCESS_REDIRECT = 'http://localhost:3000/auth/success';
    process.env.FRONTEND_URL = 'http://localhost:3000';
  });

  afterEach(() => {
    delete process.env.AUTH0_ERROR_REDIRECT;
    delete process.env.AUTH0_SUCCESS_REDIRECT;
    delete process.env.FRONTEND_URL;
  });

  describe('GET /api/auth/auth0/login', () => {
    it('should return Auth0 authorization URL for login', async () => {
      const mockAuthUrl = 'https://test-domain.auth0.com/authorize?client_id=test';
      mockAuth0ServiceInstance.getAuthorizationUrl.mockReturnValue(mockAuthUrl);

      const response = await request(app)
        .get('/api/auth/auth0/login')
        .query({ state: 'test-state' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.authUrl).toBe(mockAuthUrl);
      expect(mockAuth0ServiceInstance.getAuthorizationUrl).toHaveBeenCalledWith('test-state');
    });

    it('should handle errors when generating authorization URL', async () => {
      mockAuth0ServiceInstance.getAuthorizationUrl.mockImplementation(() => {
        throw new Error('Configuration error');
      });

      const response = await request(app)
        .get('/api/auth/auth0/login');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('AUTH0_URL_GENERATION_FAILED');
    });
  });

  describe('GET /api/auth/auth0/signup', () => {
    it('should return Auth0 authorization URL for signup', async () => {
      const mockAuthUrl = 'https://test-domain.auth0.com/authorize?client_id=test';
      mockAuth0ServiceInstance.getAuthorizationUrl.mockReturnValue(mockAuthUrl);

      const response = await request(app)
        .get('/api/auth/auth0/signup');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.authUrl).toBe(mockAuthUrl);
      expect(mockAuth0ServiceInstance.getAuthorizationUrl).toHaveBeenCalledWith('signup');
    });
  });

  describe('GET /api/auth/auth0/callback', () => {
    it('should handle successful callback for existing user', async () => {
      const mockCallbackResult = {
        user: { id: 'user-123', email: 'test@example.com' },
        isNewUser: false,
        requiresPhoneVerification: false
      };

      const mockAuthToken = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        user: mockCallbackResult.user
      };

      mockAuth0ServiceInstance.exchangeCodeForTokens.mockResolvedValue(mockAuth0Profile);
      mockAuth0ServiceInstance.handleAuth0Callback.mockResolvedValue(mockCallbackResult);
      mockAuth0ServiceInstance.authService = {
        login: jest.fn().mockResolvedValue(mockAuthToken)
      } as any;

      const response = await request(app)
        .get('/api/auth/auth0/callback')
        .query({ code: 'auth-code' });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('http://localhost:3000/auth/success');
      expect(response.headers.location).toContain('token=access-token');
    });

    it('should handle callback for new user requiring phone verification', async () => {
      const mockCallbackResult = {
        user: { id: 'new-user-123', email: 'test@example.com' },
        isNewUser: true,
        requiresPhoneVerification: true
      };

      mockAuth0ServiceInstance.exchangeCodeForTokens.mockResolvedValue(mockAuth0Profile);
      mockAuth0ServiceInstance.handleAuth0Callback.mockResolvedValue(mockCallbackResult);

      const response = await request(app)
        .get('/api/auth/auth0/callback')
        .query({ code: 'auth-code' });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('http://localhost:3000/auth/phone-verification');
      expect(response.headers.location).toContain('userId=new-user-123');
      expect(response.headers.location).toContain('newUser=true');
    });

    it('should handle Auth0 errors', async () => {
      const response = await request(app)
        .get('/api/auth/auth0/callback')
        .query({ 
          error: 'access_denied', 
          error_description: 'User cancelled authentication' 
        });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('http://localhost:3000/auth/error');
      expect(response.headers.location).toContain('error=access_denied');
    });

    it('should handle missing authorization code', async () => {
      const response = await request(app)
        .get('/api/auth/auth0/callback');

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('http://localhost:3000/auth/error');
      expect(response.headers.location).toContain('error=missing_code');
    });

    it('should handle callback processing errors', async () => {
      mockAuth0ServiceInstance.exchangeCodeForTokens.mockRejectedValue(
        new Error('Token exchange failed')
      );

      const response = await request(app)
        .get('/api/auth/auth0/callback')
        .query({ code: 'invalid-code' });

      expect(response.status).toBe(302);
      expect(response.headers.location).toContain('http://localhost:3000/auth/error');
      expect(response.headers.location).toContain('error=callback_failed');
    });
  });

  describe('POST /api/auth/auth0/complete-signup', () => {
    it('should complete signup with valid phone number', async () => {
      const mockResult = { otpId: 'otp-123' };
      mockAuth0ServiceInstance.completeAuth0Signup.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/auth/auth0/complete-signup')
        .send({ phone: '+1234567890' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.otpId).toBe('otp-123');
      expect(mockAuth0ServiceInstance.completeAuth0Signup).toHaveBeenCalledWith('user-123', '+1234567890');
    });

    it('should validate phone number format', async () => {
      const response = await request(app)
        .post('/api/auth/auth0/complete-signup')
        .send({ phone: 'invalid-phone' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle phone number already exists error', async () => {
      mockAuth0ServiceInstance.completeAuth0Signup.mockRejectedValue(
        new Error('Phone number is already registered with another account')
      );

      const response = await request(app)
        .post('/api/auth/auth0/complete-signup')
        .send({ phone: '+1234567890' });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PHONE_ALREADY_EXISTS');
    });

    it('should require authentication', async () => {
      mockAuthMiddlewareInstance.authenticate.mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .post('/api/auth/auth0/complete-signup')
        .send({ phone: '+1234567890' });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/auth0/verify-phone', () => {
    it('should verify phone with valid OTP', async () => {
      const mockAuthResult = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        user: { id: 'user-123', isPhoneVerified: true }
      };

      mockAuth0ServiceInstance.verifyAuth0Phone.mockResolvedValue(mockAuthResult);

      const response = await request(app)
        .post('/api/auth/auth0/verify-phone')
        .send({ otpId: 'otp-123', code: '123456' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.isPhoneVerified).toBe(true);
      expect(mockAuth0ServiceInstance.verifyAuth0Phone).toHaveBeenCalledWith('otp-123', '123456');
    });

    it('should validate OTP format', async () => {
      const response = await request(app)
        .post('/api/auth/auth0/verify-phone')
        .send({ otpId: 'invalid-uuid', code: '12345' }); // Invalid UUID and short code

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle expired OTP', async () => {
      mockAuth0ServiceInstance.verifyAuth0Phone.mockRejectedValue(
        new Error('OTP has expired')
      );

      const response = await request(app)
        .post('/api/auth/auth0/verify-phone')
        .send({ otpId: '123e4567-e89b-12d3-a456-426614174000', code: '123456' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('OTP_EXPIRED');
    });

    it('should handle too many attempts', async () => {
      mockAuth0ServiceInstance.verifyAuth0Phone.mockRejectedValue(
        new Error('Too many verification attempts')
      );

      const response = await request(app)
        .post('/api/auth/auth0/verify-phone')
        .send({ otpId: '123e4567-e89b-12d3-a456-426614174000', code: '123456' });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOO_MANY_ATTEMPTS');
    });
  });

  describe('GET /api/auth/auth0/profile', () => {
    it('should return Auth0 profile for authenticated user', async () => {
      const mockProfile = {
        id: 'profile-123',
        userId: 'user-123',
        auth0Id: 'auth0|123456789',
        profileData: mockAuth0Profile,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockAuth0ServiceInstance.getAuth0Profile.mockResolvedValue(mockProfile);

      const response = await request(app)
        .get('/api/auth/auth0/profile');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.profile.userId).toBe('user-123');
      expect(mockAuth0ServiceInstance.getAuth0Profile).toHaveBeenCalledWith('user-123');
    });

    it('should return 404 if profile not found', async () => {
      mockAuth0ServiceInstance.getAuth0Profile.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/auth/auth0/profile');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PROFILE_NOT_FOUND');
    });

    it('should handle service errors', async () => {
      mockAuth0ServiceInstance.getAuth0Profile.mockRejectedValue(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/auth/auth0/profile');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PROFILE_FETCH_FAILED');
    });

    it('should require authentication', async () => {
      mockAuthMiddlewareInstance.authenticate.mockImplementation((req, res, next) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .get('/api/auth/auth0/profile');

      expect(response.status).toBe(401);
    });
  });

  describe('Error handling', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/auth/auth0/complete-signup')
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });

    it('should handle missing request body', async () => {
      const response = await request(app)
        .post('/api/auth/auth0/verify-phone')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Integration flow', () => {
    it('should handle complete Auth0 signup and verification flow', async () => {
      // Step 1: Get authorization URL
      const mockAuthUrl = 'https://test-domain.auth0.com/authorize?client_id=test';
      mockAuth0ServiceInstance.getAuthorizationUrl.mockReturnValue(mockAuthUrl);

      const authUrlResponse = await request(app)
        .get('/api/auth/auth0/signup');

      expect(authUrlResponse.status).toBe(200);
      expect(authUrlResponse.body.data.authUrl).toBe(mockAuthUrl);

      // Step 2: Handle callback for new user
      const mockCallbackResult = {
        user: { id: 'new-user-123', email: 'test@example.com' },
        isNewUser: true,
        requiresPhoneVerification: true
      };

      mockAuth0ServiceInstance.exchangeCodeForTokens.mockResolvedValue(mockAuth0Profile);
      mockAuth0ServiceInstance.handleAuth0Callback.mockResolvedValue(mockCallbackResult);

      const callbackResponse = await request(app)
        .get('/api/auth/auth0/callback')
        .query({ code: 'auth-code' });

      expect(callbackResponse.status).toBe(302);
      expect(callbackResponse.headers.location).toContain('phone-verification');

      // Step 3: Complete signup with phone
      const mockSignupResult = { otpId: 'otp-123' };
      mockAuth0ServiceInstance.completeAuth0Signup.mockResolvedValue(mockSignupResult);

      const signupResponse = await request(app)
        .post('/api/auth/auth0/complete-signup')
        .send({ phone: '+1234567890' });

      expect(signupResponse.status).toBe(200);
      expect(signupResponse.body.data.otpId).toBe('otp-123');

      // Step 4: Verify phone
      const mockVerifyResult = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        user: { id: 'new-user-123', isPhoneVerified: true }
      };

      mockAuth0ServiceInstance.verifyAuth0Phone.mockResolvedValue(mockVerifyResult);

      const verifyResponse = await request(app)
        .post('/api/auth/auth0/verify-phone')
        .send({ otpId: 'otp-123', code: '123456' });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.data.user.isPhoneVerified).toBe(true);
    });
  });
});