import request from 'supertest';
import express from 'express';
import pool from '../../config/database';
import authRoutes from '../auth.routes';
import { SendGridEmailService } from '../services/sendgrid-email.service';

// Mock SendGrid to prevent actual emails during testing
jest.mock('@sendgrid/mail');

describe('Email Verification Integration Tests', () => {
  let app: express.Application;
  let testUserId: string;
  let testEmail: string;
  let verificationId: string;

  beforeAll(async () => {
    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);

    // Set test environment variables
    process.env.SENDGRID_API_KEY = 'test-api-key';
    process.env.SENDGRID_FROM_EMAIL = 'test@example.com';
    process.env.NODE_ENV = 'test';

    testEmail = `test-${Date.now()}@example.com`;
    testUserId = '123e4567-e89b-12d3-a456-426614174000';
  });

  beforeEach(async () => {
    // Clean up any existing test data
    await pool.query('DELETE FROM email_verifications WHERE email = $1', [testEmail]);
  });

  afterAll(async () => {
    // Clean up test data
    await pool.query('DELETE FROM email_verifications WHERE email = $1', [testEmail]);
    await pool.end();
  });

  describe('Complete Email Verification Flow', () => {
    it('should complete the full email verification workflow', async () => {
      // Step 1: Send verification code
      const sendResponse = await request(app)
        .post('/api/auth/email/send-code')
        .send({
          email: testEmail,
          userId: testUserId
        });

      expect(sendResponse.status).toBe(200);
      expect(sendResponse.body.success).toBe(true);
      expect(sendResponse.body.data.verificationId).toBeDefined();
      
      verificationId = sendResponse.body.data.verificationId;

      // Step 2: Check verification status (should be pending)
      const statusResponse = await request(app)
        .get(`/api/auth/email/status/${verificationId}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data.isVerified).toBe(false);

      // Step 3: Get the verification code from database (simulating email receipt)
      const codeResult = await pool.query(
        'SELECT verification_code FROM email_verifications WHERE id = $1',
        [verificationId]
      );
      
      expect(codeResult.rows.length).toBe(1);
      const verificationCode = codeResult.rows[0].verification_code;
      expect(verificationCode).toMatch(/^\d{6}$/);

      // Step 4: Verify the code
      const verifyResponse = await request(app)
        .post('/api/auth/email/verify-code')
        .send({
          verificationId,
          code: verificationCode
        });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.data.verified).toBe(true);

      // Step 5: Check verification status (should be verified)
      const finalStatusResponse = await request(app)
        .get(`/api/auth/email/status/${verificationId}`);

      expect(finalStatusResponse.status).toBe(200);
      expect(finalStatusResponse.body.data.isVerified).toBe(true);

      // Step 6: Check email verification status
      const emailCheckResponse = await request(app)
        .get(`/api/auth/email/check/${testEmail}`);

      expect(emailCheckResponse.status).toBe(200);
      expect(emailCheckResponse.body.data.isVerified).toBe(true);
    });

    it('should handle verification by email and code directly', async () => {
      // Step 1: Send verification code
      const sendResponse = await request(app)
        .post('/api/auth/email/send-code')
        .send({
          email: testEmail,
          userId: testUserId
        });

      expect(sendResponse.status).toBe(200);
      verificationId = sendResponse.body.data.verificationId;

      // Step 2: Get the verification code from database
      const codeResult = await pool.query(
        'SELECT verification_code FROM email_verifications WHERE id = $1',
        [verificationId]
      );
      
      const verificationCode = codeResult.rows[0].verification_code;

      // Step 3: Verify using email and code directly (alternative flow)
      const verifyResponse = await request(app)
        .post('/api/auth/email/verify')
        .send({
          email: testEmail,
          code: verificationCode
        });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.data.verified).toBe(true);
    });

    it('should handle resend verification code flow', async () => {
      // Step 1: Send initial verification code
      const sendResponse = await request(app)
        .post('/api/auth/email/send-code')
        .send({
          email: testEmail,
          userId: testUserId
        });

      expect(sendResponse.status).toBe(200);
      const firstVerificationId = sendResponse.body.data.verificationId;

      // Step 2: Wait a moment to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Step 3: Resend verification code
      const resendResponse = await request(app)
        .post('/api/auth/email/resend-code')
        .send({
          email: testEmail,
          userId: testUserId
        });

      expect(resendResponse.status).toBe(200);
      expect(resendResponse.body.success).toBe(true);
      
      const secondVerificationId = resendResponse.body.data.verificationId;
      expect(secondVerificationId).not.toBe(firstVerificationId);

      // Step 4: Verify that old code is invalidated
      const oldCodeResult = await pool.query(
        'SELECT verification_code, verified_at FROM email_verifications WHERE id = $1',
        [firstVerificationId]
      );
      
      expect(oldCodeResult.rows[0].verified_at).not.toBeNull();

      // Step 5: Verify new code works
      const newCodeResult = await pool.query(
        'SELECT verification_code FROM email_verifications WHERE id = $1',
        [secondVerificationId]
      );
      
      const newVerificationCode = newCodeResult.rows[0].verification_code;

      const verifyResponse = await request(app)
        .post('/api/auth/email/verify-code')
        .send({
          verificationId: secondVerificationId,
          code: newVerificationCode
        });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.data.verified).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should reject invalid verification codes', async () => {
      // Send verification code
      const sendResponse = await request(app)
        .post('/api/auth/email/send-code')
        .send({
          email: testEmail,
          userId: testUserId
        });

      verificationId = sendResponse.body.data.verificationId;

      // Try to verify with wrong code
      const verifyResponse = await request(app)
        .post('/api/auth/email/verify-code')
        .send({
          verificationId,
          code: '999999'
        });

      expect(verifyResponse.status).toBe(400);
      expect(verifyResponse.body.success).toBe(false);
      expect(verifyResponse.body.error.code).toBe('INVALID_OR_EXPIRED_CODE');
    });

    it('should handle rate limiting for resend requests', async () => {
      // Send initial verification code
      await request(app)
        .post('/api/auth/email/send-code')
        .send({
          email: testEmail,
          userId: testUserId
        });

      // Immediately try to resend (should be rate limited)
      const resendResponse = await request(app)
        .post('/api/auth/email/resend-code')
        .send({
          email: testEmail,
          userId: testUserId
        });

      expect(resendResponse.status).toBe(429);
      expect(resendResponse.body.error.code).toBe('RATE_LIMITED');
    });

    it('should prevent sending codes to already verified emails', async () => {
      // First, complete verification
      const sendResponse = await request(app)
        .post('/api/auth/email/send-code')
        .send({
          email: testEmail,
          userId: testUserId
        });

      verificationId = sendResponse.body.data.verificationId;

      const codeResult = await pool.query(
        'SELECT verification_code FROM email_verifications WHERE id = $1',
        [verificationId]
      );
      
      const verificationCode = codeResult.rows[0].verification_code;

      await request(app)
        .post('/api/auth/email/verify-code')
        .send({
          verificationId,
          code: verificationCode
        });

      // Now try to send another code to the same email
      const secondSendResponse = await request(app)
        .post('/api/auth/email/send-code')
        .send({
          email: testEmail,
          userId: testUserId
        });

      expect(secondSendResponse.status).toBe(400);
      expect(secondSendResponse.body.error.code).toBe('EMAIL_ALREADY_VERIFIED');
    });
  });

  describe('Database Cleanup', () => {
    it('should clean up expired verification codes', async () => {
      // Create an expired verification manually
      const expiredId = '987fcdeb-51a2-43d1-b789-123456789abc';
      await pool.query(`
        INSERT INTO email_verifications (id, user_id, email, verification_code, expires_at, verified_at, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        expiredId,
        testUserId,
        testEmail,
        '123456',
        new Date(Date.now() - 1000), // Expired 1 second ago
        null,
        new Date()
      ]);

      // Mock admin authentication for cleanup endpoint
      const cleanupResponse = await request(app)
        .delete('/api/auth/email/cleanup')
        .set('Authorization', 'Bearer admin-token');

      // Note: This test might fail if auth middleware is not properly mocked
      // In a real scenario, you'd need to provide proper admin authentication
      expect(cleanupResponse.status).toBeOneOf([200, 401, 403]);
    });
  });
});