import request from 'supertest';
import express from 'express';
import emailVerificationRoutes from '../email-verification.routes';
import { SendGridEmailService } from '../services/sendgrid-email.service';
import { AuthMiddleware } from '../auth.middleware';

// Mock dependencies
jest.mock('../services/sendgrid-email.service');
jest.mock('../auth.middleware');

const MockedSendGridEmailService = SendGridEmailService as jest.MockedClass<typeof SendGridEmailService>;
const MockedAuthMiddleware = AuthMiddleware as jest.MockedClass<typeof AuthMiddleware>;

describe('Email Verification Routes', () => {
  let app: express.Application;
  let mockEmailService: jest.Mocked<SendGridEmailService>;
  let mockAuthMiddleware: jest.Mocked<AuthMiddleware>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/auth/email', emailVerificationRoutes);

    // Setup mocks
    mockEmailService = new MockedSendGridEmailService() as jest.Mocked<SendGridEmailService>;
    mockAuthMiddleware = new MockedAuthMiddleware() as jest.Mocked<AuthMiddleware>;

    // Mock the authenticate middleware to pass through
    mockAuthMiddleware.authenticate = jest.fn((req, res, next) => {
      (req as any).user = { id: 'user-123', role: 'admin' };
      next();
    });

    // Replace the service instance
    (SendGridEmailService as any).mockImplementation(() => mockEmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /send-code', () => {
    const validPayload = {
      email: 'test@example.com',
      userId: '123e4567-e89b-12d3-a456-426614174000'
    };

    it('should send verification code successfully', async () => {
      const mockVerificationId = 'verification-123';
      mockEmailService.isEmailVerified.mockResolvedValue(false);
      mockEmailService.sendVerificationCode.mockResolvedValue(mockVerificationId);

      const response = await request(app)
        .post('/api/auth/email/send-code')
        .send(validPayload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          verificationId: mockVerificationId,
          message: 'Verification code sent to your email'
        }
      });
      expect(mockEmailService.sendVerificationCode).toHaveBeenCalledWith(
        validPayload.email,
        validPayload.userId
      );
    });

    it('should return error for already verified email', async () => {
      mockEmailService.isEmailVerified.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/email/send-code')
        .send(validPayload);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_VERIFIED',
          message: 'Email address is already verified'
        }
      });
    });

    it('should validate email format', async () => {
      const invalidPayload = {
        email: 'invalid-email',
        userId: validPayload.userId
      };

      const response = await request(app)
        .post('/api/auth/email/send-code')
        .send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle service errors', async () => {
      mockEmailService.isEmailVerified.mockResolvedValue(false);
      mockEmailService.sendVerificationCode.mockRejectedValue(new Error('SendGrid error'));

      const response = await request(app)
        .post('/api/auth/email/send-code')
        .send(validPayload);

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'SEND_CODE_FAILED',
          message: 'SendGrid error'
        }
      });
    });
  });

  describe('POST /verify-code', () => {
    const validPayload = {
      verificationId: '123e4567-e89b-12d3-a456-426614174000',
      code: '123456'
    };

    it('should verify code successfully', async () => {
      mockEmailService.verifyCode.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/email/verify-code')
        .send(validPayload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          verified: true,
          message: 'Email verified successfully'
        }
      });
      expect(mockEmailService.verifyCode).toHaveBeenCalledWith(
        validPayload.verificationId,
        validPayload.code
      );
    });

    it('should validate code format', async () => {
      const invalidPayload = {
        verificationId: validPayload.verificationId,
        code: '12345' // Too short
      };

      const response = await request(app)
        .post('/api/auth/email/verify-code')
        .send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle invalid verification code', async () => {
      mockEmailService.verifyCode.mockRejectedValue(new Error('Invalid or expired verification code'));

      const response = await request(app)
        .post('/api/auth/email/verify-code')
        .send(validPayload);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INVALID_OR_EXPIRED_CODE',
          message: 'Invalid or expired verification code'
        }
      });
    });
  });

  describe('POST /verify', () => {
    const validPayload = {
      email: 'test@example.com',
      code: '123456'
    };

    it('should verify email by code successfully', async () => {
      mockEmailService.verifyEmailByCode.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/email/verify')
        .send(validPayload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          verified: true,
          message: 'Email verified successfully'
        }
      });
      expect(mockEmailService.verifyEmailByCode).toHaveBeenCalledWith(
        validPayload.email,
        validPayload.code
      );
    });

    it('should validate email and code format', async () => {
      const invalidPayload = {
        email: 'invalid-email',
        code: 'abc123' // Non-numeric
      };

      const response = await request(app)
        .post('/api/auth/email/verify')
        .send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /resend-code', () => {
    const validPayload = {
      email: 'test@example.com',
      userId: '123e4567-e89b-12d3-a456-426614174000'
    };

    it('should resend verification code successfully', async () => {
      const mockVerificationId = 'verification-456';
      mockEmailService.isEmailVerified.mockResolvedValue(false);
      mockEmailService.resendVerificationCode.mockResolvedValue(mockVerificationId);

      const response = await request(app)
        .post('/api/auth/email/resend-code')
        .send(validPayload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          verificationId: mockVerificationId,
          message: 'Verification code resent to your email'
        }
      });
    });

    it('should handle rate limiting', async () => {
      mockEmailService.isEmailVerified.mockResolvedValue(false);
      mockEmailService.resendVerificationCode.mockRejectedValue(
        new Error('Please wait before requesting a new verification code')
      );

      const response = await request(app)
        .post('/api/auth/email/resend-code')
        .send(validPayload);

      expect(response.status).toBe(429);
      expect(response.body.error.code).toBe('RATE_LIMITED');
    });
  });

  describe('GET /status/:verificationId', () => {
    const mockVerificationId = '123e4567-e89b-12d3-a456-426614174000';

    it('should return verification status', async () => {
      const mockStatus = {
        id: mockVerificationId,
        userId: 'user-123',
        email: 'test@example.com',
        token: '123456',
        expiresAt: new Date(),
        isUsed: false,
        createdAt: new Date()
      };
      mockEmailService.getVerificationStatus.mockResolvedValue(mockStatus);

      const response = await request(app)
        .get(`/api/auth/email/status/${mockVerificationId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        id: mockStatus.id,
        email: mockStatus.email,
        isVerified: mockStatus.isUsed,
        expiresAt: mockStatus.expiresAt.toISOString(),
        createdAt: mockStatus.createdAt.toISOString()
      });
    });

    it('should return 404 for non-existent verification', async () => {
      mockEmailService.getVerificationStatus.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/auth/email/status/non-existent-id');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'VERIFICATION_NOT_FOUND',
          message: 'Verification not found'
        }
      });
    });
  });

  describe('GET /check/:email', () => {
    it('should check if email is verified', async () => {
      const email = 'test@example.com';
      mockEmailService.isEmailVerified.mockResolvedValue(true);

      const response = await request(app)
        .get(`/api/auth/email/check/${email}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          email,
          isVerified: true
        }
      });
    });

    it('should validate email format', async () => {
      const invalidEmail = 'invalid-email';

      const response = await request(app)
        .get(`/api/auth/email/check/${invalidEmail}`);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Invalid email format'
        }
      });
    });
  });

  describe('DELETE /cleanup', () => {
    it('should cleanup expired codes for admin user', async () => {
      mockEmailService.cleanupExpiredCodes.mockResolvedValue();

      const response = await request(app)
        .delete('/api/auth/email/cleanup')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: {
          message: 'Expired verification codes cleaned up successfully'
        }
      });
    });

    it('should deny access for non-admin user', async () => {
      mockAuthMiddleware.authenticate = jest.fn((req, res, next) => {
        (req as any).user = { id: 'user-123', role: 'user' };
        next();
      });

      const response = await request(app)
        .delete('/api/auth/email/cleanup')
        .set('Authorization', 'Bearer user-token');

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin privileges required'
        }
      });
    });
  });
});