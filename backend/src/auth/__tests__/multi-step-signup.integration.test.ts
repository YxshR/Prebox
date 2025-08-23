/**
 * Multi-Step Phone Signup Integration Tests
 * 
 * Tests the complete multi-step phone signup flow including:
 * - Starting phone signup
 * - Phone verification
 * - Email verification
 * - Signup completion
 * - Error handling and constraint violations
 */

import request from 'supertest';
import { Express } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AuthDatabaseService } from '../services/auth-database.service';
import { SignupStateManager } from '../services/signup-state-manager.service';
import { MultiStepSignupService } from '../services/multi-step-signup.service';
import { DatabaseService } from '../../database/database.service';
import redisClient from '../../config/redis';

// Mock app setup (you'll need to adjust this based on your app structure)
let app: Express;
let authDb: AuthDatabaseService;
let stateManager: SignupStateManager;
let signupService: MultiStepSignupService;

beforeAll(async () => {
  // Initialize test app and services
  // This would typically be imported from your main app or test setup
  authDb = new AuthDatabaseService();
  stateManager = new SignupStateManager();
  signupService = new MultiStepSignupService();
});

afterAll(async () => {
  // Cleanup
  await redisClient.quit();
});

beforeEach(async () => {
  // Clean up test data before each test
  await cleanupTestData();
});

afterEach(async () => {
  // Clean up test data after each test
  await cleanupTestData();
});

async function cleanupTestData() {
  try {
    // Clean up Redis signup states
    const keys = await redisClient.keys('signup_state:*');
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }

    // Clean up test users from database
    const db = DatabaseService.getInstance();
    await db.query('DELETE FROM users WHERE email LIKE $1 OR phone LIKE $2', 
      ['%test@example.com%', '%+1234567890%']);
  } catch (error) {
    console.warn('Cleanup error:', error);
  }
}

