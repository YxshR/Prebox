import request from 'supertest';
import express from 'express';
import loginRoutes from '../login.routes';
import { SessionManagementService } from '../services/session-management.service';
import { PhoneVerificationService } from '../phone-verification.service';
import { Auth0Service } from '../auth0.service';
import pool from '../../config/database';

// Mock dependencies
jest.mock('../services/session-management.service');
jest.mock('../phone-verification.service');
jest.mock('../auth0.service');
jest.mock('../../config/database');

const app = express();
app.use(express.json());
app.use('/api/auth/login', loginRoutes);

describe('Login Routes', () => {
  let mockSessionService: jest.Mocked<SessionManagementService>;
  let mockPhoneService: jest.Mocked<PhoneVerificationService>;
  let mockAuth0Service: jest.Mocked<Auth0Service>;
  let mockPool: jest.Mocked<typeof pool>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSessionService = new SessionManagementService() as jest.Mocked<SessionManagementService>;
    mockPhoneService = new PhoneVerificationService() as jest.Mocked<PhoneVerificationService>;
    mockAuth0Service = new Auth0Service() as jest.Mocked<Auth0Service>;
    mockPool = pool as jest.Mocked<typeof pool>;

    // Mock SessionManagementService constructor
    (SessionManagementService as jest.Mock).mockImplementation(() => mockSessionService);
    (PhoneVerificationService as jest.Mock).mockImplementation(() => mockPhoneService);
    (Auth0Service as jest.Mock).mockImplementation(() => mockAuth0Service);
  });

  describe('POST /api/auth/login/email', () => {
    const validCredentials = {
      email: 'test@example.com',
      password: 'password123'
    };

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      phone: '+1234567890',
      firstName: 'Test',
      lastName: 'User',
      tenantId: 'tenant-123',
      role: 'user',
      subscriptionTier: 'free',
      isEmailVerified: true,
      isPhoneVerified: true,
      createdAt: new Date(),
      lastLoginAt: new Date()
    };

    const mockAuthToken = {
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
      expiresIn: 900,
      user: mockUser
    };

    it('should login successfully with valid credentials', async () => {
      // Mock database query for user lookup
      mockPool.query.mockResolvedValue({
        rows: [{
          id: mockUser.id,
          email: mockUser.email,
          password_hash: '$2a$12$hashedpassword',
          first_name: mockUser.firstName,
          last_name: mockUser.lastName,
          tenant_id: mockUser.tenantId,
          role: mockUser.role,
          subscription_tier: mockUser.subscriptionTier,
          is_email_verified: mockUser.isEmailVerified,
          is_phone_verified: mockUser.isPhoneVerified,
          created_at: mockUser.createdAt,
          last_login_at: mockUser.lastLoginAt
        }]
      });

      // Mock bcrypt comparison
      const bcrypt = require('bcryptjs');
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

      // Mock session creation
      mockSessionService.createSession.mockResolvedValue(mockAuthToken);

      const response = await request(app)
        .post('/api/auth/login/email')
        .send(validCredentials)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          ...mockAuthToken,
          loginMethod: 'email_password'
        }
      });

      expect(mockSessionService.createSession).toHaveBeenCalledWith({
        user: expect.objectContaining({
          id: mockUser.id,
          email: mockUser.email
        }),
        ipAddress: expect.any(String),
        userAgent: expect.any(String)
      });
    });

    it('should reject invalid credentials', async () => {
      // Mock database query returning no user
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/api/auth/login/email')
        .send(validCredentials)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'LOGIN_FAILED',
          message: 'Invalid email or password'
        }
      });
    });

    it('should reject Auth0 users', async () => {
      // Mock database query returning Auth0 user
      mockPool.query.mockResolvedValue({
        rows: [{
          ...mockUser,
          auth0_id: 'auth0|123456',
          password_hash: null
        }]
      });

      const response = await request(app)
        .post('/api/auth/login/email')
        .send(validCredentials)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'LOGIN_FAILED',
          message: 'This account uses Auth0 authentication. Please login through Auth0.'
        }
      });
    });

    it('should validate input parameters', async () => {
      const invalidCredentials = {
        email: 'invalid-email',
        password: ''
      };

      const response = await request(app)
        .post('/api/auth/login/email')
        .send(invalidCredentials)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.stringContaining('email'),
          field: 'email'
        }
      });
    });
  });

  describe('POST /api/auth/login/phone', () => {
    const validPhone = '+1234567890';

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      phone: validPhone,
      is_phone_verified: true
    };

    it('should send OTP for valid phone number', async () => {
      // Mock database query for user lookup
      mockPool.query.mockResolvedValue({
        rows: [mockUser]
      });

      // Mock OTP sending
      mockPhoneService.sendOTP.mockResolvedValue('otp-123');

      const response = await request(app)
        .post('/api/auth/login/phone')
        .send({ phone: validPhone })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          otpId: 'otp-123',
          message: 'OTP sent to your phone number'
        }
      });

      expect(mockPhoneService.sendOTP).toHaveBeenCalledWith(
        mockUser.id,
        validPhone,
        'login'
      );
    });

    it('should reject unverified phone numbers', async () => {
      // Mock database query returning no verified user
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/api/auth/login/phone')
        .send({ phone: validPhone })
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'PHONE_NOT_FOUND',
          message: 'No verified account found with this phone number'
        }
      });
    });

    it('should validate phone number format', async () => {
      const response = await request(app)
        .post('/api/auth/login/phone')
        .send({ phone: '123' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login/phone/verify', () => {
    const validOtpRequest = {
      otpId: '550e8400-e29b-41d4-a716-446655440000',
      code: '123456'
    };

    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      phone: '+1234567890',
      first_name: 'Test',
      last_name: 'User',
      tenant_id: 'tenant-123',
      role: 'user',
      subscription_tier: 'free',
      is_email_verified: true,
      is_phone_verified: true,
      created_at: new Date(),
      last_login_at: new Date()
    };

    const mockAuthToken = {
      accessToken: 'access-token-123',
      refreshToken: 'refresh-token-123',
      expiresIn: 900,
      user: mockUser
    };

    it('should verify OTP and login successfully', async () => {
      // Mock OTP verification query
      mockPool.query
        .mockResolvedValueOnce({ // OTP verification query
          rows: [{
            ...mockUser,
            code: validOtpRequest.code,
            type: 'login',
            is_used: false,
            expires_at: new Date(Date.now() + 600000)
          }]
        })
        .mockResolvedValueOnce({ rows: [] }); // Mark OTP as used

      // Mock session creation
      mockSessionService.createSession.mockResolvedValue(mockAuthToken);

      const response = await request(app)
        .post('/api/auth/login/phone/verify')
        .send(validOtpRequest)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          ...mockAuthToken,
          loginMethod: 'phone_otp'
        }
      });

      expect(mockSessionService.createSession).toHaveBeenCalledWith({
        user: expect.objectContaining({
          id: mockUser.id,
          phone: mockUser.phone
        }),
        ipAddress: expect.any(String),
        userAgent: expect.any(String)
      });
    });

    it('should reject invalid OTP', async () => {
      // Mock OTP verification query returning no results
      mockPool.query.mockResolvedValue({ rows: [] });

      const response = await request(app)
        .post('/api/auth/login/phone/verify')
        .send(validOtpRequest)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INVALID_OTP',
          message: 'Invalid or expired OTP'
        }
      });
    });

    it('should validate OTP format', async () => {
      const invalidOtpRequest = {
        otpId: 'invalid-uuid',
        code: '12345' // Wrong length
      };

      const response = await request(app)
        .post('/api/auth/login/phone/verify')
        .send(invalidOtpRequest)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/auth/login/auth0', () => {
    it('should return Auth0 authorization URL', async () => {
      const mockAuthUrl = 'https://auth0.com/authorize?client_id=123&redirect_uri=...';
      mockAuth0Service.getAuthorizationUrl.mockReturnValue(mockAuthUrl);

      const response = await request(app)
        .get('/api/auth/login/auth0')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          authUrl: mockAuthUrl,
          loginMethod: 'auth0'
        }
      });

      expect(mockAuth0Service.getAuthorizationUrl).toHaveBeenCalledWith('login');
    });

    it('should handle Auth0 service errors', async () => {
      mockAuth0Service.getAuthorizationUrl.mockImplementation(() => {
        throw new Error('Auth0 configuration error');
      });

      const response = await request(app)
        .get('/api/auth/login/auth0')
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'AUTH0_URL_GENERATION_FAILED',
          message: 'Auth0 configuration error'
        }
      });
    });
  });

  describe('POST /api/auth/refresh', () => {
    const validRefreshRequest = {
      refreshToken: 'valid-refresh-token'
    };

    const mockAuthToken = {
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresIn: 900,
      user: {
        id: 'user-123',
        email: 'test@example.com'
      }
    };

    it('should refresh token successfully', async () => {
      mockSessionService.refreshSession.mockResolvedValue(mockAuthToken);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send(validRefreshRequest)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockAuthToken
      });

      expect(mockSessionService.refreshSession).toHaveBeenCalledWith(
        validRefreshRequest.refreshToken,
        expect.any(String)
      );
    });

    it('should reject invalid refresh token', async () => {
      mockSessionService.refreshSession.mockRejectedValue(
        new Error('Invalid refresh token')
      );

      const response = await request(app)
        .post('/api/auth/refresh')
        .send(validRefreshRequest)
        .expect(401);

      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'REFRESH_FAILED',
          message: 'Invalid refresh token'
        }
      });
    });

    it('should validate refresh token parameter', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});