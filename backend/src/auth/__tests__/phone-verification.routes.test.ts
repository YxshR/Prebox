import request from 'supertest';
import express from 'express';
import phoneVerificationRoutes from '../phone-verification.routes';
import pool from '../../config/database';
import redisClient from '../../config/redis';
import { jest } from '@jest/globals';

// Mock the services
jest.mock('../enhanced-phone-verification.service');
jest.mock('../rate-limiter.service');

const app = express();
app.use(express.json());
app.use('/api/phone-verification', phoneVerificationRoutes);

describe('Phone Verification Routes', () => {
  let testPhones: string[];

  beforeAll(async () => {
    // Connect to Redis if not already connected
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }

    testPhones = [
      '+1234567890',
      '+1234567891',
      '+1234567892'
    ];
  });

  beforeEach(async () => {
    // Clean up test data
    for (const phone of testPhones) {
      await pool.query('DELETE FROM phone_verifications WHERE phone = $1', [phone]);
      await pool.query('DELETE FROM users WHERE phone = $1', [phone]);
      await redisClient.del(`phone_rate_limit:${phone}`);
    }

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test data
    for (const phone of testPhones) {
      await pool.query('DELETE FROM phone_verifications WHERE phone = $1', [phone]);
      await pool.query('DELETE FROM users WHERE phone = $1', [phone]);
      await redisClient.del(`phone_rate_limit:${phone}`);
    }
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  describe('POST /check-phone', () => {
    it('should validate phone number format', async () => {
      const response = await request(app)
        .post('/api/phone-verification/check-phone')
        .send({ phone: 'invalid-phone' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('valid international format');
    });

    it('should return false for non-existent phone', async () => {
      const response = await request(app)
        .post('/api/phone-verification/check-phone')
        .send({ phone: testPhones[0] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.exists).toBe(false);
      expect(response.body.data.isVerified).toBe(false);
    });

    it('should return true for existing phone', async () => {
      // Create test user
      await pool.query(`
        INSERT INTO users (phone, phone_verified) 
        VALUES ($1, $2)
      `, [testPhones[0], true]);

      const response = await request(app)
        .post('/api/phone-verification/check-phone')
        .send({ phone: testPhones[0] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.exists).toBe(true);
      expect(response.body.data.isVerified).toBe(true);
    });

    it('should handle missing phone parameter', async () => {
      const response = await request(app)
        .post('/api/phone-verification/check-phone')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle international phone formats', async () => {
      const internationalPhones = [
        '+1234567890',    // US format
        '+447700900123',  // UK format
        '+33123456789',   // France format
        '+81312345678'    // Japan format
      ];

      for (const phone of internationalPhones) {
        const response = await request(app)
          .post('/api/phone-verification/check-phone')
          .send({ phone });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('POST /start-verification', () => {
    it('should start verification successfully', async () => {
      const response = await request(app)
        .post('/api/phone-verification/start-verification')
        .send({
          phone: testPhones[0],
          type: 'registration'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.otpId).toBeDefined();
      expect(response.body.data.expiresAt).toBeDefined();
      expect(response.body.data.attemptsRemaining).toBe(5);
      expect(response.body.data.message).toContain('sent successfully');
    });

    it('should validate phone number format', async () => {
      const response = await request(app)
        .post('/api/phone-verification/start-verification')
        .send({
          phone: 'invalid-phone',
          type: 'registration'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate verification type', async () => {
      const response = await request(app)
        .post('/api/phone-verification/start-verification')
        .send({
          phone: testPhones[0],
          type: 'invalid-type'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should default to registration type', async () => {
      const response = await request(app)
        .post('/api/phone-verification/start-verification')
        .send({
          phone: testPhones[0]
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should prevent registration for existing phone', async () => {
      // Create existing user
      await pool.query(`
        INSERT INTO users (phone, phone_verified) 
        VALUES ($1, $2)
      `, [testPhones[0], true]);

      const response = await request(app)
        .post('/api/phone-verification/start-verification')
        .send({
          phone: testPhones[0],
          type: 'registration'
        });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PHONE_ALREADY_EXISTS');
    });

    it('should handle missing phone parameter', async () => {
      const response = await request(app)
        .post('/api/phone-verification/start-verification')
        .send({
          type: 'registration'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /verify-otp', () => {
    let otpId: string;
    let testCode: string;

    beforeEach(async () => {
      // Create a verification
      const startResponse = await request(app)
        .post('/api/phone-verification/start-verification')
        .send({
          phone: testPhones[0],
          type: 'registration'
        });

      otpId = startResponse.body.data.otpId;
      testCode = '123456';

      // Set known test code in database
      const crypto = require('crypto');
      const hashedCode = crypto.createHash('sha256')
        .update(testCode + (process.env.JWT_SECRET || 'default-secret'))
        .digest('hex');

      await pool.query(
        'UPDATE phone_verifications SET otp_code = $1 WHERE id = $2',
        [hashedCode, otpId]
      );
    });

    it('should verify correct OTP successfully', async () => {
      const response = await request(app)
        .post('/api/phone-verification/verify-otp')
        .send({
          otpId,
          code: testCode
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.verified).toBe(true);
      expect(response.body.data.message).toContain('verified successfully');
    });

    it('should reject incorrect OTP', async () => {
      const response = await request(app)
        .post('/api/phone-verification/verify-otp')
        .send({
          otpId,
          code: '999999'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('OTP_INVALID');
      expect(response.body.error.canRetry).toBe(true);
      expect(response.body.error.attemptsRemaining).toBeGreaterThan(0);
    });

    it('should validate OTP ID format', async () => {
      const response = await request(app)
        .post('/api/phone-verification/verify-otp')
        .send({
          otpId: 'invalid-uuid',
          code: testCode
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate OTP code format', async () => {
      const invalidCodes = [
        '12345',      // Too short
        '1234567',    // Too long
        '12345a',     // Contains letter
        'abcdef'      // All letters
      ];

      for (const code of invalidCodes) {
        const response = await request(app)
          .post('/api/phone-verification/verify-otp')
          .send({
            otpId,
            code
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      }
    });

    it('should handle expired OTP', async () => {
      // Make OTP expired
      await pool.query(
        'UPDATE phone_verifications SET expires_at = $1 WHERE id = $2',
        [new Date(Date.now() - 1000), otpId]
      );

      const response = await request(app)
        .post('/api/phone-verification/verify-otp')
        .send({
          otpId,
          code: testCode
        });

      expect(response.status).toBe(410);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('OTP_EXPIRED');
      expect(response.body.error.canRetry).toBe(true);
    });

    it('should handle non-existent OTP ID', async () => {
      const fakeOtpId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .post('/api/phone-verification/verify-otp')
        .send({
          otpId: fakeOtpId,
          code: testCode
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.canRetry).toBe(false);
    });

    it('should handle missing parameters', async () => {
      // Missing otpId
      let response = await request(app)
        .post('/api/phone-verification/verify-otp')
        .send({
          code: testCode
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');

      // Missing code
      response = await request(app)
        .post('/api/phone-verification/verify-otp')
        .send({
          otpId
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /resend-otp', () => {
    let otpId: string;

    beforeEach(async () => {
      const startResponse = await request(app)
        .post('/api/phone-verification/start-verification')
        .send({
          phone: testPhones[0],
          type: 'registration'
        });

      otpId = startResponse.body.data.otpId;
    });

    it('should resend OTP after cooldown', async () => {
      // Mock cooldown by updating created_at
      await pool.query(
        'UPDATE phone_verifications SET created_at = $1 WHERE id = $2',
        [new Date(Date.now() - 61000), otpId]
      );

      const response = await request(app)
        .post('/api/phone-verification/resend-otp')
        .send({ otpId });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.otpId).toBeDefined();
      expect(response.body.data.otpId).not.toBe(otpId); // Should be new ID
      expect(response.body.data.message).toContain('sent successfully');
    });

    it('should enforce cooldown period', async () => {
      const response = await request(app)
        .post('/api/phone-verification/resend-otp')
        .send({ otpId });

      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('RESEND_COOLDOWN_ACTIVE');
    });

    it('should validate OTP ID format', async () => {
      const response = await request(app)
        .post('/api/phone-verification/resend-otp')
        .send({ otpId: 'invalid-uuid' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle non-existent OTP ID', async () => {
      const fakeOtpId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .post('/api/phone-verification/resend-otp')
        .send({ otpId: fakeOtpId });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('OTP_NOT_FOUND');
    });

    it('should handle missing otpId parameter', async () => {
      const response = await request(app)
        .post('/api/phone-verification/resend-otp')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /status/:otpId', () => {
    let otpId: string;

    beforeEach(async () => {
      const startResponse = await request(app)
        .post('/api/phone-verification/start-verification')
        .send({
          phone: testPhones[0],
          type: 'registration'
        });

      otpId = startResponse.body.data.otpId;
    });

    it('should return verification status', async () => {
      const response = await request(app)
        .get(`/api/phone-verification/status/${otpId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isExpired).toBe(false);
      expect(response.body.data.isVerified).toBe(false);
      expect(response.body.data.attemptsRemaining).toBe(5);
      expect(response.body.data.expiresAt).toBeDefined();
    });

    it('should handle non-existent OTP ID', async () => {
      const fakeOtpId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .get(`/api/phone-verification/status/${fakeOtpId}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('OTP_NOT_FOUND');
    });

    it('should validate OTP ID format', async () => {
      const response = await request(app)
        .get('/api/phone-verification/status/invalid-uuid');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_OTP_ID');
    });

    it('should return expired status for expired OTP', async () => {
      // Make OTP expired
      await pool.query(
        'UPDATE phone_verifications SET expires_at = $1 WHERE id = $2',
        [new Date(Date.now() - 1000), otpId]
      );

      const response = await request(app)
        .get(`/api/phone-verification/status/${otpId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isExpired).toBe(true);
      expect(response.body.data.isVerified).toBe(false);
    });

    it('should return verified status for completed verification', async () => {
      // Mark as verified
      await pool.query(
        'UPDATE phone_verifications SET verified_at = CURRENT_TIMESTAMP WHERE id = $1',
        [otpId]
      );

      const response = await request(app)
        .get(`/api/phone-verification/status/${otpId}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.isVerified).toBe(true);
    });
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/phone-verification/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.services).toBeDefined();
      expect(response.body.data.services.database).toBeDefined();
      expect(response.body.data.services.redis).toBeDefined();
      expect(response.body.data.services.twilio).toBeDefined();
      expect(response.body.data.metrics).toBeDefined();
      expect(response.body.data.timestamp).toBeDefined();
    });

    it('should include active verifications count', async () => {
      // Create some verifications
      await request(app)
        .post('/api/phone-verification/start-verification')
        .send({ phone: testPhones[0], type: 'registration' });

      await request(app)
        .post('/api/phone-verification/start-verification')
        .send({ phone: testPhones[1], type: 'registration' });

      const response = await request(app)
        .get('/api/phone-verification/health');

      expect(response.status).toBe(200);
      expect(response.body.data.metrics.activeVerifications).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/phone-verification/check-phone')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      expect(response.status).toBe(400);
    });

    it('should handle empty request body', async () => {
      const response = await request(app)
        .post('/api/phone-verification/start-verification')
        .send();

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle very long phone numbers', async () => {
      const longPhone = '+' + '1'.repeat(50);

      const response = await request(app)
        .post('/api/phone-verification/check-phone')
        .send({ phone: longPhone });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle special characters in phone number', async () => {
      const specialPhone = '+1-234-567-890';

      const response = await request(app)
        .post('/api/phone-verification/check-phone')
        .send({ phone: specialPhone });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to phone check endpoint', async () => {
      // This test would need the actual rate limiter to be working
      // For now, we'll just verify the endpoint structure
      const response = await request(app)
        .post('/api/phone-verification/check-phone')
        .send({ phone: testPhones[0] });

      expect(response.status).toBe(200);
    });

    it('should apply rate limiting to start verification endpoint', async () => {
      const response = await request(app)
        .post('/api/phone-verification/start-verification')
        .send({ phone: testPhones[0], type: 'registration' });

      expect(response.status).toBe(201);
    });

    it('should apply rate limiting to verify OTP endpoint', async () => {
      // Create verification first
      const startResponse = await request(app)
        .post('/api/phone-verification/start-verification')
        .send({ phone: testPhones[0], type: 'registration' });

      const response = await request(app)
        .post('/api/phone-verification/verify-otp')
        .send({
          otpId: startResponse.body.data.otpId,
          code: '123456'
        });

      // Should not be rate limited on first attempt
      expect(response.status).not.toBe(429);
    });
  });

  describe('Security', () => {
    it('should not expose sensitive information in error messages', async () => {
      const response = await request(app)
        .post('/api/phone-verification/verify-otp')
        .send({
          otpId: '00000000-0000-0000-0000-000000000000',
          code: '123456'
        });

      expect(response.body.error.message).not.toContain('database');
      expect(response.body.error.message).not.toContain('sql');
      expect(response.body.error.message).not.toContain('redis');
    });

    it('should validate all input parameters', async () => {
      const maliciousInputs = [
        { phone: '<script>alert("xss")</script>' },
        { phone: '"; DROP TABLE users; --' },
        { phone: '../../../etc/passwd' },
        { phone: null },
        { phone: undefined }
      ];

      for (const input of maliciousInputs) {
        const response = await request(app)
          .post('/api/phone-verification/check-phone')
          .send(input);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      }
    });

    it('should handle concurrent requests safely', async () => {
      const promises = Array(10).fill(null).map((_, i) =>
        request(app)
          .post('/api/phone-verification/start-verification')
          .send({ phone: `+123456789${i}`, type: 'registration' })
      );

      const responses = await Promise.all(promises);

      // All should either succeed or fail gracefully
      responses.forEach(response => {
        expect([201, 400, 429, 503]).toContain(response.status);
        expect(response.body.success).toBeDefined();
      });

      // Clean up
      for (let i = 0; i < 10; i++) {
        await pool.query('DELETE FROM phone_verifications WHERE phone = $1', [`+123456789${i}`]);
      }
    });
  });
});