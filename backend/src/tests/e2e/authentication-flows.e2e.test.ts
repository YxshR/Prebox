/**
 * End-to-End Authentication Flow Tests
 * Tests all authentication flows from requirements 1, 2, and 3
 */

import request from 'supertest';
import { Express } from 'express';
import { DatabaseService } from '../../database/database.service';
import { createTestApp } from '../utils/test-app-factory';
import { TestDataSeeder } from '../utils/test-data-seeder';
import { TestCleanup } from '../utils/test-cleanup';

describe('Authentication Flows E2E Tests', () => {
  let app: Express;
  let dbService: DatabaseService;
  let seeder: TestDataSeeder;
  let cleanup: TestCleanup;

  beforeAll(async () => {
    app = await createTestApp();
    dbService = new DatabaseService();
    seeder = new TestDataSeeder(dbService);
    cleanup = new TestCleanup(dbService);
    
    await dbService.connect();
    await seeder.seedTestData();
  });

  afterAll(async () => {
    await cleanup.cleanupAll();
    await dbService.disconnect();
  });

  afterEach(async () => {
    await cleanup.cleanupUserData();
  });

  describe('Multi-Step Phone Signup Flow (Requirement 1)', () => {
    const testPhone = '+1234567890';
    const testEmail = 'test@example.com';
    const testPassword = 'SecurePass123!';

    it('should complete full phone signup flow successfully', async () => {
      // Step 1: Start phone signup
      const startResponse = await request(app)
        .post('/api/auth/signup/phone/start')
        .send({ phone: testPhone })
        .expect(200);

      expect(startResponse.body).toMatchObject({
        success: true,
        message: 'OTP sent successfully',
        step: 1
      });

      // Verify OTP was stored in database
      const otpRecord = await dbService.query(
        'SELECT * FROM phone_verifications WHERE phone = $1',
        [testPhone]
      );
      expect(otpRecord.rows).toHaveLength(1);

      // Step 2: Verify phone with OTP
      const otp = otpRecord.rows[0].otp_code;
      const verifyPhoneResponse = await request(app)
        .post('/api/auth/signup/phone/verify')
        .send({ phone: testPhone, otp })
        .expect(200);

      expect(verifyPhoneResponse.body).toMatchObject({
        success: true,
        message: 'Phone verified successfully',
        step: 2
      });

      // Step 3: Add email verification
      const emailResponse = await request(app)
        .post('/api/auth/signup/email/verify')
        .send({ 
          phone: testPhone, 
          email: testEmail 
        })
        .expect(200);

      expect(emailResponse.body).toMatchObject({
        success: true,
        message: 'Email verification sent',
        step: 3
      });

      // Get email verification code
      const emailRecord = await dbService.query(
        'SELECT * FROM email_verifications WHERE email = $1',
        [testEmail]
      );
      const emailCode = emailRecord.rows[0].verification_code;

      // Verify email
      const verifyEmailResponse = await request(app)
        .post('/api/auth/signup/email/verify')
        .send({ 
          email: testEmail, 
          code: emailCode 
        })
        .expect(200);

      expect(verifyEmailResponse.body).toMatchObject({
        success: true,
        message: 'Email verified successfully'
      });

      // Step 4: Complete signup with password
      const completeResponse = await request(app)
        .post('/api/auth/signup/complete')
        .send({
          phone: testPhone,
          email: testEmail,
          password: testPassword
        })
        .expect(201);

      expect(completeResponse.body).toMatchObject({
        success: true,
        message: 'Signup completed successfully',
        user: {
          phone: testPhone,
          email: testEmail,
          phoneVerified: true,
          emailVerified: true
        },
        tokens: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String)
        }
      });

      // Verify user was created in database
      const userRecord = await dbService.query(
        'SELECT * FROM users WHERE phone = $1 AND email = $2',
        [testPhone, testEmail]
      );
      expect(userRecord.rows).toHaveLength(1);
      expect(userRecord.rows[0].phone_verified).toBe(true);
      expect(userRecord.rows[0].email_verified).toBe(true);
    });

    it('should prevent duplicate phone number signup', async () => {
      // Create existing user
      await seeder.createUser({ phone: testPhone });

      const response = await request(app)
        .post('/api/auth/signup/phone/start')
        .send({ phone: testPhone })
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Phone number already exists',
        code: 'DUPLICATE_PHONE'
      });
    });

    it('should prevent duplicate email signup', async () => {
      // Start phone signup
      await request(app)
        .post('/api/auth/signup/phone/start')
        .send({ phone: testPhone })
        .expect(200);

      // Verify phone
      const otpRecord = await dbService.query(
        'SELECT otp_code FROM phone_verifications WHERE phone = $1',
        [testPhone]
      );
      await request(app)
        .post('/api/auth/signup/phone/verify')
        .send({ phone: testPhone, otp: otpRecord.rows[0].otp_code })
        .expect(200);

      // Create existing user with email
      await seeder.createUser({ email: testEmail });

      // Try to use existing email
      const response = await request(app)
        .post('/api/auth/signup/email/verify')
        .send({ phone: testPhone, email: testEmail })
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Email already exists',
        code: 'DUPLICATE_EMAIL'
      });
    });

    it('should handle invalid OTP gracefully', async () => {
      await request(app)
        .post('/api/auth/signup/phone/start')
        .send({ phone: testPhone })
        .expect(200);

      const response = await request(app)
        .post('/api/auth/signup/phone/verify')
        .send({ phone: testPhone, otp: '000000' })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid or expired OTP',
        code: 'INVALID_OTP'
      });
    });
  });

  describe('Auth0 Signup Flow (Requirement 2)', () => {
    const testAuth0Id = 'auth0|test123';
    const testEmail = 'auth0test@example.com';
    const testPhone = '+1987654321';

    it('should complete Auth0 signup with phone verification', async () => {
      // Mock Auth0 profile data
      const auth0Profile = {
        sub: testAuth0Id,
        email: testEmail,
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg'
      };

      // Start Auth0 signup
      const startResponse = await request(app)
        .post('/api/auth/signup/auth0/start')
        .send({ auth0Profile })
        .expect(200);

      expect(startResponse.body).toMatchObject({
        success: true,
        message: 'Auth0 profile created, phone verification required',
        step: 2
      });

      // Add phone verification
      const phoneResponse = await request(app)
        .post('/api/auth/signup/auth0/phone')
        .send({ 
          auth0Id: testAuth0Id,
          phone: testPhone 
        })
        .expect(200);

      expect(phoneResponse.body).toMatchObject({
        success: true,
        message: 'Phone verification sent'
      });

      // Verify phone
      const otpRecord = await dbService.query(
        'SELECT otp_code FROM phone_verifications WHERE phone = $1',
        [testPhone]
      );
      
      const completeResponse = await request(app)
        .post('/api/auth/signup/auth0/complete')
        .send({
          auth0Id: testAuth0Id,
          phone: testPhone,
          otp: otpRecord.rows[0].otp_code
        })
        .expect(201);

      expect(completeResponse.body).toMatchObject({
        success: true,
        message: 'Auth0 signup completed successfully',
        user: {
          email: testEmail,
          phone: testPhone,
          auth0Id: testAuth0Id,
          phoneVerified: true,
          emailVerified: true
        },
        tokens: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String)
        }
      });

      // Verify user and Auth0 profile in database
      const userRecord = await dbService.query(
        'SELECT * FROM users WHERE auth0_id = $1',
        [testAuth0Id]
      );
      expect(userRecord.rows).toHaveLength(1);

      const profileRecord = await dbService.query(
        'SELECT * FROM auth0_profiles WHERE auth0_id = $1',
        [testAuth0Id]
      );
      expect(profileRecord.rows).toHaveLength(1);
    });

    it('should prevent duplicate Auth0 email signup', async () => {
      await seeder.createUser({ email: testEmail });

      const response = await request(app)
        .post('/api/auth/signup/auth0/start')
        .send({
          auth0Profile: {
            sub: testAuth0Id,
            email: testEmail,
            name: 'Test User'
          }
        })
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Email already exists',
        code: 'DUPLICATE_EMAIL'
      });
    });
  });

  describe('Multiple Login Methods (Requirement 3)', () => {
    let existingUser: any;
    const userPhone = '+1555123456';
    const userEmail = 'logintest@example.com';
    const userPassword = 'LoginPass123!';
    const userAuth0Id = 'auth0|login123';

    beforeEach(async () => {
      existingUser = await seeder.createUser({
        phone: userPhone,
        email: userEmail,
        password: userPassword,
        auth0Id: userAuth0Id,
        phoneVerified: true,
        emailVerified: true
      });
    });

    it('should login with Auth0 successfully', async () => {
      const response = await request(app)
        .post('/api/auth/login/auth0')
        .send({ auth0Id: userAuth0Id })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Login successful',
        user: {
          id: existingUser.id,
          email: userEmail,
          phone: userPhone,
          auth0Id: userAuth0Id
        },
        tokens: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String)
        }
      });

      // Verify session was created
      const sessionRecord = await dbService.query(
        'SELECT * FROM user_sessions WHERE user_id = $1',
        [existingUser.id]
      );
      expect(sessionRecord.rows).toHaveLength(1);
    });

    it('should login with phone OTP successfully', async () => {
      // Request OTP
      const otpResponse = await request(app)
        .post('/api/auth/login/phone/request')
        .send({ phone: userPhone })
        .expect(200);

      expect(otpResponse.body).toMatchObject({
        success: true,
        message: 'OTP sent successfully'
      });

      // Get OTP from database
      const otpRecord = await dbService.query(
        'SELECT otp_code FROM phone_verifications WHERE phone = $1 ORDER BY created_at DESC LIMIT 1',
        [userPhone]
      );

      // Login with OTP
      const loginResponse = await request(app)
        .post('/api/auth/login/phone')
        .send({ 
          phone: userPhone, 
          otp: otpRecord.rows[0].otp_code 
        })
        .expect(200);

      expect(loginResponse.body).toMatchObject({
        success: true,
        message: 'Login successful',
        user: {
          id: existingUser.id,
          phone: userPhone,
          email: userEmail
        },
        tokens: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String)
        }
      });
    });

    it('should login with email and password successfully', async () => {
      const response = await request(app)
        .post('/api/auth/login/email')
        .send({ 
          email: userEmail, 
          password: userPassword 
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Login successful',
        user: {
          id: existingUser.id,
          email: userEmail,
          phone: userPhone
        },
        tokens: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String)
        }
      });

      // Verify last login was updated
      const userRecord = await dbService.query(
        'SELECT last_login FROM users WHERE id = $1',
        [existingUser.id]
      );
      expect(userRecord.rows[0].last_login).toBeTruthy();
    });

    it('should reject login with non-existent credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login/email')
        .send({ 
          email: 'nonexistent@example.com', 
          password: 'wrongpass' 
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    });

    it('should reject login with wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login/email')
        .send({ 
          email: userEmail, 
          password: 'wrongpassword' 
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    });

    it('should handle JWT token refresh', async () => {
      // Login first
      const loginResponse = await request(app)
        .post('/api/auth/login/email')
        .send({ email: userEmail, password: userPassword })
        .expect(200);

      const { refreshToken } = loginResponse.body.tokens;

      // Refresh token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshResponse.body).toMatchObject({
        success: true,
        tokens: {
          accessToken: expect.any(String),
          refreshToken: expect.any(String)
        }
      });

      // Verify new tokens are different
      expect(refreshResponse.body.tokens.accessToken)
        .not.toBe(loginResponse.body.tokens.accessToken);
    });

    it('should logout and invalidate session', async () => {
      // Login first
      const loginResponse = await request(app)
        .post('/api/auth/login/email')
        .send({ email: userEmail, password: userPassword })
        .expect(200);

      const { accessToken } = loginResponse.body.tokens;

      // Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(logoutResponse.body).toMatchObject({
        success: true,
        message: 'Logout successful'
      });

      // Verify session was invalidated
      const sessionRecord = await dbService.query(
        'SELECT * FROM user_sessions WHERE user_id = $1 AND expires_at > NOW()',
        [existingUser.id]
      );
      expect(sessionRecord.rows).toHaveLength(0);
    });
  });

  describe('Pricing System Integration (Requirements 4 & 5)', () => {
    beforeEach(async () => {
      await seeder.seedPricingData();
    });

    it('should fetch pricing data successfully', async () => {
      const response = await request(app)
        .get('/api/pricing/plans')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        plans: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            name: expect.any(String),
            price: expect.any(Number),
            features: expect.any(Array),
            limits: expect.any(Object),
            active: true
          })
        ])
      });

      expect(response.body.plans.length).toBeGreaterThan(0);
    });

    it('should handle pricing fallback when database fails', async () => {
      // Temporarily break database connection
      await dbService.disconnect();

      const response = await request(app)
        .get('/api/pricing/plans')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        fallback: true,
        plans: expect.any(Array)
      });

      // Restore connection
      await dbService.connect();
    });

    it('should fetch specific pricing plan', async () => {
      const plansResponse = await request(app)
        .get('/api/pricing/plans')
        .expect(200);

      const planId = plansResponse.body.plans[0].id;

      const response = await request(app)
        .get(`/api/pricing/plan/${planId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        plan: expect.objectContaining({
          id: planId,
          name: expect.any(String),
          price: expect.any(Number),
          features: expect.any(Array),
          limits: expect.any(Object)
        })
      });
    });
  });

  describe('Error Handling and Security (Requirement 6)', () => {
    it('should handle rate limiting on authentication endpoints', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/login/email')
          .send({ email: 'test@example.com', password: 'wrongpass' })
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });

    it('should sanitize input and prevent injection attacks', async () => {
      const maliciousInput = "'; DROP TABLE users; --";
      
      const response = await request(app)
        .post('/api/auth/signup/phone/start')
        .send({ phone: maliciousInput })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Invalid phone number format')
      });

      // Verify users table still exists
      const tableCheck = await dbService.query(
        "SELECT table_name FROM information_schema.tables WHERE table_name = 'users'"
      );
      expect(tableCheck.rows).toHaveLength(1);
    });

    it('should validate JWT tokens properly', async () => {
      const invalidToken = 'invalid.jwt.token';

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid token',
        code: 'INVALID_TOKEN'
      });
    });

    it('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/auth/login/email')
        .set('Origin', 'https://example.com')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });
  });
});