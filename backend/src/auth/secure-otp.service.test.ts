import { SecureOTPService, OTPGenerationResult, OTPValidationResult } from './secure-otp.service';
import pool from '../config/database';
import redisClient from '../config/redis';
import { jest } from '@jest/globals';

// Mock Twilio
jest.mock('twilio', () => ({
  Twilio: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({ sid: 'mock-sid' })
    },
    api: {
      accounts: jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue({ status: 'active' })
      })
    }
  }))
}));

describe('SecureOTPService', () => {
  let otpService: SecureOTPService;
  let testPhoneNumber: string;
  let testUserId: string;

  beforeAll(async () => {
    // Connect to Redis if not already connected
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  });

  beforeEach(async () => {
    otpService = new SecureOTPService({
      expiryMinutes: 10,
      maxAttempts: 3,
      rateLimitWindow: 60,
      maxOTPsPerWindow: 5,
      codeLength: 6
    });

    testPhoneNumber = '+1234567890';
    testUserId = 'test-user-id-' + Date.now();

    // Clean up any existing test data
    await pool.query('DELETE FROM otp_verifications WHERE phone_number = $1', [testPhoneNumber]);
    await redisClient.del(`otp_rate_limit:${testPhoneNumber}`);
    await redisClient.del(`otp_attempts:${testPhoneNumber}:registration`);
  });

  afterEach(async () => {
    // Clean up test data
    await pool.query('DELETE FROM otp_verifications WHERE phone_number = $1', [testPhoneNumber]);
    await redisClient.del(`otp_rate_limit:${testPhoneNumber}`);
    await redisClient.del(`otp_attempts:${testPhoneNumber}:registration`);
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  describe('generateOTP', () => {
    it('should generate OTP successfully with valid parameters', async () => {
      const result: OTPGenerationResult = await otpService.generateOTP(
        testPhoneNumber,
        'registration',
        testUserId
      );

      expect(result).toHaveProperty('otpId');
      expect(result).toHaveProperty('expiresAt');
      expect(result).toHaveProperty('attemptsRemaining');
      expect(result.attemptsRemaining).toBe(3);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should store OTP in database with correct structure', async () => {
      const result = await otpService.generateOTP(testPhoneNumber, 'registration', testUserId);

      const dbResult = await pool.query(
        'SELECT * FROM otp_verifications WHERE id = $1',
        [result.otpId]
      );

      expect(dbResult.rows).toHaveLength(1);
      const otp = dbResult.rows[0];
      expect(otp.phone_number).toBe(testPhoneNumber);
      expect(otp.type).toBe('registration');
      expect(otp.user_id).toBe(testUserId);
      expect(otp.is_used).toBe(false);
      expect(otp.attempts).toBe(0);
      expect(otp.max_attempts).toBe(3);
    });

    it('should enforce rate limiting', async () => {
      // Generate maximum allowed OTPs
      for (let i = 0; i < 5; i++) {
        await otpService.generateOTP(testPhoneNumber, 'registration', testUserId);
      }

      // Next attempt should fail
      await expect(
        otpService.generateOTP(testPhoneNumber, 'registration', testUserId)
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should generate cryptographically secure codes', async () => {
      const codes = new Set();
      
      // Generate multiple OTPs and ensure they're unique
      for (let i = 0; i < 10; i++) {
        const phoneNumber = `+123456789${i}`;
        const result = await otpService.generateOTP(phoneNumber, 'registration');
        
        // Get the actual code from database (it's hashed, so we can't compare directly)
        const dbResult = await pool.query(
          'SELECT otp_code FROM otp_verifications WHERE id = $1',
          [result.otpId]
        );
        
        const hashedCode = dbResult.rows[0].otp_code;
        expect(codes.has(hashedCode)).toBe(false);
        codes.add(hashedCode);
      }
    });
  });

  describe('validateOTP', () => {
    let otpId: string;
    let actualCode: string;

    beforeEach(async () => {
      // Generate OTP and extract the actual code for testing
      const result = await otpService.generateOTP(testPhoneNumber, 'registration', testUserId);
      otpId = result.otpId;
      
      // For testing, we need to mock the code generation to get a known value
      // We'll patch the private method temporarily
      actualCode = '123456'; // Known test code
      
      // Update the database with our test code hash
      const crypto = require('crypto');
      const hashedCode = crypto.createHash('sha256')
        .update(actualCode + process.env.JWT_SECRET)
        .digest('hex');
      
      await pool.query(
        'UPDATE otp_verifications SET otp_code = $1 WHERE id = $2',
        [hashedCode, otpId]
      );
    });

    it('should validate correct OTP successfully', async () => {
      const result: OTPValidationResult = await otpService.validateOTP(otpId, actualCode);

      expect(result.isValid).toBe(true);
      expect(result.userId).toBe(testUserId);
      expect(result.isExpired).toBe(false);
      expect(result.isRateLimited).toBe(false);
      expect(result.attemptsRemaining).toBe(3);
    });

    it('should reject incorrect OTP', async () => {
      const result = await otpService.validateOTP(otpId, '999999');

      expect(result.isValid).toBe(false);
      expect(result.attemptsRemaining).toBe(2);
      expect(result.isExpired).toBe(false);
      expect(result.isRateLimited).toBe(false);
      expect(result.errorMessage).toContain('Invalid OTP');
    });

    it('should handle expired OTP', async () => {
      // Set OTP as expired
      await pool.query(
        'UPDATE otp_verifications SET expires_at = $1 WHERE id = $2',
        [new Date(Date.now() - 1000), otpId]
      );

      const result = await otpService.validateOTP(otpId, actualCode);

      expect(result.isValid).toBe(false);
      expect(result.isExpired).toBe(true);
      expect(result.errorMessage).toBe('OTP has expired');
    });

    it('should enforce maximum attempts', async () => {
      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        await otpService.validateOTP(otpId, '999999');
      }

      // Next attempt should be rate limited
      const result = await otpService.validateOTP(otpId, actualCode);

      expect(result.isValid).toBe(false);
      expect(result.isRateLimited).toBe(true);
      expect(result.attemptsRemaining).toBe(0);
      expect(result.errorMessage).toBe('Maximum attempts exceeded');
    });

    it('should mark OTP as used after successful validation', async () => {
      await otpService.validateOTP(otpId, actualCode);

      const dbResult = await pool.query(
        'SELECT is_used FROM otp_verifications WHERE id = $1',
        [otpId]
      );

      expect(dbResult.rows[0].is_used).toBe(true);
    });

    it('should not allow reuse of validated OTP', async () => {
      // First validation should succeed
      const firstResult = await otpService.validateOTP(otpId, actualCode);
      expect(firstResult.isValid).toBe(true);

      // Second validation should fail
      const secondResult = await otpService.validateOTP(otpId, actualCode);
      expect(secondResult.isValid).toBe(false);
      expect(secondResult.errorMessage).toBe('OTP not found or already used');
    });
  });

  describe('resendOTP', () => {
    let otpId: string;

    beforeEach(async () => {
      const result = await otpService.generateOTP(testPhoneNumber, 'registration', testUserId);
      otpId = result.otpId;
    });

    it('should generate new OTP when resending', async () => {
      // Wait a bit to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1100));

      const newResult = await otpService.resendOTP(otpId);

      expect(newResult.otpId).not.toBe(otpId);
      expect(newResult.expiresAt).toBeInstanceOf(Date);

      // Original OTP should be marked as used
      const dbResult = await pool.query(
        'SELECT is_used FROM otp_verifications WHERE id = $1',
        [otpId]
      );
      expect(dbResult.rows[0].is_used).toBe(true);
    });

    it('should enforce resend rate limiting', async () => {
      await expect(otpService.resendOTP(otpId)).rejects.toThrow(
        'Please wait before requesting a new code'
      );
    });

    it('should fail for non-existent OTP', async () => {
      await expect(otpService.resendOTP('non-existent-id')).rejects.toThrow(
        'OTP not found or already used'
      );
    });
  });

  describe('getOTPAttemptInfo', () => {
    it('should return correct attempt information', async () => {
      const result = await otpService.generateOTP(testPhoneNumber, 'registration', testUserId);
      
      const attemptInfo = await otpService.getOTPAttemptInfo(testPhoneNumber, 'registration');

      expect(attemptInfo.attempts).toBe(0);
      expect(attemptInfo.maxAttempts).toBe(3);
      expect(attemptInfo.isBlocked).toBe(false);
      expect(attemptInfo.lastAttemptAt).toBeInstanceOf(Date);
    });

    it('should return default info for non-existent phone', async () => {
      const attemptInfo = await otpService.getOTPAttemptInfo('+9999999999', 'registration');

      expect(attemptInfo.attempts).toBe(0);
      expect(attemptInfo.maxAttempts).toBe(3);
      expect(attemptInfo.isBlocked).toBe(false);
    });
  });

  describe('cleanupExpiredOTPs', () => {
    it('should clean up expired OTPs', async () => {
      // Create an expired OTP
      const result = await otpService.generateOTP(testPhoneNumber, 'registration', testUserId);
      
      // Set it as expired
      await pool.query(
        'UPDATE otp_verifications SET expires_at = $1 WHERE id = $2',
        [new Date(Date.now() - 1000), result.otpId]
      );

      const cleanupResult = await otpService.cleanupExpiredOTPs();

      expect(cleanupResult.deletedCount).toBeGreaterThan(0);
      
      // Verify OTP was deleted
      const dbResult = await pool.query(
        'SELECT * FROM otp_verifications WHERE id = $1',
        [result.otpId]
      );
      expect(dbResult.rows).toHaveLength(0);
    });

    it('should clean up used OTPs', async () => {
      const result = await otpService.generateOTP(testPhoneNumber, 'registration', testUserId);
      
      // Mark as used
      await pool.query(
        'UPDATE otp_verifications SET is_used = true WHERE id = $1',
        [result.otpId]
      );

      const cleanupResult = await otpService.cleanupExpiredOTPs();

      expect(cleanupResult.deletedCount).toBeGreaterThan(0);
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status', async () => {
      const health = await otpService.getHealthStatus();

      expect(health).toHaveProperty('database');
      expect(health).toHaveProperty('redis');
      expect(health).toHaveProperty('twilio');
      expect(health).toHaveProperty('activeOTPs');
      expect(typeof health.activeOTPs).toBe('number');
    });
  });

  describe('Security Features', () => {
    it('should use timing-safe comparison for OTP validation', async () => {
      const result = await otpService.generateOTP(testPhoneNumber, 'registration', testUserId);
      
      // This test ensures timing attacks are prevented
      const startTime = process.hrtime.bigint();
      await otpService.validateOTP(result.otpId, '000000');
      const endTime = process.hrtime.bigint();
      
      const duration1 = Number(endTime - startTime);
      
      const startTime2 = process.hrtime.bigint();
      await otpService.validateOTP(result.otpId, '999999');
      const endTime2 = process.hrtime.bigint();
      
      const duration2 = Number(endTime2 - startTime2);
      
      // Timing should be similar (within reasonable variance)
      const timingDifference = Math.abs(duration1 - duration2);
      const averageTime = (duration1 + duration2) / 2;
      const variance = timingDifference / averageTime;
      
      // Allow up to 50% variance (generous for test environment)
      expect(variance).toBeLessThan(0.5);
    });

    it('should hash OTP codes in database', async () => {
      const result = await otpService.generateOTP(testPhoneNumber, 'registration', testUserId);
      
      const dbResult = await pool.query(
        'SELECT otp_code FROM otp_verifications WHERE id = $1',
        [result.otpId]
      );
      
      const storedCode = dbResult.rows[0].otp_code;
      
      // Should be a hex string (hash)
      expect(storedCode).toMatch(/^[a-f0-9]{64}$/);
      
      // Should not be a plain 6-digit number
      expect(storedCode).not.toMatch(/^\d{6}$/);
    });

    it('should prevent OTP code enumeration', async () => {
      const result = await otpService.generateOTP(testPhoneNumber, 'registration', testUserId);
      
      // Multiple wrong attempts should not reveal information about the correct code
      const wrongCodes = ['000000', '111111', '222222', '333333'];
      
      for (const code of wrongCodes) {
        const validationResult = await otpService.validateOTP(result.otpId, code);
        expect(validationResult.isValid).toBe(false);
        expect(validationResult.errorMessage).toContain('Invalid OTP');
      }
    });
  });
});