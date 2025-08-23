import request from 'supertest';
import express from 'express';
import { SessionManagementService } from '../services/session-management.service';
import { PhoneVerificationService } from '../phone-verification.service';
import { AuthService } from '../auth.service';
import pool from '../../config/database';
import redisClient from '../../config/redis';
import loginRoutes from '../login.routes';
import authRoutes from '../auth.routes';

// Integration test for complete authentication flows
describe('Authentication Flows Integration', () => {
  let app: express.Application;
  let sessionService: SessionManagementService;
  let phoneService: PhoneVerificationService;
  let authService: AuthService;

  beforeAll(async () => {
    // Setup test app
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/auth/login', loginRoutes);

    // Initialize services
    sessionService = new SessionManagementService();
    phoneService = new PhoneVerificationService();
    authService = new AuthService();

    // Setup test database
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
    await pool.end();
    await redisClient.quit();
  });

  beforeEach(async () => {
    await cleanupTestData();
  });

  describe('Email/Password Authentication Flow', () => {
    const testUser = {
      email: 'test@example.com',
      password: 'TestPassword123',
      firstName: 'Test',
      lastName: 'User'
    };

    it('should complete full email/password signup and login flow', async () => {
      // Step 1: Register user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          ...testUser,
          registrationMethod: 'email'
        })
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      const userId = registerResponse.body.data.user.id;

      // Step 2: Verify email (simulate email verification)
      await pool.query(
        'UPDATE users SET is_email_verified = true WHERE id = $1',
        [userId]
      );

      // Step 3: Login with email/password
      const loginResponse = await request(app)
        .post('/api/auth/login/email')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.data).toHaveProperty('accessToken');
      expect(loginResponse.body.data).toHaveProperty('refreshToken');
      expect(loginResponse.body.data.loginMethod).toBe('email_password');

      const { accessToken, refreshToken } = loginResponse.body.data;

      // Step 4: Use access token to access protected resource
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(meResponse.body.data.user.email).toBe(testUser.email);

      // Step 5: Refresh token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.data).toHaveProperty('accessToken');
      expect(refreshResponse.body.data.accessToken).not.toBe(accessToken);

      // Step 6: Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${refreshResponse.body.data.accessToken}`)
        .expect(200);

      expect(logoutResponse.body.success).toBe(true);

      // Step 7: Verify token is invalidated
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${refreshResponse.body.data.accessToken}`)
        .expect(401);
    });

    it('should handle invalid login credentials', async () => {
      // Try to login with non-existent user
      const response = await request(app)
        .post('/api/auth/login/email')
        .send({
          email: 'nonexistent@example.com',
          password: 'wrongpassword'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('LOGIN_FAILED');
    });
  });

  describe('Phone OTP Authentication Flow', () => {
    const testUser = {
      phone: '+1234567890',
      email: 'phoneuser@example.com',
      password: 'TestPassword123'
    };

    it('should complete full phone OTP login flow', async () => {
      // Step 1: Create user with verified phone
      const user = await authService.register({
        ...testUser,
        registrationMethod: 'phone_google'
      });

      // Mark phone as verified
      await pool.query(
        'UPDATE users SET is_phone_verified = true WHERE id = $1',
        [user.id]
      );

      // Step 2: Initiate phone login
      const phoneLoginResponse = await request(app)
        .post('/api/auth/login/phone')
        .send({ phone: testUser.phone })
        .expect(200);

      expect(phoneLoginResponse.body.success).toBe(true);
      expect(phoneLoginResponse.body.data).toHaveProperty('otpId');

      const { otpId } = phoneLoginResponse.body.data;

      // Step 3: Get OTP from database (simulate receiving SMS)
      const otpResult = await pool.query(
        'SELECT code FROM otp_verifications WHERE id = $1',
        [otpId]
      );
      const otpCode = otpResult.rows[0].code;

      // Step 4: Verify OTP and complete login
      const verifyResponse = await request(app)
        .post('/api/auth/login/phone/verify')
        .send({
          otpId,
          code: otpCode
        })
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.data).toHaveProperty('accessToken');
      expect(verifyResponse.body.data.loginMethod).toBe('phone_otp');

      // Step 5: Verify access token works
      const meResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${verifyResponse.body.data.accessToken}`)
        .expect(200);

      expect(meResponse.body.data.user.phone).toBe(testUser.phone);
    });

    it('should reject login for unverified phone numbers', async () => {
      const response = await request(app)
        .post('/api/auth/login/phone')
        .send({ phone: '+9999999999' })
        .expect(404);

      expect(response.body.error.code).toBe('PHONE_NOT_FOUND');
    });

    it('should reject invalid OTP codes', async () => {
      // Create user and initiate login
      const user = await authService.register({
        ...testUser,
        phone: '+1234567891',
        registrationMethod: 'phone_google'
      });

      await pool.query(
        'UPDATE users SET is_phone_verified = true WHERE id = $1',
        [user.id]
      );

      const phoneLoginResponse = await request(app)
        .post('/api/auth/login/phone')
        .send({ phone: '+1234567891' })
        .expect(200);

      const { otpId } = phoneLoginResponse.body.data;

      // Try with wrong OTP
      const response = await request(app)
        .post('/api/auth/login/phone/verify')
        .send({
          otpId,
          code: '000000'
        })
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_OTP');
    });
  });

  describe('Session Management', () => {
    let testUser: any;
    let accessToken: string;
    let refreshToken: string;

    beforeEach(async () => {
      // Create and login user
      testUser = await authService.register({
        email: 'sessiontest@example.com',
        password: 'TestPassword123',
        registrationMethod: 'email'
      });

      await pool.query(
        'UPDATE users SET is_email_verified = true WHERE id = $1',
        [testUser.id]
      );

      const loginResponse = await request(app)
        .post('/api/auth/login/email')
        .send({
          email: 'sessiontest@example.com',
          password: 'TestPassword123'
        });

      accessToken = loginResponse.body.data.accessToken;
      refreshToken = loginResponse.body.data.refreshToken;
    });

    it('should manage multiple sessions', async () => {
      // Create second session
      const secondLoginResponse = await request(app)
        .post('/api/auth/login/email')
        .send({
          email: 'sessiontest@example.com',
          password: 'TestPassword123'
        })
        .expect(200);

      // Get user sessions
      const sessionsResponse = await request(app)
        .get('/api/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(sessionsResponse.body.data.sessions).toHaveLength(2);
      expect(sessionsResponse.body.data.total).toBe(2);
    });

    it('should logout from all sessions', async () => {
      // Create second session
      await request(app)
        .post('/api/auth/login/email')
        .send({
          email: 'sessiontest@example.com',
          password: 'TestPassword123'
        });

      // Logout from all sessions
      await request(app)
        .post('/api/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Verify both tokens are invalidated
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);

      await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('should handle concurrent token refresh', async () => {
      // Simulate concurrent refresh requests
      const refreshPromises = Array(3).fill(null).map(() =>
        request(app)
          .post('/api/auth/refresh')
          .send({ refreshToken })
      );

      const responses = await Promise.allSettled(refreshPromises);
      
      // At least one should succeed
      const successfulResponses = responses.filter(
        (result): result is PromiseFulfilledResult<any> => 
          result.status === 'fulfilled' && result.value.status === 200
      );

      expect(successfulResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Security and Rate Limiting', () => {
    it('should rate limit login attempts', async () => {
      const loginAttempts = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/login/email')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          })
      );

      const responses = await Promise.all(loginAttempts);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should validate JWT token expiration', async () => {
      // Create user and login
      const user = await authService.register({
        email: 'expiry@example.com',
        password: 'TestPassword123',
        registrationMethod: 'email'
      });

      await pool.query(
        'UPDATE users SET is_email_verified = true WHERE id = $1',
        [user.id]
      );

      const loginResponse = await request(app)
        .post('/api/auth/login/email')
        .send({
          email: 'expiry@example.com',
          password: 'TestPassword123'
        });

      const { accessToken } = loginResponse.body.data;

      // Manually expire the session in database
      await pool.query(
        'UPDATE user_sessions SET expires_at = NOW() - INTERVAL \'1 hour\' WHERE jwt_token = $1',
        [accessToken]
      );

      // Token should be rejected
      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });

  // Helper functions
  async function setupTestDatabase(): Promise<void> {
    // Ensure test database tables exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        password_hash TEXT,
        tenant_id UUID,
        role VARCHAR(50) DEFAULT 'user',
        subscription_tier VARCHAR(50) DEFAULT 'free',
        is_email_verified BOOLEAN DEFAULT false,
        is_phone_verified BOOLEAN DEFAULT false,
        auth0_id VARCHAR(255),
        jwt_secret TEXT,
        jwt_refresh_secret TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_login_at TIMESTAMP WITH TIME ZONE
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        jwt_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        ip_address INET,
        user_agent TEXT,
        is_active BOOLEAN DEFAULT true
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS otp_verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        phone VARCHAR(20) NOT NULL,
        code VARCHAR(6) NOT NULL,
        type VARCHAR(50) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        is_used BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        plan_id VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        current_period_start TIMESTAMP WITH TIME ZONE,
        current_period_end TIMESTAMP WITH TIME ZONE,
        daily_email_limit INTEGER,
        monthly_recipient_limit INTEGER,
        monthly_email_limit INTEGER,
        template_limit INTEGER,
        custom_domain_limit INTEGER,
        recharge_balance DECIMAL(10,2) DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
  }

  async function cleanupTestDatabase(): Promise<void> {
    await pool.query('DROP TABLE IF EXISTS user_sessions CASCADE');
    await pool.query('DROP TABLE IF EXISTS otp_verifications CASCADE');
    await pool.query('DROP TABLE IF EXISTS subscriptions CASCADE');
    await pool.query('DROP TABLE IF EXISTS users CASCADE');
    await pool.query('DROP TABLE IF EXISTS tenants CASCADE');
  }

  async function cleanupTestData(): Promise<void> {
    await pool.query('DELETE FROM user_sessions');
    await pool.query('DELETE FROM otp_verifications');
    await pool.query('DELETE FROM subscriptions');
    await pool.query('DELETE FROM users');
    await pool.query('DELETE FROM tenants');
    
    // Clear Redis
    await redisClient.flushdb();
  }
});