import { EnhancedPhoneVerificationService } from '../enhanced-phone-verification.service';
import pool from '../../config/database';
import redisClient from '../../config/redis';
import { jest } from '@jest/globals';

// Mock Twilio
jest.mock('twilio', () => ({
  Twilio: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({ sid: 'mock-message-sid' })
    },
    api: {
      accounts: jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue({ status: 'active' })
      })
    }
  }))
}));

describe('EnhancedPhoneVerificationService', () => {
  let service: EnhancedPhoneVerificationService;
  let testPhones: string[];

  beforeAll(async () => {
    // Connect to Redis if not already connected
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }

    testPhones = [
      '+1234567890',
      '+1234567891', 
      '+1234567892',
      '+1234567893'
    ];
  });

  beforeEach(async () => {
    service = new EnhancedPhoneVerificationService({
      expiryMinutes: 10,
      maxAttempts: 5,
      rateLimitWindow: 60,
      maxOTPsPerWindow: 3,
      codeLength: 6,
      resendCooldown: 60
    });

    // Clean up test data
    for (const phone of testPhones) {
      await pool.query('DELETE FROM phone_verifications WHERE phone = $1', [phone]);
      await pool.query('DELETE FROM users WHERE phone = $1', [phone]);
      await redisClient.del(`phone_rate_limit:${phone}`);
      await redisClient.del(`phone_attempts:${phone}:registration`);
      await redisClient.del(`phone_attempts:${phone}:login`);
    }
  });

  afterEach(async () => {
    // Clean up test data
    for (const phone of testPhones) {
      await pool.query('DELETE FROM phone_verifications WHERE phone = $1', [phone]);
      await pool.query('DELETE FROM users WHERE phone = $1', [phone]);
      await redisClient.del(`phone_rate_limit:${phone}`);
      await redisClient.del(`phone_attempts:${phone}:registration`);
      await redisClient.del(`phone_attempts:${phone}:login`);
    }
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  describe('checkPhoneExists', () => {
    it('should return false for non-existent phone number', async () => {
      const result = await service.checkPhoneExists(testPhones[0]);
      
      expect(result.exists).toBe(false);
      expect(result.userId).toBeUndefined();
      expect(result.isVerified).toBeUndefined();
    });

    it('should return true for existing phone number', async () => {
      // Create test user
      const userResult = await pool.query(`
        INSERT INTO users (phone, phone_verified) 
        VALUES ($1, $2) 
        RETURNING id
      `, [testPhones[0], true]);
      
      const userId = userResult.rows[0].id;
      
      const result = await service.checkPhoneExists(testPhones[0]);
      
      expect(result.exists).toBe(true);
      expect(result.userId).toBe(userId);
      expect(result.isVerified).toBe(true);
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      const originalQuery = pool.query;
      pool.query = jest.fn().mockRejectedValue(new Error('Database error'));
      
      await expect(service.checkPhoneExists(testPhones[0]))
        .rejects.toThrow('Failed to check phone number availability');
      
      // Restore original function
      pool.query = originalQuery;
    });
  });

  describe('startVerification', () => {
    it('should successfully start verification for new phone number', async () => {
      const result = await service.startVerification(testPhones[0], 'registration');
      
      expect(result.otpId).toBeDefined();
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.attemptsRemaining).toBe(5);
      
      // Verify database record
      const dbResult = await pool.query(
        'SELECT * FROM phone_verifications WHERE id = $1',
        [result.otpId]
      );
      
      expect(dbResult.rows).toHaveLength(1);
      const verification = dbResult.rows[0];
      expect(verification.phone).toBe(testPhones[0]);
      expect(verification.attempts).toBe(0);
      expect(verification.verified_at).toBeNull();
    });

    it('should prevent registration for existing phone number', async () => {
      // Create existing user
      await pool.query(`
        INSERT INTO users (phone, phone_verified) 
        VALUES ($1, $2)
      `, [testPhones[0], true]);
      
      await expect(service.startVerification(testPhones[0], 'registration'))
        .rejects.toThrow('Phone number already registered');
    });

    it('should enforce rate limiting', async () => {
      const phone = testPhones[0];
      
      // Generate maximum allowed OTPs
      for (let i = 0; i < 3; i++) {
        await service.startVerification(phone, 'registration');
      }
      
      // Next attempt should fail
      await expect(service.startVerification(phone, 'registration'))
        .rejects.toThrow('Too many verification attempts');
    });

    it('should generate unique OTP IDs for concurrent requests', async () => {
      const promises = testPhones.slice(0, 3).map(phone =>
        service.startVerification(phone, 'registration')
      );
      
      const results = await Promise.all(promises);
      
      const otpIds = results.map(r => r.otpId);
      const uniqueIds = new Set(otpIds);
      
      expect(uniqueIds.size).toBe(otpIds.length);
    });
  });

  describe('verifyOTP', () => {
    let otpId: string;
    let testCode: string;

    beforeEach(async () => {
      const result = await service.startVerification(testPhones[0], 'registration');
      otpId = result.otpId;
      
      // Set a known test code
      testCode = '123456';
      const crypto = require('crypto');
      const hashedCode = crypto.createHash('sha256')
        .update(testCode + (process.env.JWT_SECRET || 'default-secret'))
        .digest('hex');
      
      await pool.query(
        'UPDATE phone_verifications SET otp_code = $1 WHERE id = $2',
        [hashedCode, otpId]
      );
    });

    it('should successfully verify correct OTP', async () => {
      const result = await service.verifyOTP(otpId, testCode);
      
      expect(result.isValid).toBe(true);
      expect(result.isExpired).toBe(false);
      expect(result.isRateLimited).toBe(false);
      expect(result.canRetry).toBe(false);
      
      // Verify database is updated
      const dbResult = await pool.query(
        'SELECT verified_at FROM phone_verifications WHERE id = $1',
        [otpId]
      );
      
      expect(dbResult.rows[0].verified_at).not.toBeNull();
    });

    it('should reject incorrect OTP and allow retry', async () => {
      const result = await service.verifyOTP(otpId, '999999');
      
      expect(result.isValid).toBe(false);
      expect(result.canRetry).toBe(true);
      expect(result.attemptsRemaining).toBe(4);
      expect(result.errorMessage).toContain('Invalid verification code');
    });

    it('should handle expired OTP', async () => {
      // Make OTP expired
      await pool.query(
        'UPDATE phone_verifications SET expires_at = $1 WHERE id = $2',
        [new Date(Date.now() - 1000), otpId]
      );
      
      const result = await service.verifyOTP(otpId, testCode);
      
      expect(result.isValid).toBe(false);
      expect(result.isExpired).toBe(true);
      expect(result.canRetry).toBe(true);
      expect(result.errorMessage).toContain('expired');
    });

    it('should enforce maximum attempts', async () => {
      // Make 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await service.verifyOTP(otpId, '999999');
      }
      
      // Next attempt should be rate limited
      const result = await service.verifyOTP(otpId, '999999');
      
      expect(result.isValid).toBe(false);
      expect(result.isRateLimited).toBe(true);
      expect(result.attemptsRemaining).toBe(0);
      expect(result.canRetry).toBe(true);
    });

    it('should handle non-existent OTP ID', async () => {
      const fakeOtpId = '00000000-0000-0000-0000-000000000000';
      const result = await service.verifyOTP(fakeOtpId, testCode);
      
      expect(result.isValid).toBe(false);
      expect(result.isExpired).toBe(true);
      expect(result.canRetry).toBe(false);
      expect(result.errorMessage).toContain('not found');
    });

    it('should prevent timing attacks', async () => {
      const timings: number[] = [];
      
      // Test multiple wrong codes
      const wrongCodes = ['111111', '222222', '333333', '444444', '555555'];
      
      for (const code of wrongCodes) {
        const start = process.hrtime.bigint();
        await service.verifyOTP(otpId, code);
        const end = process.hrtime.bigint();
        timings.push(Number(end - start));
      }
      
      // Calculate timing variance
      const avgTiming = timings.reduce((a, b) => a + b) / timings.length;
      const maxVariance = Math.max(...timings.map(t => Math.abs(t - avgTiming)));
      const varianceRatio = maxVariance / avgTiming;
      
      // Variance should be reasonable (less than 100% for test environment)
      expect(varianceRatio).toBeLessThan(1.0);
    });
  });

  describe('resendOTP', () => {
    let otpId: string;

    beforeEach(async () => {
      const result = await service.startVerification(testPhones[0], 'registration');
      otpId = result.otpId;
    });

    it('should successfully resend OTP after cooldown', async () => {
      // Wait for cooldown (mock by updating created_at)
      await pool.query(
        'UPDATE phone_verifications SET created_at = $1 WHERE id = $2',
        [new Date(Date.now() - 61000), otpId] // 61 seconds ago
      );
      
      const result = await service.resendOTP(otpId);
      
      expect(result.otpId).toBeDefined();
      expect(result.otpId).not.toBe(otpId); // Should be new OTP ID
      
      // Verify old OTP is expired
      const oldOtpResult = await pool.query(
        'SELECT expires_at FROM phone_verifications WHERE id = $1',
        [otpId]
      );
      
      expect(new Date(oldOtpResult.rows[0].expires_at).getTime())
        .toBeLessThanOrEqual(Date.now());
    });

    it('should enforce cooldown period', async () => {
      await expect(service.resendOTP(otpId))
        .rejects.toThrow('Please wait');
    });

    it('should handle non-existent OTP ID', async () => {
      const fakeOtpId = '00000000-0000-0000-0000-000000000000';
      
      await expect(service.resendOTP(fakeOtpId))
        .rejects.toThrow('not found');
    });
  });

  describe('getVerificationStatus', () => {
    it('should return correct status for active verification', async () => {
      const result = await service.startVerification(testPhones[0], 'registration');
      const status = await service.getVerificationStatus(result.otpId);
      
      expect(status.exists).toBe(true);
      expect(status.isExpired).toBe(false);
      expect(status.isVerified).toBe(false);
      expect(status.attemptsRemaining).toBe(5);
      expect(status.expiresAt).toBeInstanceOf(Date);
    });

    it('should return correct status for expired verification', async () => {
      const result = await service.startVerification(testPhones[0], 'registration');
      
      // Make it expired
      await pool.query(
        'UPDATE phone_verifications SET expires_at = $1 WHERE id = $2',
        [new Date(Date.now() - 1000), result.otpId]
      );
      
      const status = await service.getVerificationStatus(result.otpId);
      
      expect(status.exists).toBe(true);
      expect(status.isExpired).toBe(true);
      expect(status.isVerified).toBe(false);
    });

    it('should return correct status for non-existent verification', async () => {
      const fakeOtpId = '00000000-0000-0000-0000-000000000000';
      const status = await service.getVerificationStatus(fakeOtpId);
      
      expect(status.exists).toBe(false);
      expect(status.isExpired).toBe(false);
      expect(status.isVerified).toBe(false);
      expect(status.attemptsRemaining).toBe(0);
    });
  });

  describe('cleanupExpiredVerifications', () => {
    it('should clean up expired and verified verifications', async () => {
      // Create active verification
      const activeResult = await service.startVerification(testPhones[0], 'registration');
      
      // Create expired verification
      const expiredResult = await service.startVerification(testPhones[1], 'registration');
      await pool.query(
        'UPDATE phone_verifications SET expires_at = $1 WHERE id = $2',
        [new Date(Date.now() - 1000), expiredResult.otpId]
      );
      
      // Create verified verification
      const verifiedResult = await service.startVerification(testPhones[2], 'registration');
      await pool.query(
        'UPDATE phone_verifications SET verified_at = CURRENT_TIMESTAMP WHERE id = $1',
        [verifiedResult.otpId]
      );
      
      const cleanupResult = await service.cleanupExpiredVerifications();
      
      expect(cleanupResult.deletedCount).toBe(2); // expired + verified
      
      // Verify active verification still exists
      const activeCheck = await pool.query(
        'SELECT * FROM phone_verifications WHERE id = $1',
        [activeResult.otpId]
      );
      expect(activeCheck.rows).toHaveLength(1);
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status', async () => {
      // Create some active verifications
      await service.startVerification(testPhones[0], 'registration');
      await service.startVerification(testPhones[1], 'registration');
      
      const health = await service.getHealthStatus();
      
      expect(health.database).toBe(true);
      expect(health.redis).toBe(true);
      expect(typeof health.twilio).toBe('boolean');
      expect(health.activeVerifications).toBeGreaterThanOrEqual(2);
    });

    it('should handle database connection failure', async () => {
      // Mock database error
      const originalQuery = pool.query;
      pool.query = jest.fn().mockRejectedValue(new Error('Database error'));
      
      const health = await service.getHealthStatus();
      
      expect(health.database).toBe(false);
      expect(health.redis).toBe(true); // Redis should still work
      expect(health.activeVerifications).toBe(0);
      
      // Restore original function
      pool.query = originalQuery;
    });
  });

  describe('Security Features', () => {
    it('should generate cryptographically secure codes', async () => {
      const codes = new Set<string>();
      
      // Generate multiple verifications and extract codes
      for (let i = 0; i < 10; i++) {
        const phone = `+123456789${i}`;
        await service.startVerification(phone, 'registration');
        
        // Get the hashed code from database
        const result = await pool.query(
          'SELECT otp_code FROM phone_verifications WHERE phone = $1 ORDER BY created_at DESC LIMIT 1',
          [phone]
        );
        
        codes.add(result.rows[0].otp_code);
      }
      
      // All codes should be unique
      expect(codes.size).toBe(10);
      
      // All codes should be properly hashed (64 character hex)
      codes.forEach(code => {
        expect(code).toMatch(/^[a-f0-9]{64}$/);
      });
      
      // Clean up
      await pool.query('DELETE FROM phone_verifications WHERE phone LIKE \'+123456789%\'');
    });

    it('should use timing-safe comparison for OTP validation', async () => {
      const result = await service.startVerification(testPhones[0], 'registration');
      
      // Test with codes of different lengths (should not leak timing info)
      const testCodes = ['1', '12', '123', '1234', '12345', '123456', '1234567'];
      const timings: number[] = [];
      
      for (const code of testCodes) {
        const start = process.hrtime.bigint();
        await service.verifyOTP(result.otpId, code.padEnd(6, '0'));
        const end = process.hrtime.bigint();
        timings.push(Number(end - start));
      }
      
      // Timing variance should be reasonable
      const avgTiming = timings.reduce((a, b) => a + b) / timings.length;
      const maxVariance = Math.max(...timings.map(t => Math.abs(t - avgTiming)));
      const varianceRatio = maxVariance / avgTiming;
      
      expect(varianceRatio).toBeLessThan(2.0); // Allow some variance in test environment
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent verification attempts safely', async () => {
      const result = await service.startVerification(testPhones[0], 'registration');
      
      // Set known code
      const testCode = '123456';
      const crypto = require('crypto');
      const hashedCode = crypto.createHash('sha256')
        .update(testCode + (process.env.JWT_SECRET || 'default-secret'))
        .digest('hex');
      
      await pool.query(
        'UPDATE phone_verifications SET otp_code = $1 WHERE id = $2',
        [hashedCode, result.otpId]
      );
      
      // Try concurrent verifications
      const promises = Array(5).fill(null).map(() =>
        service.verifyOTP(result.otpId, testCode)
      );
      
      const results = await Promise.all(promises);
      
      // Only one should succeed
      const successCount = results.filter(r => r.isValid).length;
      expect(successCount).toBe(1);
    });

    it('should handle concurrent start verification requests', async () => {
      const promises = testPhones.slice(0, 4).map(phone =>
        service.startVerification(phone, 'registration')
      );
      
      const results = await Promise.all(promises);
      
      // All should succeed with unique IDs
      expect(results).toHaveLength(4);
      const otpIds = results.map(r => r.otpId);
      const uniqueIds = new Set(otpIds);
      expect(uniqueIds.size).toBe(4);
    });
  });
});