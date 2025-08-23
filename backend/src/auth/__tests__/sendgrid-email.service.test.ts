import { SendGridEmailService } from '../services/sendgrid-email.service';
import pool from '../../config/database';
import sgMail from '@sendgrid/mail';

// Mock SendGrid
jest.mock('@sendgrid/mail');
const mockSgMail = sgMail as jest.Mocked<typeof sgMail>;

// Mock database
jest.mock('../../config/database');
const mockPool = pool as jest.Mocked<typeof pool>;

describe('SendGridEmailService', () => {
  let emailService: SendGridEmailService;
  const mockEmail = 'test@example.com';
  const mockUserId = '123e4567-e89b-12d3-a456-426614174000';
  const mockVerificationId = '987fcdeb-51a2-43d1-b789-123456789abc';

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.SENDGRID_API_KEY = 'test-api-key';
    process.env.SENDGRID_FROM_EMAIL = 'noreply@test.com';
    
    emailService = new SendGridEmailService();
  });

  afterEach(() => {
    delete process.env.SENDGRID_API_KEY;
    delete process.env.SENDGRID_FROM_EMAIL;
  });

  describe('constructor', () => {
    it('should throw error if SENDGRID_API_KEY is not provided', () => {
      delete process.env.SENDGRID_API_KEY;
      
      expect(() => {
        new SendGridEmailService();
      }).toThrow('SENDGRID_API_KEY environment variable is required');
    });

    it('should set SendGrid API key', () => {
      expect(mockSgMail.setApiKey).toHaveBeenCalledWith('test-api-key');
    });
  });

  describe('sendVerificationCode', () => {
    beforeEach(() => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);
      mockSgMail.send.mockResolvedValue([{} as any, {}]);
    });

    it('should send verification code successfully', async () => {
      const verificationId = await emailService.sendVerificationCode(mockEmail, mockUserId);

      expect(verificationId).toBeDefined();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO email_verifications'),
        expect.arrayContaining([
          expect.any(String), // verificationId
          mockUserId,
          mockEmail,
          expect.stringMatching(/^\d{6}$/), // 6-digit code
          expect.any(Date), // expiresAt
          null, // verified_at
          expect.any(Date) // created_at
        ])
      );
      expect(mockSgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockEmail,
          from: 'noreply@test.com',
          subject: 'Email Verification Code',
          html: expect.stringContaining('Verify Your Email Address'),
          text: expect.stringContaining('Verification Code:')
        })
      );
    });

    it('should handle SendGrid send failure', async () => {
      const mockError = new Error('SendGrid API error');
      mockSgMail.send.mockRejectedValue(mockError);

      await expect(emailService.sendVerificationCode(mockEmail, mockUserId))
        .rejects.toThrow('Failed to send verification email');

      // Should clean up database entry on failure
      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM email_verifications WHERE id = $1',
        [expect.any(String)]
      );
    });

    it('should generate 6-digit verification code', async () => {
      await emailService.sendVerificationCode(mockEmail, mockUserId);

      const insertCall = mockPool.query.mock.calls.find(call => 
        call[0].includes('INSERT INTO email_verifications')
      );
      const verificationCode = insertCall?.[1]?.[3];
      
      expect(verificationCode).toMatch(/^\d{6}$/);
      expect(parseInt(verificationCode)).toBeGreaterThanOrEqual(100000);
      expect(parseInt(verificationCode)).toBeLessThanOrEqual(999999);
    });
  });

  describe('verifyCode', () => {
    it('should verify code successfully', async () => {
      const mockVerification = {
        id: mockVerificationId,
        user_id: mockUserId,
        email: mockEmail,
        verification_code: '123456',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        verified_at: null,
        created_at: new Date()
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [mockVerification] } as any) // SELECT query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // UPDATE email_verifications
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // UPDATE users

      const result = await emailService.verifyCode(mockVerificationId, '123456');

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE email_verifications SET verified_at = NOW()'),
        [mockVerificationId]
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET email_verified = true'),
        [mockUserId]
      );
    });

    it('should throw error for invalid code', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as any);

      await expect(emailService.verifyCode(mockVerificationId, '999999'))
        .rejects.toThrow('Invalid or expired verification code');
    });

    it('should throw error for expired code', async () => {
      const expiredVerification = {
        id: mockVerificationId,
        user_id: mockUserId,
        email: mockEmail,
        verification_code: '123456',
        expires_at: new Date(Date.now() - 1000), // Expired
        verified_at: null,
        created_at: new Date()
      };

      mockPool.query.mockResolvedValue({ rows: [] } as any); // No rows returned for expired code

      await expect(emailService.verifyCode(mockVerificationId, '123456'))
        .rejects.toThrow('Invalid or expired verification code');
    });
  });

  describe('verifyEmailByCode', () => {
    it('should verify email by code successfully', async () => {
      const mockVerification = {
        id: mockVerificationId,
        user_id: mockUserId,
        email: mockEmail,
        verification_code: '123456',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        verified_at: null,
        created_at: new Date()
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [mockVerification] } as any) // SELECT query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // UPDATE email_verifications
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any); // UPDATE users

      const result = await emailService.verifyEmailByCode(mockEmail, '123456');

      expect(result).toBe(true);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE email = $1 AND verification_code = $2'),
        [mockEmail, '123456']
      );
    });

    it('should throw error for invalid email/code combination', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as any);

      await expect(emailService.verifyEmailByCode(mockEmail, '999999'))
        .rejects.toThrow('Invalid or expired verification code');
    });
  });

  describe('resendVerificationCode', () => {
    it('should resend verification code successfully', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [] } as any) // No recent attempts
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Invalidate existing codes
        .mockResolvedValueOnce({ rows: [], rowCount: 1 } as any) // Insert new code
      
      mockSgMail.send.mockResolvedValue([{} as any, {}]);

      const verificationId = await emailService.resendVerificationCode(mockEmail, mockUserId);

      expect(verificationId).toBeDefined();
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE email_verifications SET verified_at = NOW()'),
        [mockEmail]
      );
    });

    it('should throw error for rate limiting', async () => {
      const recentAttempt = {
        created_at: new Date()
      };
      mockPool.query.mockResolvedValue({ rows: [recentAttempt] } as any);

      await expect(emailService.resendVerificationCode(mockEmail, mockUserId))
        .rejects.toThrow('Please wait before requesting a new verification code');
    });
  });

  describe('getVerificationStatus', () => {
    it('should return verification status', async () => {
      const mockVerification = {
        id: mockVerificationId,
        user_id: mockUserId,
        email: mockEmail,
        verification_code: '123456',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
        verified_at: null,
        created_at: new Date()
      };

      mockPool.query.mockResolvedValue({ rows: [mockVerification] } as any);

      const status = await emailService.getVerificationStatus(mockVerificationId);

      expect(status).toEqual({
        id: mockVerificationId,
        userId: mockUserId,
        email: mockEmail,
        token: '123456',
        expiresAt: expect.any(Date),
        isUsed: false,
        createdAt: expect.any(Date)
      });
    });

    it('should return null for non-existent verification', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as any);

      const status = await emailService.getVerificationStatus('non-existent-id');

      expect(status).toBeNull();
    });
  });

  describe('isEmailVerified', () => {
    it('should return true for verified email', async () => {
      const mockVerification = {
        verified_at: new Date()
      };
      mockPool.query.mockResolvedValue({ rows: [mockVerification] } as any);

      const isVerified = await emailService.isEmailVerified(mockEmail);

      expect(isVerified).toBe(true);
    });

    it('should return false for unverified email', async () => {
      mockPool.query.mockResolvedValue({ rows: [] } as any);

      const isVerified = await emailService.isEmailVerified(mockEmail);

      expect(isVerified).toBe(false);
    });
  });

  describe('cleanupExpiredCodes', () => {
    it('should clean up expired codes', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 5 } as any);

      await emailService.cleanupExpiredCodes();

      expect(mockPool.query).toHaveBeenCalledWith(
        'DELETE FROM email_verifications WHERE expires_at < NOW()'
      );
    });
  });

  describe('email templates', () => {
    it('should generate HTML template with verification code', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);
      mockSgMail.send.mockResolvedValue([{} as any, {}]);

      await emailService.sendVerificationCode(mockEmail, mockUserId);

      const sendCall = mockSgMail.send.mock.calls[0][0];
      expect(sendCall.html).toContain('Verify Your Email Address');
      expect(sendCall.html).toMatch(/\d{6}/); // Contains 6-digit code
      expect(sendCall.html).toContain('24 hours'); // Expiry information
    });

    it('should generate text template with verification code', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);
      mockSgMail.send.mockResolvedValue([{} as any, {}]);

      await emailService.sendVerificationCode(mockEmail, mockUserId);

      const sendCall = mockSgMail.send.mock.calls[0][0];
      expect(sendCall.text).toContain('Verification Code:');
      expect(sendCall.text).toMatch(/\d{6}/); // Contains 6-digit code
      expect(sendCall.text).toContain('24 hours'); // Expiry information
    });
  });
});