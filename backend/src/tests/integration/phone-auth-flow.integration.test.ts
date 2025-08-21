/**
 * Integration tests for complete phone-only authentication flow
 * Requirements: 6.1, 6.2, 6.5
 */

import request from 'supertest';
import express from 'express';
import { authRoutes } from '../../auth/auth.routes';
import { UserSecurityManager } from '../../auth/user-security-manager.service';
import { SecureOTPService } from '../../auth/secure-otp.service';
import pool from '../../config/database';
import redisClient from '../../config/redis';

// Create test app
const app = express();
app.use(express.json());
app.use('/auth', authRoutes);

describe('Phone-Only Authentication Flow Integration', () => {
  let testPhoneNumber: string;
  let testUserId: string;
  let otpId: string;
  let userSecurityManager: UserSecurityManager;
  let otpService: SecureOTPService;

  beforeAll(async () => {
    userSecurityManager = new UserSecurityManager();
    otpService = new SecureOTPService({
      expiryMinutes: 10,
      maxAttempts: 3,
      rateLimitWindow: 60,
      maxOTPsPerWindow: 5,
      codeLength: 6
    });

    // Ensure Redis connection
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  });

  beforeEach(() => {
    testPhoneNumber = `+91${Date.now().toString().slice(-10)}`;
    testUserId = `test-user-${Date.now()}`;
  });

  afterEach(async () => {
    // Cleanup test data
    await pool.query('DELETE FROM users WHERE phone_number = $1', [testPhoneNumber]);
    await pool.query('DELETE FROM otp_verifications WHERE phone_number = $1', [testPhoneNumber]);
    await redisClient.del(`otp_rate_limit:${testPhoneNumber}`);
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  describe('Complete Registration Flow', () => {
    it('should complete phone-only registration successfully', async () => {
      // Step 1: Request OTP for registration
      const otpResponse = await request(app)
        .post('/auth/request-otp')
        .send({
          phoneNumber: testPhoneNumber,
          type: 'registration'
        })
        .expect(200);

      expect(otpResponse.body.success).toBe(true);
      expect(otpResponse.body.otpId).toBeDefined();
      expect(otpResponse.body.expiresAt).toBeDefined();
      expect(otpResponse.body.attemptsRemaining).toBe(3);

      otpId = otpResponse.body.otpId;

      // Step 2: Verify OTP and complete registration
      // For testing, we need to set a known OTP code
      const testCode = '123456';
      const crypto = require('crypto');
      const hashedCode = crypto.createHash('sha256')
        .update(testCode + process.env.JWT_SECRET)
        .digest('hex');
      
      await pool.query(
        'UPDATE otp_verifications SET otp_code = $1 WHERE id = $2',
        [hashedCode, otpId]
      );

      const verifyResponse = await request(app)
        .post('/auth/verify-otp')
        .send({
          otpId: otpId,
          code: testCode,
          userData: {
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com'
          }
        })
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.user).toBeDefined();
      expect(verifyResponse.body.user.phoneNumber).toBe(testPhoneNumber);
      expect(verifyResponse.body.user.isPhoneVerified).toBe(true);
      expect(verifyResponse.body.accessToken).toBeDefined();
      expect(verifyResponse.body.refreshToken).toBeDefined();

      // Step 3: Verify user was created with JWT secrets
      const userResult = await pool.query(
        'SELECT id, jwt_secret, jwt_refresh_secret FROM users WHERE phone_number = $1',
        [testPhoneNumber]
      );

      expect(userResult.rows).toHaveLength(1);
      const user = userResult.rows[0];
      expect(user.jwt_secret).toBeDefined();
      expect(user.jwt_refresh_secret).toBeDefined();
      expect(user.jwt_secret.length).toBeGreaterThan(32);
      expect(user.jwt_refresh_secret.length).toBeGreaterThan(32);

      testUserId = user.id;
    });

    it('should handle duplicate phone number registration', async () => {
      // Create existing user
      await pool.query(
        'INSERT INTO users (id, phone_number, email, is_phone_verified) VALUES ($1, $2, $3, $4)',
        [testUserId, testPhoneNumber, 'existing@example.com', true]
      );

      // Try to register with same phone number
      const response = await request(app)
        .post('/auth/request-otp')
        .send({
          phoneNumber: testPhoneNumber,
          type: 'registration'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already registered');
    });

    it('should enforce rate limiting on OTP requests', async () => {
      // Make maximum allowed requests
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/auth/request-otp')
          .send({
            phoneNumber: testPhoneNumber,
            type: 'registration'
          })
          .expect(200);
      }

      // Next request should be rate limited
      const response = await request(app)
        .post('/auth/request-otp')
        .send({
          phoneNumber: testPhoneNumber,
          type: 'registration'
        })
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('rate limit');
    });
  });

  describe('Login Flow', () => {
    beforeEach(async () => {
      // Create verified user for login tests
      await pool.query(
        'INSERT INTO users (id, phone_number, email, is_phone_verified, first_name, last_name) VALUES ($1, $2, $3, $4, $5, $6)',
        [testUserId, testPhoneNumber, 'test@example.com', true, 'Test', 'User']
      );

      // Generate JWT secrets for the user
      await userSecurityManager.generateUserJWTSecrets(testUserId);
    });

    it('should complete phone-only login successfully', async () => {
      // Step 1: Request OTP for login
      const otpResponse = await request(app)
        .post('/auth/request-otp')
        .send({
          phoneNumber: testPhoneNumber,
          type: 'login'
        })
        .expect(200);

      expect(otpResponse.body.success).toBe(true);
      expect(otpResponse.body.otpId).toBeDefined();

      otpId = otpResponse.body.otpId;

      // Step 2: Verify OTP and complete login
      const testCode = '654321';
      const crypto = require('crypto');
      const hashedCode = crypto.createHash('sha256')
        .update(testCode + process.env.JWT_SECRET)
        .digest('hex');
      
      await pool.query(
        'UPDATE otp_verifications SET otp_code = $1 WHERE id = $2',
        [hashedCode, otpId]
      );

      const verifyResponse = await request(app)
        .post('/auth/verify-otp')
        .send({
          otpId: otpId,
          code: testCode
        })
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.user).toBeDefined();
      expect(verifyResponse.body.user.phoneNumber).toBe(testPhoneNumber);
      expect(verifyResponse.body.accessToken).toBeDefined();
      expect(verifyResponse.body.refreshToken).toBeDefined();

      // Step 3: Verify tokens are user-specific
      const accessToken = verifyResponse.body.accessToken;
      const validation = await userSecurityManager.validateUserAccessToken(accessToken, testUserId);
      
      expect(validation.userId).toBe(testUserId);
      expect(validation.email).toBe('test@example.com');
    });

    it('should reject login for non-existent phone number', async () => {
      const nonExistentPhone = '+919999999999';

      const response = await request(app)
        .post('/auth/request-otp')
        .send({
          phoneNumber: nonExistentPhone,
          type: 'login'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should reject login for unverified phone number', async () => {
      // Create unverified user
      const unverifiedUserId = `unverified-${Date.now()}`;
      const unverifiedPhone = `+91${Date.now().toString().slice(-10)}`;
      
      await pool.query(
        'INSERT INTO users (id, phone_number, email, is_phone_verified) VALUES ($1, $2, $3, $4)',
        [unverifiedUserId, unverifiedPhone, 'unverified@example.com', false]
      );

      const response = await request(app)
        .post('/auth/request-otp')
        .send({
          phoneNumber: unverifiedPhone,
          type: 'login'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not verified');

      // Cleanup
      await pool.query('DELETE FROM users WHERE id = $1', [unverifiedUserId]);
    });
  });

  describe('Token Refresh Flow', () => {
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      // Create verified user
      await pool.query(
        'INSERT INTO users (id, phone_number, email, is_phone_verified, first_name, last_name) VALUES ($1, $2, $3, $4, $5, $6)',
        [testUserId, testPhoneNumber, 'test@example.com', true, 'Test', 'User']
      );

      // Generate JWT secrets
      await userSecurityManager.generateUserJWTSecrets(testUserId);

      // Complete login to get tokens
      const otpResponse = await request(app)
        .post('/auth/request-otp')
        .send({
          phoneNumber: testPhoneNumber,
          type: 'login'
        });

      otpId = otpResponse.body.otpId;

      const testCode = '111111';
      const crypto = require('crypto');
      const hashedCode = crypto.createHash('sha256')
        .update(testCode + process.env.JWT_SECRET)
        .digest('hex');
      
      await pool.query(
        'UPDATE otp_verifications SET otp_code = $1 WHERE id = $2',
        [hashedCode, otpId]
      );

      const verifyResponse = await request(app)
        .post('/auth/verify-otp')
        .send({
          otpId: otpId,
          code: testCode
        });

      accessToken = verifyResponse.body.accessToken;
      refreshToken = verifyResponse.body.refreshToken;
    });

    it('should refresh tokens using user-specific secrets', async () => {
      const response = await request(app)
        .post('/auth/refresh-token')
        .send({
          refreshToken: refreshToken
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.accessToken).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
      expect(response.body.accessToken).not.toBe(accessToken);
      expect(response.body.refreshToken).not.toBe(refreshToken);

      // Verify new tokens are valid
      const validation = await userSecurityManager.validateUserAccessToken(
        response.body.accessToken, 
        testUserId
      );
      expect(validation.userId).toBe(testUserId);
    });

    it('should reject invalid refresh tokens', async () => {
      const response = await request(app)
        .post('/auth/refresh-token')
        .send({
          refreshToken: 'invalid.refresh.token'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid refresh token');
    });

    it('should reject refresh tokens from different users', async () => {
      // Create another user
      const otherUserId = `other-user-${Date.now()}`;
      const otherPhone = `+91${Date.now().toString().slice(-10)}`;
      
      await pool.query(
        'INSERT INTO users (id, phone_number, email, is_phone_verified) VALUES ($1, $2, $3, $4)',
        [otherUserId, otherPhone, 'other@example.com', true]
      );

      const otherSecrets = await userSecurityManager.generateUserJWTSecrets(otherUserId);

      // Generate refresh token for other user
      const jwt = require('jsonwebtoken');
      const otherRefreshToken = jwt.sign(
        { userId: otherUserId },
        otherSecrets.jwtRefreshSecret,
        { expiresIn: '7d' }
      );

      const response = await request(app)
        .post('/auth/refresh-token')
        .send({
          refreshToken: otherRefreshToken
        })
        .expect(401);

      expect(response.body.success).toBe(false);

      // Cleanup
      await pool.query('DELETE FROM users WHERE id = $1', [otherUserId]);
    });
  });

  describe('OTP Security Features', () => {
    it('should enforce maximum validation attempts', async () => {
      // Request OTP
      const otpResponse = await request(app)
        .post('/auth/request-otp')
        .send({
          phoneNumber: testPhoneNumber,
          type: 'registration'
        });

      otpId = otpResponse.body.otpId;

      // Make 3 failed attempts
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/auth/verify-otp')
          .send({
            otpId: otpId,
            code: '999999'
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.attemptsRemaining).toBe(2 - i);
      }

      // Next attempt should be blocked
      const blockedResponse = await request(app)
        .post('/auth/verify-otp')
        .send({
          otpId: otpId,
          code: '123456'
        })
        .expect(429);

      expect(blockedResponse.body.success).toBe(false);
      expect(blockedResponse.body.error).toContain('Maximum attempts exceeded');
    });

    it('should handle OTP expiration', async () => {
      // Request OTP
      const otpResponse = await request(app)
        .post('/auth/request-otp')
        .send({
          phoneNumber: testPhoneNumber,
          type: 'registration'
        });

      otpId = otpResponse.body.otpId;

      // Set OTP as expired
      await pool.query(
        'UPDATE otp_verifications SET expires_at = $1 WHERE id = $2',
        [new Date(Date.now() - 1000), otpId]
      );

      const response = await request(app)
        .post('/auth/verify-otp')
        .send({
          otpId: otpId,
          code: '123456'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('expired');
    });

    it('should allow OTP resend with rate limiting', async () => {
      // Request initial OTP
      const otpResponse = await request(app)
        .post('/auth/request-otp')
        .send({
          phoneNumber: testPhoneNumber,
          type: 'registration'
        });

      otpId = otpResponse.body.otpId;

      // Immediate resend should be rate limited
      const immediateResendResponse = await request(app)
        .post('/auth/resend-otp')
        .send({
          otpId: otpId
        })
        .expect(429);

      expect(immediateResendResponse.body.success).toBe(false);
      expect(immediateResendResponse.body.error).toContain('wait');

      // Mock time passage for resend (in real implementation, would wait)
      await pool.query(
        'UPDATE otp_verifications SET created_at = $1 WHERE id = $2',
        [new Date(Date.now() - 61000), otpId] // 61 seconds ago
      );

      const resendResponse = await request(app)
        .post('/auth/resend-otp')
        .send({
          otpId: otpId
        })
        .expect(200);

      expect(resendResponse.body.success).toBe(true);
      expect(resendResponse.body.otpId).toBeDefined();
      expect(resendResponse.body.otpId).not.toBe(otpId); // New OTP ID
    });
  });

  describe('Security Validation', () => {
    it('should validate phone number format', async () => {
      const invalidPhones = [
        '123456789',      // No country code
        '+1234',          // Too short
        'not-a-phone',    // Invalid format
        '+91 98765 43210 123' // Too long
      ];

      for (const phone of invalidPhones) {
        const response = await request(app)
          .post('/auth/request-otp')
          .send({
            phoneNumber: phone,
            type: 'registration'
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Invalid phone number');
      }
    });

    it('should sanitize and validate user input', async () => {
      // Request OTP
      const otpResponse = await request(app)
        .post('/auth/request-otp')
        .send({
          phoneNumber: testPhoneNumber,
          type: 'registration'
        });

      otpId = otpResponse.body.otpId;

      // Set known OTP
      const testCode = '123456';
      const crypto = require('crypto');
      const hashedCode = crypto.createHash('sha256')
        .update(testCode + process.env.JWT_SECRET)
        .digest('hex');
      
      await pool.query(
        'UPDATE otp_verifications SET otp_code = $1 WHERE id = $2',
        [hashedCode, otpId]
      );

      // Try registration with malicious input
      const response = await request(app)
        .post('/auth/verify-otp')
        .send({
          otpId: otpId,
          code: testCode,
          userData: {
            firstName: '<script>alert("xss")</script>John',
            lastName: 'Doe<img src=x onerror=alert("xss")>',
            email: '  TEST@EXAMPLE.COM  '
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify data was sanitized
      const user = response.body.user;
      expect(user.firstName).not.toContain('<script>');
      expect(user.lastName).not.toContain('<img');
      expect(user.email).toBe('test@example.com'); // Lowercase and trimmed
    });

    it('should prevent OTP enumeration attacks', async () => {
      // Request OTP
      const otpResponse = await request(app)
        .post('/auth/request-otp')
        .send({
          phoneNumber: testPhoneNumber,
          type: 'registration'
        });

      otpId = otpResponse.body.otpId;

      // Try multiple wrong codes - response time should be consistent
      const wrongCodes = ['000000', '111111', '222222', '333333'];
      const responseTimes: number[] = [];

      for (const code of wrongCodes) {
        const startTime = Date.now();
        
        await request(app)
          .post('/auth/verify-otp')
          .send({
            otpId: otpId,
            code: code
          })
          .expect(400);

        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      // Response times should be relatively consistent (within 100ms variance)
      const avgTime = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
      const maxVariance = Math.max(...responseTimes.map(t => Math.abs(t - avgTime)));
      
      expect(maxVariance).toBeLessThan(100);
    });
  });
});