/**
 * Comprehensive tests for all new security services
 * Requirements: 6.1, 6.2, 7.1, 8.3
 */

import { UserSecurityManager } from '../../auth/user-security-manager.service';
import { SecureOTPService } from '../../auth/secure-otp.service';
import { PricingProtectionService } from '../../security/pricing-protection.service';
import pool from '../../config/database';
import redisClient from '../../config/redis';
import jwt from 'jsonwebtoken';

describe('Security Services Integration Tests', () => {
  let userSecurityManager: UserSecurityManager;
  let otpService: SecureOTPService;
  let pricingService: PricingProtectionService;
  
  const testUserId = 'test-user-' + Date.now();
  const testPhoneNumber = '+1234567890';

  beforeAll(async () => {
    userSecurityManager = new UserSecurityManager();
    otpService = new SecureOTPService({
      expiryMinutes: 10,
      maxAttempts: 3,
      rateLimitWindow: 60,
      maxOTPsPerWindow: 5,
      codeLength: 6
    });
    pricingService = new PricingProtectionService();

    // Ensure Redis connection
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  });

  beforeEach(async () => {
    // Clean up test data
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await pool.query('DELETE FROM otp_verifications WHERE phone_number = $1', [testPhoneNumber]);
    await redisClient.del(`otp_rate_limit:${testPhoneNumber}`);
  });

  afterAll(async () => {
    // Final cleanup
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await pool.query('DELETE FROM otp_verifications WHERE phone_number = $1', [testPhoneNumber]);
    await redisClient.quit();
  });

  describe('User Security Manager - JWT Secret Management', () => {
    it('should generate unique JWT secrets for each user', async () => {
      // Create test user
      await pool.query(
        'INSERT INTO users (id, phone_number, email) VALUES ($1, $2, $3)',
        [testUserId, testPhoneNumber, 'test@example.com']
      );

      const secrets = await userSecurityManager.generateUserJWTSecrets(testUserId);

      expect(secrets.jwtSecret).toBeDefined();
      expect(secrets.jwtRefreshSecret).toBeDefined();
      expect(secrets.jwtSecret).not.toBe(secrets.jwtRefreshSecret);
      expect(secrets.jwtSecret.length).toBeGreaterThan(32);
      expect(secrets.jwtRefreshSecret.length).toBeGreaterThan(32);
    });

    it('should validate tokens using user-specific secrets', async () => {
      // Create test user
      await pool.query(
        'INSERT INTO users (id, phone_number, email) VALUES ($1, $2, $3)',
        [testUserId, testPhoneNumber, 'test@example.com']
      );

      const secrets = await userSecurityManager.generateUserJWTSecrets(testUserId);
      
      // Generate token with user-specific secret
      const token = jwt.sign(
        { userId: testUserId, email: 'test@example.com' },
        secrets.jwtSecret,
        { expiresIn: '15m' }
      );

      const validation = await userSecurityManager.validateUserAccessToken(token, testUserId);
      
      expect(validation.userId).toBe(testUserId);
      expect(validation.email).toBe('test@example.com');
    });

    it('should reject tokens from different users', async () => {
      const otherUserId = 'other-user-' + Date.now();
      
      // Create two test users
      await pool.query(
        'INSERT INTO users (id, phone_number, email) VALUES ($1, $2, $3)',
        [testUserId, testPhoneNumber, 'test@example.com']
      );
      await pool.query(
        'INSERT INTO users (id, phone_number, email) VALUES ($1, $2, $3)',
        [otherUserId, '+9876543210', 'other@example.com']
      );

      const secrets1 = await userSecurityManager.generateUserJWTSecrets(testUserId);
      const secrets2 = await userSecurityManager.generateUserJWTSecrets(otherUserId);

      // Generate token for user1 but try to validate with user2's secrets
      const token = jwt.sign(
        { userId: testUserId, email: 'test@example.com' },
        secrets1.jwtSecret,
        { expiresIn: '15m' }
      );

      await expect(
        userSecurityManager.validateUserAccessToken(token, otherUserId)
      ).rejects.toThrow('Invalid access token');

      // Cleanup
      await pool.query('DELETE FROM users WHERE id = $1', [otherUserId]);
    });
  });

  describe('Secure OTP Service - Database Storage', () => {
    it('should store OTP securely in database with expiration', async () => {
      const result = await otpService.generateOTP(testPhoneNumber, 'registration', testUserId);

      const dbResult = await pool.query(
        'SELECT * FROM otp_verifications WHERE id = $1',
        [result.otpId]
      );

      expect(dbResult.rows).toHaveLength(1);
      const otp = dbResult.rows[0];
      
      expect(otp.phone_number).toBe(testPhoneNumber);
      expect(otp.user_id).toBe(testUserId);
      expect(otp.type).toBe('registration');
      expect(otp.is_used).toBe(false);
      expect(otp.attempts).toBe(0);
      expect(new Date(otp.expires_at)).toBeInstanceOf(Date);
      expect(new Date(otp.expires_at).getTime()).toBeGreaterThan(Date.now());
      
      // OTP code should be hashed, not plain text
      expect(otp.otp_code).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should enforce rate limiting across multiple OTP requests', async () => {
      // Generate maximum allowed OTPs
      for (let i = 0; i < 5; i++) {
        await otpService.generateOTP(testPhoneNumber, 'registration', testUserId);
      }

      // Next attempt should fail due to rate limiting
      await expect(
        otpService.generateOTP(testPhoneNumber, 'registration', testUserId)
      ).rejects.toThrow('Rate limit exceeded');
    });

    it('should track and limit validation attempts', async () => {
      const result = await otpService.generateOTP(testPhoneNumber, 'registration', testUserId);

      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        const validation = await otpService.validateOTP(result.otpId, '999999');
        expect(validation.isValid).toBe(false);
        expect(validation.attemptsRemaining).toBe(2 - i);
      }

      // Next attempt should be rate limited
      const finalAttempt = await otpService.validateOTP(result.otpId, '123456');
      expect(finalAttempt.isValid).toBe(false);
      expect(finalAttempt.isRateLimited).toBe(true);
      expect(finalAttempt.attemptsRemaining).toBe(0);
    });
  });

  describe('Pricing Protection Service - JWT Signed Pricing', () => {
    it('should sign and verify pricing data with JWT', () => {
      const pricingData = {
        planId: 'test-plan',
        planName: 'Test Plan',
        priceAmount: 99.99,
        currency: 'INR',
        billingCycle: 'monthly' as const,
        features: ['Feature 1', 'Feature 2'],
        limits: { emails: 1000, recipients: 5000 },
        isPopular: false
      };

      const signature = pricingService.signPricingData(pricingData);
      expect(signature).toBeDefined();
      expect(signature.split('.')).toHaveLength(3); // Valid JWT format

      const isValid = pricingService.verifyPricingSignature(
        pricingData.planId,
        pricingData.priceAmount,
        pricingData.currency,
        pricingData.billingCycle,
        signature
      );

      expect(isValid).toBe(true);
    });

    it('should detect pricing tampering attempts', () => {
      const pricingData = {
        planId: 'test-plan',
        planName: 'Test Plan',
        priceAmount: 99.99,
        currency: 'INR',
        billingCycle: 'monthly' as const,
        features: ['Feature 1'],
        limits: { emails: 1000 },
        isPopular: false
      };

      const signature = pricingService.signPricingData(pricingData);

      // Try to verify with tampered price
      const isValid = pricingService.verifyPricingSignature(
        pricingData.planId,
        49.99, // Tampered price
        pricingData.currency,
        pricingData.billingCycle,
        signature
      );

      expect(isValid).toBe(false);
    });

    it('should reject malformed JWT signatures', () => {
      const isValid = pricingService.verifyPricingSignature(
        'test-plan',
        99.99,
        'INR',
        'monthly',
        'invalid.jwt.signature'
      );

      expect(isValid).toBe(false);
    });
  });

  describe('Cross-Service Security Integration', () => {
    it('should complete secure user registration flow', async () => {
      // Step 1: Generate OTP for phone verification
      const otpResult = await otpService.generateOTP(testPhoneNumber, 'registration', testUserId);
      expect(otpResult.otpId).toBeDefined();

      // Step 2: Create user record
      await pool.query(
        'INSERT INTO users (id, phone_number, email) VALUES ($1, $2, $3)',
        [testUserId, testPhoneNumber, 'test@example.com']
      );

      // Step 3: Generate user-specific JWT secrets
      const secrets = await userSecurityManager.generateUserJWTSecrets(testUserId);
      expect(secrets.jwtSecret).toBeDefined();

      // Step 4: Simulate OTP validation (using known test code)
      const crypto = require('crypto');
      const testCode = '123456';
      const hashedCode = crypto.createHash('sha256')
        .update(testCode + process.env.JWT_SECRET)
        .digest('hex');
      
      await pool.query(
        'UPDATE otp_verifications SET otp_code = $1 WHERE id = $2',
        [hashedCode, otpResult.otpId]
      );

      const validation = await otpService.validateOTP(otpResult.otpId, testCode);
      expect(validation.isValid).toBe(true);

      // Step 5: Generate access token with user-specific secret
      const mockUser = {
        id: testUserId,
        email: 'test@example.com',
        phone: testPhoneNumber,
        firstName: 'Test',
        lastName: 'User',
        tenantId: 'test-tenant',
        role: 'USER' as const,
        subscriptionTier: 'FREE' as const,
        isEmailVerified: false,
        isPhoneVerified: true,
        createdAt: new Date(),
        lastLoginAt: new Date()
      };

      const accessToken = await userSecurityManager.generateUserAccessToken(mockUser);
      expect(accessToken).toBeDefined();

      // Step 6: Validate the generated token
      const tokenValidation = await userSecurityManager.validateUserAccessToken(accessToken, testUserId);
      expect(tokenValidation.userId).toBe(testUserId);
    });

    it('should handle pricing validation with user authentication', async () => {
      // Create user and generate secrets
      await pool.query(
        'INSERT INTO users (id, phone_number, email) VALUES ($1, $2, $3)',
        [testUserId, testPhoneNumber, 'test@example.com']
      );

      const secrets = await userSecurityManager.generateUserJWTSecrets(testUserId);

      // Create secure pricing data
      const pricingData = {
        planId: 'premium-plan',
        planName: 'Premium Plan',
        priceAmount: 199.99,
        currency: 'INR',
        billingCycle: 'monthly' as const,
        features: ['Premium Feature 1', 'Premium Feature 2'],
        limits: { emails: 10000, recipients: 50000 },
        isPopular: true
      };

      const signature = pricingService.signPricingData(pricingData);

      // Validate pricing with proper signature
      const validation = pricingService.verifyPricingSignature(
        pricingData.planId,
        pricingData.priceAmount,
        pricingData.currency,
        pricingData.billingCycle,
        signature
      );

      expect(validation).toBe(true);

      // Generate user token for purchase validation
      const userToken = jwt.sign(
        { userId: testUserId, email: 'test@example.com' },
        secrets.jwtSecret,
        { expiresIn: '15m' }
      );

      const tokenValidation = await userSecurityManager.validateUserAccessToken(userToken, testUserId);
      expect(tokenValidation.userId).toBe(testUserId);
    });
  });

  describe('Security Performance Tests', () => {
    it('should handle concurrent JWT secret generation', async () => {
      const userIds = Array.from({ length: 10 }, (_, i) => `concurrent-user-${i}-${Date.now()}`);
      
      // Create test users
      for (const userId of userIds) {
        await pool.query(
          'INSERT INTO users (id, phone_number, email) VALUES ($1, $2, $3)',
          [userId, `+123456789${userIds.indexOf(userId)}`, `test${userIds.indexOf(userId)}@example.com`]
        );
      }

      // Generate secrets concurrently
      const secretPromises = userIds.map(userId => 
        userSecurityManager.generateUserJWTSecrets(userId)
      );

      const results = await Promise.all(secretPromises);

      // Verify all secrets are unique
      const allSecrets = results.flatMap(r => [r.jwtSecret, r.jwtRefreshSecret]);
      const uniqueSecrets = new Set(allSecrets);
      expect(uniqueSecrets.size).toBe(allSecrets.length);

      // Cleanup
      for (const userId of userIds) {
        await pool.query('DELETE FROM users WHERE id = $1', [userId]);
      }
    });

    it('should handle high-volume OTP generation', async () => {
      const phoneNumbers = Array.from({ length: 20 }, (_, i) => `+123456789${i.toString().padStart(2, '0')}`);
      
      const startTime = Date.now();
      
      // Generate OTPs for all phone numbers
      const otpPromises = phoneNumbers.map(phone => 
        otpService.generateOTP(phone, 'registration', `user-${phone}`)
      );

      const results = await Promise.all(otpPromises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (5 seconds for 20 OTPs)
      expect(duration).toBeLessThan(5000);
      expect(results).toHaveLength(20);
      
      // All OTP IDs should be unique
      const otpIds = results.map(r => r.otpId);
      const uniqueIds = new Set(otpIds);
      expect(uniqueIds.size).toBe(otpIds.length);

      // Cleanup
      for (const phone of phoneNumbers) {
        await pool.query('DELETE FROM otp_verifications WHERE phone_number = $1', [phone]);
      }
    });

    it('should handle rapid pricing signature verification', () => {
      const pricingData = {
        planId: 'performance-test-plan',
        planName: 'Performance Test Plan',
        priceAmount: 99.99,
        currency: 'INR',
        billingCycle: 'monthly' as const,
        features: ['Feature 1'],
        limits: { emails: 1000 },
        isPopular: false
      };

      const signature = pricingService.signPricingData(pricingData);
      
      const startTime = Date.now();
      
      // Perform 100 signature verifications
      for (let i = 0; i < 100; i++) {
        const isValid = pricingService.verifyPricingSignature(
          pricingData.planId,
          pricingData.priceAmount,
          pricingData.currency,
          pricingData.billingCycle,
          signature
        );
        expect(isValid).toBe(true);
      }
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Should complete 100 verifications within 1 second
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle database connection failures gracefully', async () => {
      // Mock database failure
      const originalQuery = pool.query;
      pool.query = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      await expect(
        userSecurityManager.generateUserJWTSecrets(testUserId)
      ).rejects.toThrow();

      // Restore original function
      pool.query = originalQuery;
    });

    it('should handle Redis connection failures gracefully', async () => {
      // Disconnect Redis temporarily
      await redisClient.quit();

      // OTP service should still work but without Redis caching
      const result = await otpService.generateOTP(testPhoneNumber, 'registration', testUserId);
      expect(result.otpId).toBeDefined();

      // Reconnect Redis
      await redisClient.connect();
    });

    it('should handle malformed JWT tokens safely', () => {
      const malformedTokens = [
        'not.a.jwt',
        'eyJhbGciOiJub25lIn0..', // None algorithm
        '',
        null,
        undefined
      ];

      malformedTokens.forEach(token => {
        expect(() => {
          pricingService.verifyPricingSignature(
            'test-plan',
            99.99,
            'INR',
            'monthly',
            token as any
          );
        }).not.toThrow(); // Should handle gracefully, not crash
      });
    });
  });
});