import { SecureOTPService } from './secure-otp.service';
import { OTPCleanupService } from './otp-cleanup.service';
import pool from '../config/database';
import redisClient from '../config/redis';
import { jest } from '@jest/globals';

describe('OTP System Integration Tests', () => {
  let otpService: SecureOTPService;
  let cleanupService: OTPCleanupService;
  let testUsers: Array<{ id: string; phone: string }>;

  beforeAll(async () => {
    // Connect to Redis if not already connected
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }

    // Create test users
    testUsers = [
      { id: 'user-1', phone: '+1234567890' },
      { id: 'user-2', phone: '+1234567891' },
      { id: 'user-3', phone: '+1234567892' }
    ];
  });

  beforeEach(async () => {
    otpService = new SecureOTPService({
      expiryMinutes: 10,
      maxAttempts: 3,
      rateLimitWindow: 60,
      maxOTPsPerWindow: 5,
      codeLength: 6
    });

    cleanupService = new OTPCleanupService({
      enabled: true,
      batchSize: 100,
      maxAge: 24,
      logResults: false
    });

    // Clean up any existing test data
    for (const user of testUsers) {
      await pool.query('DELETE FROM otp_verifications WHERE phone_number = $1', [user.phone]);
      await redisClient.del(`otp_rate_limit:${user.phone}`);
      await redisClient.del(`otp_attempts:${user.phone}:registration`);
      await redisClient.del(`otp_attempts:${user.phone}:login`);
    }
  });

  afterEach(async () => {
    // Clean up test data
    for (const user of testUsers) {
      await pool.query('DELETE FROM otp_verifications WHERE phone_number = $1', [user.phone]);
      await redisClient.del(`otp_rate_limit:${user.phone}`);
      await redisClient.del(`otp_attempts:${user.phone}:registration`);
      await redisClient.del(`otp_attempts:${user.phone}:login`);
    }
    
    cleanupService.stop();
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  describe('Complete Registration Flow', () => {
    it('should handle complete user registration with OTP verification', async () => {
      const user = testUsers[0];
      
      // Step 1: Generate OTP for registration
      const otpResult = await otpService.generateOTP(user.phone, 'registration', user.id);
      
      expect(otpResult.otpId).toBeDefined();
      expect(otpResult.attemptsRemaining).toBe(3);
      
      // Step 2: Verify OTP is stored correctly
      const dbResult = await pool.query(
        'SELECT * FROM otp_verifications WHERE id = $1',
        [otpResult.otpId]
      );
      
      expect(dbResult.rows).toHaveLength(1);
      const storedOTP = dbResult.rows[0];
      expect(storedOTP.phone_number).toBe(user.phone);
      expect(storedOTP.type).toBe('registration');
      expect(storedOTP.user_id).toBe(user.id);
      expect(storedOTP.is_used).toBe(false);
      
      // Step 3: Simulate getting the actual code (in real scenario, user receives via SMS)
      const crypto = require('crypto');
      const testCode = '123456';
      const hashedCode = crypto.createHash('sha256')
        .update(testCode + process.env.JWT_SECRET)
        .digest('hex');
      
      await pool.query(
        'UPDATE otp_verifications SET otp_code = $1 WHERE id = $2',
        [hashedCode, otpResult.otpId]
      );
      
      // Step 4: Validate OTP
      const validationResult = await otpService.validateOTP(otpResult.otpId, testCode);
      
      expect(validationResult.isValid).toBe(true);
      expect(validationResult.userId).toBe(user.id);
      expect(validationResult.isExpired).toBe(false);
      expect(validationResult.isRateLimited).toBe(false);
      
      // Step 5: Verify OTP is marked as used
      const usedOTPResult = await pool.query(
        'SELECT is_used FROM otp_verifications WHERE id = $1',
        [otpResult.otpId]
      );
      
      expect(usedOTPResult.rows[0].is_used).toBe(true);
      
      // Step 6: Verify cannot reuse the same OTP
      const reuseResult = await otpService.validateOTP(otpResult.otpId, testCode);
      expect(reuseResult.isValid).toBe(false);
      expect(reuseResult.errorMessage).toBe('OTP not found or already used');
    });

    it('should handle failed attempts and rate limiting', async () => {
      const user = testUsers[1];
      
      // Generate OTP
      const otpResult = await otpService.generateOTP(user.phone, 'registration', user.id);
      
      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        const result = await otpService.validateOTP(otpResult.otpId, '999999');
        expect(result.isValid).toBe(false);
        expect(result.attemptsRemaining).toBe(2 - i);
      }
      
      // Fourth attempt should be rate limited
      const rateLimitedResult = await otpService.validateOTP(otpResult.otpId, '999999');
      expect(rateLimitedResult.isValid).toBe(false);
      expect(rateLimitedResult.isRateLimited).toBe(true);
      expect(rateLimitedResult.attemptsRemaining).toBe(0);
    });
  });

  describe('Multiple OTP Types Flow', () => {
    it('should handle different OTP types for same user', async () => {
      const user = testUsers[0];
      
      // Generate registration OTP
      const registrationOTP = await otpService.generateOTP(user.phone, 'registration', user.id);
      
      // Generate login OTP for same user
      const loginOTP = await otpService.generateOTP(user.phone, 'login', user.id);
      
      // Both should be valid and independent
      expect(registrationOTP.otpId).not.toBe(loginOTP.otpId);
      
      // Verify both are stored
      const dbResult = await pool.query(
        'SELECT * FROM otp_verifications WHERE user_id = $1 ORDER BY created_at',
        [user.id]
      );
      
      expect(dbResult.rows).toHaveLength(2);
      expect(dbResult.rows[0].type).toBe('registration');
      expect(dbResult.rows[1].type).toBe('login');
    });

    it('should enforce rate limiting per phone number across types', async () => {
      const user = testUsers[0];
      
      // Generate maximum allowed OTPs (5) across different types
      const otps = [];
      for (let i = 0; i < 5; i++) {
        const type = i % 2 === 0 ? 'registration' : 'login';
        const otp = await otpService.generateOTP(user.phone, type, user.id);
        otps.push(otp);
      }
      
      // Next OTP should fail due to rate limiting
      await expect(
        otpService.generateOTP(user.phone, 'password_reset', user.id)
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Resend OTP Flow', () => {
    it('should handle OTP resend correctly', async () => {
      const user = testUsers[0];
      
      // Generate initial OTP
      const initialOTP = await otpService.generateOTP(user.phone, 'registration', user.id);
      
      // Wait to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Resend OTP
      const newOTP = await otpService.resendOTP(initialOTP.otpId);
      
      expect(newOTP.otpId).not.toBe(initialOTP.otpId);
      
      // Verify old OTP is marked as used
      const oldOTPResult = await pool.query(
        'SELECT is_used FROM otp_verifications WHERE id = $1',
        [initialOTP.otpId]
      );
      expect(oldOTPResult.rows[0].is_used).toBe(true);
      
      // Verify new OTP exists and is active
      const newOTPResult = await pool.query(
        'SELECT * FROM otp_verifications WHERE id = $1',
        [newOTP.otpId]
      );
      expect(newOTPResult.rows[0].is_used).toBe(false);
    });

    it('should prevent rapid resend attempts', async () => {
      const user = testUsers[0];
      
      const otpResult = await otpService.generateOTP(user.phone, 'registration', user.id);
      
      // Immediate resend should fail
      await expect(otpService.resendOTP(otpResult.otpId)).rejects.toThrow(
        'Please wait before requesting a new code'
      );
    });
  });

  describe('Cleanup Integration', () => {
    it('should clean up expired OTPs and maintain active ones', async () => {
      const user1 = testUsers[0];
      const user2 = testUsers[1];
      
      // Create active OTP
      const activeOTP = await otpService.generateOTP(user1.phone, 'registration', user1.id);
      
      // Create expired OTP
      const expiredOTP = await otpService.generateOTP(user2.phone, 'registration', user2.id);
      await pool.query(
        'UPDATE otp_verifications SET expires_at = $1 WHERE id = $2',
        [new Date(Date.now() - 1000), expiredOTP.otpId]
      );
      
      // Run cleanup
      const cleanupStats = await cleanupService.runCleanup();
      
      expect(cleanupStats.deletedOTPs).toBe(1);
      
      // Verify active OTP still exists
      const activeResult = await pool.query(
        'SELECT * FROM otp_verifications WHERE id = $1',
        [activeOTP.otpId]
      );
      expect(activeResult.rows).toHaveLength(1);
      
      // Verify expired OTP was deleted
      const expiredResult = await pool.query(
        'SELECT * FROM otp_verifications WHERE id = $1',
        [expiredOTP.otpId]
      );
      expect(expiredResult.rows).toHaveLength(0);
    });

    it('should handle cleanup during active OTP operations', async () => {
      const user = testUsers[0];
      
      // Create OTP
      const otpResult = await otpService.generateOTP(user.phone, 'registration', user.id);
      
      // Make it expired
      await pool.query(
        'UPDATE otp_verifications SET expires_at = $1 WHERE id = $2',
        [new Date(Date.now() - 1000), otpResult.otpId]
      );
      
      // Run cleanup and OTP validation concurrently
      const [cleanupStats, validationResult] = await Promise.all([
        cleanupService.runCleanup(),
        otpService.validateOTP(otpResult.otpId, '123456').catch(err => ({ error: err.message }))
      ]);
      
      // Cleanup should succeed
      expect(cleanupStats.deletedOTPs).toBeGreaterThanOrEqual(0);
      
      // Validation should handle the case gracefully
      if ('error' in validationResult) {
        expect(validationResult.error).toBeDefined();
      } else {
        expect(validationResult.isValid).toBe(false);
      }
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent OTP generation for different users', async () => {
      const promises = testUsers.map(user =>
        otpService.generateOTP(user.phone, 'registration', user.id)
      );
      
      const results = await Promise.all(promises);
      
      // All should succeed
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.otpId).toBeDefined();
        expect(result.attemptsRemaining).toBe(3);
      });
      
      // Verify all are stored
      const dbResult = await pool.query(
        'SELECT * FROM otp_verifications WHERE user_id = ANY($1)',
        [testUsers.map(u => u.id)]
      );
      
      expect(dbResult.rows).toHaveLength(3);
    });

    it('should handle concurrent validation attempts', async () => {
      const user = testUsers[0];
      
      // Generate OTP
      const otpResult = await otpService.generateOTP(user.phone, 'registration', user.id);
      
      // Set known code
      const crypto = require('crypto');
      const testCode = '123456';
      const hashedCode = crypto.createHash('sha256')
        .update(testCode + process.env.JWT_SECRET)
        .digest('hex');
      
      await pool.query(
        'UPDATE otp_verifications SET otp_code = $1 WHERE id = $2',
        [hashedCode, otpResult.otpId]
      );
      
      // Try concurrent validations
      const promises = [
        otpService.validateOTP(otpResult.otpId, testCode),
        otpService.validateOTP(otpResult.otpId, testCode),
        otpService.validateOTP(otpResult.otpId, testCode)
      ];
      
      const results = await Promise.all(promises);
      
      // Only one should succeed (first one to mark as used)
      const successCount = results.filter(r => r.isValid).length;
      expect(successCount).toBe(1);
      
      // Others should fail with appropriate message
      const failedResults = results.filter(r => !r.isValid);
      expect(failedResults.length).toBe(2);
    });
  });

  describe('Security Validation', () => {
    it('should prevent timing attacks across multiple OTP validations', async () => {
      const user = testUsers[0];
      
      // Generate multiple OTPs
      const otps = [];
      for (let i = 0; i < 3; i++) {
        const otp = await otpService.generateOTP(user.phone, 'registration', `${user.id}-${i}`);
        otps.push(otp);
      }
      
      // Measure timing for wrong codes
      const timings = [];
      for (const otp of otps) {
        const start = process.hrtime.bigint();
        await otpService.validateOTP(otp.otpId, '000000');
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

    it('should maintain security under load', async () => {
      const user = testUsers[0];
      
      // Generate many OTPs rapidly
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          otpService.generateOTP(`+123456780${i}`, 'registration', `user-${i}`)
        );
      }
      
      const results = await Promise.all(promises);
      
      // All should have unique IDs
      const ids = results.map(r => r.otpId);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
      
      // All should be properly stored with hashed codes
      const dbResult = await pool.query(
        'SELECT otp_code FROM otp_verifications WHERE phone_number LIKE \'+123456780%\''
      );
      
      dbResult.rows.forEach(row => {
        // Should be hex hash, not plain text
        expect(row.otp_code).toMatch(/^[a-f0-9]{64}$/);
      });
      
      // Clean up
      await pool.query('DELETE FROM otp_verifications WHERE phone_number LIKE \'+123456780%\'');
    });
  });

  describe('Health and Monitoring', () => {
    it('should provide accurate health status', async () => {
      const user = testUsers[0];
      
      // Create some active OTPs
      await otpService.generateOTP(user.phone, 'registration', user.id);
      await otpService.generateOTP(testUsers[1].phone, 'login', testUsers[1].id);
      
      const health = await otpService.getHealthStatus();
      
      expect(health.database).toBe(true);
      expect(health.redis).toBe(true);
      expect(health.activeOTPs).toBeGreaterThanOrEqual(2);
      expect(typeof health.twilio).toBe('boolean');
    });

    it('should track attempt information accurately', async () => {
      const user = testUsers[0];
      
      // Generate OTP
      const otpResult = await otpService.generateOTP(user.phone, 'registration', user.id);
      
      // Make some failed attempts
      await otpService.validateOTP(otpResult.otpId, '111111');
      await otpService.validateOTP(otpResult.otpId, '222222');
      
      // Check attempt info
      const attemptInfo = await otpService.getOTPAttemptInfo(user.phone, 'registration');
      
      expect(attemptInfo.attempts).toBe(2);
      expect(attemptInfo.maxAttempts).toBe(3);
      expect(attemptInfo.isBlocked).toBe(false);
      expect(attemptInfo.lastAttemptAt).toBeInstanceOf(Date);
    });
  });
});