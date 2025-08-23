import { EnhancedPhoneVerificationService } from '../enhanced-phone-verification.service';
import pool from '../../config/database';
import redisClient from '../../config/redis';
import { jest } from '@jest/globals';

// Mock Twilio for integration tests
jest.mock('twilio', () => ({
  Twilio: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({ 
        sid: 'mock-message-sid',
        status: 'sent',
        to: '+1234567890'
      })
    },
    api: {
      accounts: jest.fn().mockReturnValue({
        fetch: jest.fn().mockResolvedValue({ status: 'active' })
      })
    }
  }))
}));

describe('Phone Verification Flow Integration Tests', () => {
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
      '+1234567893',
      '+1234567894'
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

  describe('Complete Registration Flow', () => {
    /**
     * Test Requirement 1.2: Check if phone number already exists
     * Test Requirement 1.4: Send OTP via SMS and store verification attempt
     * Test Requirement 1.5: Verify OTP and update database
     */
    it('should complete full phone verification flow for new user registration', async () => {
      const phone = testPhones[0];
      
      // Step 1: Check phone doesn't exist (Requirement 1.2)
      const phoneCheck = await service.checkPhoneExists(phone);
      expect(phoneCheck.exists).toBe(false);
      
      // Step 2: Start verification process (Requirement 1.4)
      const startResult = await service.startVerification(phone, 'registration');
      expect(startResult.otpId).toBeDefined();
      expect(startResult.expiresAt).toBeInstanceOf(Date);
      expect(startResult.attemptsRemaining).toBe(5);
      
      // Verify database record was created
      const dbResult = await pool.query(
        'SELECT * FROM phone_verifications WHERE id = $1',
        [startResult.otpId]
      );
      expect(dbResult.rows).toHaveLength(1);
      const verification = dbResult.rows[0];
      expect(verification.phone).toBe(phone);
      expect(verification.attempts).toBe(0);
      expect(verification.verified_at).toBeNull();
      
      // Step 3: Simulate receiving OTP and verify it (Requirement 1.5)
      const testCode = '123456';
      const crypto = require('crypto');
      const hashedCode = crypto.createHash('sha256')
        .update(testCode + (process.env.JWT_SECRET || 'default-secret'))
        .digest('hex');
      
      // Update with known test code
      await pool.query(
        'UPDATE phone_verifications SET otp_code = $1 WHERE id = $2',
        [hashedCode, startResult.otpId]
      );
      
      // Verify OTP
      const verifyResult = await service.verifyOTP(startResult.otpId, testCode);
      expect(verifyResult.isValid).toBe(true);
      expect(verifyResult.isExpired).toBe(false);
      expect(verifyResult.isRateLimited).toBe(false);
      expect(verifyResult.canRetry).toBe(false);
      
      // Step 4: Verify database was updated
      const verifiedResult = await pool.query(
        'SELECT verified_at FROM phone_verifications WHERE id = $1',
        [startResult.otpId]
      );
      expect(verifiedResult.rows[0].verified_at).not.toBeNull();
      
      // Step 5: Verify status check
      const status = await service.getVerificationStatus(startResult.otpId);
      expect(status.exists).toBe(true);
      expect(status.isVerified).toBe(true);
      expect(status.isExpired).toBe(false);
    });

    /**
     * Test Requirement 1.3: Prevent signup if phone already exists
     */
    it('should prevent registration for existing phone number', async () => {
      const phone = testPhones[0];
      
      // Create existing user
      await pool.query(`
        INSERT INTO users (phone, phone_verified) 
        VALUES ($1, $2)
      `, [phone, true]);
      
      // Check phone exists
      const phoneCheck = await service.checkPhoneExists(phone);
      expect(phoneCheck.exists).toBe(true);
      expect(phoneCheck.isVerified).toBe(true);
      
      // Attempt registration should fail
      await expect(service.startVerification(phone, 'registration'))
        .rejects.toThrow('Phone number already registered');
    });

    /**
     * Test Requirement 1.6: Allow retry for incorrect OTP without blocking user
     */
    it('should allow retry for incorrect OTP attempts', async () => {
      const phone = testPhones[0];
      
      // Start verification
      const startResult = await service.startVerification(phone, 'registration');
      
      // Make multiple incorrect attempts
      for (let i = 0; i < 4; i++) {
        const verifyResult = await service.verifyOTP(startResult.otpId, '999999');
        expect(verifyResult.isValid).toBe(false);
        expect(verifyResult.canRetry).toBe(true);
        expect(verifyResult.attemptsRemaining).toBe(4 - i);
        expect(verifyResult.errorMessage).toContain('Invalid verification code');
      }
      
      // 5th incorrect attempt should hit limit but still allow retry
      const finalAttempt = await service.verifyOTP(startResult.otpId, '999999');
      expect(finalAttempt.isValid).toBe(false);
      expect(finalAttempt.canRetry).toBe(true); // Still can retry with new OTP
      expect(finalAttempt.isRateLimited).toBe(true);
      expect(finalAttempt.attemptsRemaining).toBe(0);
    });
  });

  describe('Multi-Step Signup Flow Simulation', () => {
    /**
     * Simulate the complete multi-step signup flow as described in requirements
     */
    it('should handle complete multi-step phone signup flow', async () => {
      const phone = testPhones[0];
      const email = 'test@example.com';
      
      // Step 1: User enters phone number
      console.log('📱 Step 1: User enters phone number');
      
      // Check if phone exists (Requirement 1.2)
      const phoneCheck = await service.checkPhoneExists(phone);
      expect(phoneCheck.exists).toBe(false);
      
      // Start phone verification (Requirement 1.4)
      const phoneVerification = await service.startVerification(phone, 'registration');
      console.log('📱 OTP sent to phone');
      
      // Step 2: User enters OTP
      console.log('📱 Step 2: User enters OTP');
      
      // Simulate user receiving and entering correct OTP
      const testCode = '123456';
      const crypto = require('crypto');
      const hashedCode = crypto.createHash('sha256')
        .update(testCode + (process.env.JWT_SECRET || 'default-secret'))
        .digest('hex');
      
      await pool.query(
        'UPDATE phone_verifications SET otp_code = $1 WHERE id = $2',
        [hashedCode, phoneVerification.otpId]
      );
      
      const phoneVerifyResult = await service.verifyOTP(phoneVerification.otpId, testCode);
      expect(phoneVerifyResult.isValid).toBe(true);
      console.log('✅ Phone verified successfully');
      
      // Step 3: Proceed to email verification (would be handled by email service)
      console.log('📧 Step 3: Proceed to email verification');
      
      // Simulate email verification process
      // This would typically be handled by EmailVerificationService
      // For this test, we'll just verify the phone verification is complete
      
      const finalStatus = await service.getVerificationStatus(phoneVerification.otpId);
      expect(finalStatus.isVerified).toBe(true);
      
      console.log('✅ Multi-step signup flow completed successfully');
    });

    it('should handle user making mistakes during signup', async () => {
      const phone = testPhones[0];
      
      // Start verification
      const startResult = await service.startVerification(phone, 'registration');
      
      // User enters wrong OTP multiple times
      console.log('❌ User enters wrong OTP');
      let verifyResult = await service.verifyOTP(startResult.otpId, '111111');
      expect(verifyResult.isValid).toBe(false);
      expect(verifyResult.canRetry).toBe(true);
      
      console.log('❌ User enters wrong OTP again');
      verifyResult = await service.verifyOTP(startResult.otpId, '222222');
      expect(verifyResult.isValid).toBe(false);
      expect(verifyResult.canRetry).toBe(true);
      
      // User finally enters correct OTP
      console.log('✅ User enters correct OTP');
      const testCode = '123456';
      const crypto = require('crypto');
      const hashedCode = crypto.createHash('sha256')
        .update(testCode + (process.env.JWT_SECRET || 'default-secret'))
        .digest('hex');
      
      await pool.query(
        'UPDATE phone_verifications SET otp_code = $1 WHERE id = $2',
        [hashedCode, startResult.otpId]
      );
      
      verifyResult = await service.verifyOTP(startResult.otpId, testCode);
      expect(verifyResult.isValid).toBe(true);
      
      console.log('✅ Verification completed despite initial mistakes');
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should enforce rate limiting across multiple verification attempts', async () => {
      const phone = testPhones[0];
      
      // Generate maximum allowed OTPs
      const otpIds = [];
      for (let i = 0; i < 3; i++) {
        const result = await service.startVerification(phone, 'registration');
        otpIds.push(result.otpId);
        console.log(`📱 Generated OTP ${i + 1}/3`);
      }
      
      // Next attempt should fail due to rate limiting
      console.log('🚫 Attempting to exceed rate limit');
      await expect(service.startVerification(phone, 'registration'))
        .rejects.toThrow('Too many verification attempts');
      
      console.log('✅ Rate limiting enforced successfully');
    });

    it('should handle concurrent verification attempts safely', async () => {
      const phones = testPhones.slice(0, 3);
      
      // Start concurrent verifications
      console.log('🔄 Starting concurrent verifications');
      const promises = phones.map(phone =>
        service.startVerification(phone, 'registration')
      );
      
      const results = await Promise.all(promises);
      
      // All should succeed with unique IDs
      expect(results).toHaveLength(3);
      const otpIds = results.map(r => r.otpId);
      const uniqueIds = new Set(otpIds);
      expect(uniqueIds.size).toBe(3);
      
      console.log('✅ Concurrent operations handled safely');
    });

    it('should maintain security under rapid verification attempts', async () => {
      const phone = testPhones[0];
      
      // Start verification
      const startResult = await service.startVerification(phone, 'registration');
      
      // Make rapid verification attempts
      console.log('🔄 Making rapid verification attempts');
      const promises = Array(10).fill(null).map((_, i) =>
        service.verifyOTP(startResult.otpId, `${i}${i}${i}${i}${i}${i}`)
      );
      
      const results = await Promise.all(promises);
      
      // All should fail (wrong codes) but handle gracefully
      results.forEach(result => {
        expect(result.isValid).toBe(false);
        expect(typeof result.canRetry).toBe('boolean');
        expect(typeof result.attemptsRemaining).toBe('number');
      });
      
      console.log('✅ Security maintained under rapid attempts');
    });
  });

  describe('Resend Functionality', () => {
    it('should handle OTP resend flow correctly', async () => {
      const phone = testPhones[0];
      
      // Start initial verification
      console.log('📱 Starting initial verification');
      const initialResult = await service.startVerification(phone, 'registration');
      
      // Simulate cooldown period by updating created_at
      await pool.query(
        'UPDATE phone_verifications SET created_at = $1 WHERE id = $2',
        [new Date(Date.now() - 61000), initialResult.otpId]
      );
      
      // Resend OTP
      console.log('🔄 Resending OTP');
      const resendResult = await service.resendOTP(initialResult.otpId);
      
      expect(resendResult.otpId).toBeDefined();
      expect(resendResult.otpId).not.toBe(initialResult.otpId);
      
      // Verify old OTP is expired
      const oldStatus = await service.getVerificationStatus(initialResult.otpId);
      expect(oldStatus.isExpired).toBe(true);
      
      // Verify new OTP is active
      const newStatus = await service.getVerificationStatus(resendResult.otpId);
      expect(newStatus.exists).toBe(true);
      expect(newStatus.isExpired).toBe(false);
      expect(newStatus.isVerified).toBe(false);
      
      console.log('✅ Resend functionality working correctly');
    });

    it('should prevent rapid resend attempts', async () => {
      const phone = testPhones[0];
      
      const startResult = await service.startVerification(phone, 'registration');
      
      // Immediate resend should fail
      console.log('🚫 Attempting immediate resend');
      await expect(service.resendOTP(startResult.otpId))
        .rejects.toThrow('Please wait');
      
      console.log('✅ Resend cooldown enforced');
    });
  });

  describe('Error Recovery', () => {
    it('should handle expired OTP gracefully', async () => {
      const phone = testPhones[0];
      
      // Start verification
      const startResult = await service.startVerification(phone, 'registration');
      
      // Make OTP expired
      await pool.query(
        'UPDATE phone_verifications SET expires_at = $1 WHERE id = $2',
        [new Date(Date.now() - 1000), startResult.otpId]
      );
      
      // Attempt verification
      console.log('⏰ Attempting to verify expired OTP');
      const verifyResult = await service.verifyOTP(startResult.otpId, '123456');
      
      expect(verifyResult.isValid).toBe(false);
      expect(verifyResult.isExpired).toBe(true);
      expect(verifyResult.canRetry).toBe(true); // Should allow new verification
      
      console.log('✅ Expired OTP handled gracefully');
    });

    it('should handle database connection issues gracefully', async () => {
      const phone = testPhones[0];
      
      // Mock database error for phone check
      const originalQuery = pool.query;
      pool.query = jest.fn().mockRejectedValueOnce(new Error('Database connection failed'));
      
      console.log('💥 Simulating database error');
      await expect(service.checkPhoneExists(phone))
        .rejects.toThrow('Failed to check phone number availability');
      
      // Restore database connection
      pool.query = originalQuery;
      
      // Verify service recovers
      console.log('🔄 Testing service recovery');
      const phoneCheck = await service.checkPhoneExists(phone);
      expect(phoneCheck.exists).toBe(false);
      
      console.log('✅ Service recovered from database error');
    });
  });

  describe('Cleanup and Maintenance', () => {
    it('should clean up expired verifications properly', async () => {
      const phones = testPhones.slice(0, 3);
      
      // Create active verification
      console.log('📱 Creating active verification');
      const activeResult = await service.startVerification(phones[0], 'registration');
      
      // Create expired verification
      console.log('⏰ Creating expired verification');
      const expiredResult = await service.startVerification(phones[1], 'registration');
      await pool.query(
        'UPDATE phone_verifications SET expires_at = $1 WHERE id = $2',
        [new Date(Date.now() - 1000), expiredResult.otpId]
      );
      
      // Create verified verification
      console.log('✅ Creating verified verification');
      const verifiedResult = await service.startVerification(phones[2], 'registration');
      await pool.query(
        'UPDATE phone_verifications SET verified_at = CURRENT_TIMESTAMP WHERE id = $1',
        [verifiedResult.otpId]
      );
      
      // Run cleanup
      console.log('🧹 Running cleanup');
      const cleanupResult = await service.cleanupExpiredVerifications();
      expect(cleanupResult.deletedCount).toBe(2); // expired + verified
      
      // Verify active verification still exists
      const activeStatus = await service.getVerificationStatus(activeResult.otpId);
      expect(activeStatus.exists).toBe(true);
      
      // Verify expired and verified are gone
      const expiredStatus = await service.getVerificationStatus(expiredResult.otpId);
      expect(expiredStatus.exists).toBe(false);
      
      const verifiedStatus = await service.getVerificationStatus(verifiedResult.otpId);
      expect(verifiedStatus.exists).toBe(false);
      
      console.log('✅ Cleanup completed successfully');
    });
  });

  describe('Health Monitoring', () => {
    it('should provide accurate health status', async () => {
      // Create some active verifications
      console.log('📱 Creating test verifications for health check');
      await service.startVerification(testPhones[0], 'registration');
      await service.startVerification(testPhones[1], 'registration');
      
      const health = await service.getHealthStatus();
      
      expect(health.database).toBe(true);
      expect(health.redis).toBe(true);
      expect(typeof health.twilio).toBe('boolean');
      expect(health.activeVerifications).toBeGreaterThanOrEqual(2);
      
      console.log('✅ Health status accurate:', {
        database: health.database,
        redis: health.redis,
        twilio: health.twilio,
        activeVerifications: health.activeVerifications
      });
    });
  });
});