describe('Multi-Step Phone Signup Integration Tests', () => {
  const testPhone = '+1234567890';
  const testEmail = 'test@example.com';
  const testPassword = 'TestPass123';

  describe('POST /api/auth/signup/phone/start', () => {
    it('should start phone signup successfully', async () => {
      const response = await request(app)
        .post('/api/auth/signup/phone/start')
        .send({ phone: testPhone })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('signupStateId');
      expect(response.body.data).toHaveProperty('otpId');
      expect(response.body.data.message).toContain('OTP sent');

      // Verify signup state was created
      const signupState = await stateManager.getSignupState(response.body.data.signupStateId);
      expect(signupState).toBeTruthy();
      expect(signupState?.phone).toBe(testPhone);
      expect(signupState?.phoneVerified).toBe(false);
    });

    it('should reject invalid phone number format', async () => {
      const response = await request(app)
        .post('/api/auth/signup/phone/start')
        .send({ phone: 'invalid-phone' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Phone number');
    });

    it('should reject duplicate phone number', async () => {
      // Create a user with the test phone
      await authDb.createUser({
        email: 'existing@example.com',
        phone: testPhone
      });

      const response = await request(app)
        .post('/api/auth/signup/phone/start')
        .send({ phone: testPhone })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DUPLICATE_PHONE');
      expect(response.body.error.message).toContain('already registered');
    });

    it('should reject phone already in signup process', async () => {
      // Start first signup
      await request(app)
        .post('/api/auth/signup/phone/start')
        .send({ phone: testPhone })
        .expect(201);

      // Try to start another signup with same phone
      const response = await request(app)
        .post('/api/auth/signup/phone/start')
        .send({ phone: testPhone })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('already in signup process');
    });
  });

  describe('POST /api/auth/signup/phone/verify-phone', () => {
    let signupStateId: string;

    beforeEach(async () => {
      // Start signup process
      const startResponse = await request(app)
        .post('/api/auth/signup/phone/start')
        .send({ phone: testPhone });
      
      signupStateId = startResponse.body.data.signupStateId;
    });

    it('should verify phone successfully', async () => {
      const response = await request(app)
        .post('/api/auth/signup/phone/verify-phone')
        .send({
          signupStateId,
          otpCode: '123456'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.currentStep).toBe('email_verification');
      expect(response.body.data.message).toContain('Phone number verified');

      // Verify state was updated
      const signupState = await stateManager.getSignupState(signupStateId);
      expect(signupState?.phoneVerified).toBe(true);
    });

    it('should reject invalid OTP format', async () => {
      const response = await request(app)
        .post('/api/auth/signup/phone/verify-phone')
        .send({
          signupStateId,
          otpCode: '12345' // Too short
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('6 digits');
    });

    it('should reject invalid signup state ID', async () => {
      const response = await request(app)
        .post('/api/auth/signup/phone/verify-phone')
        .send({
          signupStateId: 'invalid-uuid',
          otpCode: '123456'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject expired signup state', async () => {
      const expiredStateId = uuidv4();
      
      const response = await request(app)
        .post('/api/auth/signup/phone/verify-phone')
        .send({
          signupStateId: expiredStateId,
          otpCode: '123456'
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SIGNUP_SESSION_NOT_FOUND');
    });
  });

  describe('POST /api/auth/signup/phone/verify-email', () => {
    let signupStateId: string;

    beforeEach(async () => {
      // Start and complete phone verification
      const startResponse = await request(app)
        .post('/api/auth/signup/phone/start')
        .send({ phone: testPhone });
      
      signupStateId = startResponse.body.data.signupStateId;

      await request(app)
        .post('/api/auth/signup/phone/verify-phone')
        .send({
          signupStateId,
          otpCode: '123456'
        });
    });

    it('should verify email successfully', async () => {
      const response = await request(app)
        .post('/api/auth/signup/phone/verify-email')
        .send({
          signupStateId,
          email: testEmail,
          verificationCode: 'ABC12345'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.currentStep).toBe('password_creation');
      expect(response.body.data.message).toContain('Email verified');

      // Verify state was updated
      const signupState = await stateManager.getSignupState(signupStateId);
      expect(signupState?.emailVerified).toBe(true);
      expect(signupState?.email).toBe(testEmail);
    });

    it('should reject invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/signup/phone/verify-email')
        .send({
          signupStateId,
          email: 'invalid-email',
          verificationCode: 'ABC12345'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('email');
    });

    it('should reject duplicate email', async () => {
      // Create a user with the test email
      await authDb.createUser({
        email: testEmail,
        phone: '+9876543210'
      });

      const response = await request(app)
        .post('/api/auth/signup/phone/verify-email')
        .send({
          signupStateId,
          email: testEmail,
          verificationCode: 'ABC12345'
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DUPLICATE_EMAIL');
      expect(response.body.error.message).toContain('already registered');
    });

    it('should reject invalid verification code format', async () => {
      const response = await request(app)
        .post('/api/auth/signup/phone/verify-email')
        .send({
          signupStateId,
          email: testEmail,
          verificationCode: '123' // Too short
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('8 characters');
    });
  });

  describe('POST /api/auth/signup/phone/complete', () => {
    let signupStateId: string;

    beforeEach(async () => {
      // Complete phone and email verification
      const startResponse = await request(app)
        .post('/api/auth/signup/phone/start')
        .send({ phone: testPhone });
      
      signupStateId = startResponse.body.data.signupStateId;

      await request(app)
        .post('/api/auth/signup/phone/verify-phone')
        .send({
          signupStateId,
          otpCode: '123456'
        });

      await request(app)
        .post('/api/auth/signup/phone/verify-email')
        .send({
          signupStateId,
          email: testEmail,
          verificationCode: 'ABC12345'
        });
    });

    it('should complete signup successfully', async () => {
      const response = await request(app)
        .post('/api/auth/signup/phone/complete')
        .send({
          signupStateId,
          password: testPassword
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data.user.email).toBe(testEmail);
      expect(response.body.data.user.phone).toBe(testPhone);
      expect(response.body.data.user.phoneVerified).toBe(true);
      expect(response.body.data.user.emailVerified).toBe(true);

      // Verify user was created in database
      const user = await authDb.getUserByEmail(testEmail);
      expect(user).toBeTruthy();
      expect(user?.phone).toBe(testPhone);
      expect(user?.phoneVerified).toBe(true);
      expect(user?.emailVerified).toBe(true);
    });

    it('should reject weak password', async () => {
      const response = await request(app)
        .post('/api/auth/signup/phone/complete')
        .send({
          signupStateId,
          password: '123' // Too weak
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toContain('Password must');
    });

    it('should reject completion without phone verification', async () => {
      // Create new signup state without phone verification
      const newStartResponse = await request(app)
        .post('/api/auth/signup/phone/start')
        .send({ phone: '+9876543210' });
      
      const newSignupStateId = newStartResponse.body.data.signupStateId;

      const response = await request(app)
        .post('/api/auth/signup/phone/complete')
        .send({
          signupStateId: newSignupStateId,
          password: testPassword
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_SIGNUP_STEP');
    });
  });

  describe('GET /api/auth/signup/phone/status/:signupStateId', () => {
    let signupStateId: string;

    beforeEach(async () => {
      const startResponse = await request(app)
        .post('/api/auth/signup/phone/start')
        .send({ phone: testPhone });
      
      signupStateId = startResponse.body.data.signupStateId;
    });

    it('should return signup status', async () => {
      const response = await request(app)
        .get(`/api/auth/signup/phone/status/${signupStateId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('currentStep');
      expect(response.body.data).toHaveProperty('phoneVerified');
      expect(response.body.data).toHaveProperty('emailVerified');
      expect(response.body.data.currentStep).toBe('phone_verification');
      expect(response.body.data.phoneVerified).toBe(false);
    });

    it('should return 404 for non-existent signup state', async () => {
      const nonExistentId = uuidv4();
      
      const response = await request(app)
        .get(`/api/auth/signup/phone/status/${nonExistentId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SIGNUP_SESSION_NOT_FOUND');
    });

    it('should reject invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/auth/signup/phone/status/invalid-uuid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_SIGNUP_STATE_ID');
    });
  });

  describe('DELETE /api/auth/signup/phone/cancel/:signupStateId', () => {
    let signupStateId: string;

    beforeEach(async () => {
      const startResponse = await request(app)
        .post('/api/auth/signup/phone/start')
        .send({ phone: testPhone });
      
      signupStateId = startResponse.body.data.signupStateId;
    });

    it('should cancel signup successfully', async () => {
      const response = await request(app)
        .delete(`/api/auth/signup/phone/cancel/${signupStateId}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('cancelled successfully');

      // Verify signup state was deleted
      const signupState = await stateManager.getSignupState(signupStateId);
      expect(signupState).toBeNull();
    });

    it('should return 404 for non-existent signup state', async () => {
      const nonExistentId = uuidv4();
      
      const response = await request(app)
        .delete(`/api/auth/signup/phone/cancel/${nonExistentId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('SIGNUP_SESSION_NOT_FOUND');
    });
  });

  describe('Complete Flow Integration Test', () => {
    it('should complete entire signup flow successfully', async () => {
      // Step 1: Start signup
      const startResponse = await request(app)
        .post('/api/auth/signup/phone/start')
        .send({ phone: testPhone })
        .expect(201);

      const signupStateId = startResponse.body.data.signupStateId;

      // Step 2: Verify phone
      await request(app)
        .post('/api/auth/signup/phone/verify-phone')
        .send({
          signupStateId,
          otpCode: '123456'
        })
        .expect(200);

      // Step 3: Verify email
      await request(app)
        .post('/api/auth/signup/phone/verify-email')
        .send({
          signupStateId,
          email: testEmail,
          verificationCode: 'ABC12345'
        })
        .expect(200);

      // Step 4: Complete signup
      const completeResponse = await request(app)
        .post('/api/auth/signup/phone/complete')
        .send({
          signupStateId,
          password: testPassword
        })
        .expect(201);

      // Verify final result
      expect(completeResponse.body.success).toBe(true);
      expect(completeResponse.body.data.user.email).toBe(testEmail);
      expect(completeResponse.body.data.user.phone).toBe(testPhone);
      
      // Verify user can login with created credentials
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testEmail,
          password: testPassword
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data).toHaveProperty('accessToken');
    });
  });
});