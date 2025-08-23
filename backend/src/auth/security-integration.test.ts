/**
 * Security Integration Tests
 * 
 * Tests the complete security integration including:
 * - All middleware applied in correct order
 * - Authentication endpoint security
 * - Validation and error handling
 * - Rate limiting integration
 */

import request from 'supertest';
import express from 'express';
import SecurityIntegration from './security-integration.middleware';

describe('Security Integration', () => {
  let app: express.Application;
  let securityIntegration: SecurityIntegration;

  beforeEach(() => {
    app = express();
    securityIntegration = new SecurityIntegration();
    
    // Initialize all security measures
    securityIntegration.initializeAllSecurity(app);
    
    // Add JSON parsing after security middleware
    app.use(express.json());
  });

  describe('Complete Security Integration', () => {
    beforeEach(() => {
      // Add test endpoints
      app.post('/api/auth/signup/phone/start', (req, res) => {
        res.json({ success: true, message: 'Phone signup started' });
      });

      app.post('/api/auth/login/email', (req, res) => {
        res.json({ success: true, message: 'Email login successful' });
      });

      app.get('/api/health/security', securityIntegration.createSecurityHealthCheck());
    });

    it('should apply all security headers', async () => {
      const response = await request(app)
        .get('/api/health/security')
        .expect(200);

      // Check security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['x-request-id']).toBeDefined();
      
      // Check response
      expect(response.body.status).toBe('healthy');
      expect(response.body.security.headersApplied).toBe(true);
      expect(response.body.security.rateLimitingActive).toBe(true);
    });

    it('should validate phone signup requests', async () => {
      // Valid request
      await request(app)
        .post('/api/auth/signup/phone/start')
        .send({ phone: '+1234567890' })
        .expect(200);

      // Invalid request - missing phone
      const response = await request(app)
        .post('/api/auth/signup/phone/start')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate email login requests', async () => {
      // Valid request
      await request(app)
        .post('/api/auth/login/email')
        .send({ 
          email: 'test@example.com', 
          password: 'password123' 
        })
        .expect(200);

      // Invalid request - invalid email
      const response = await request(app)
        .post('/api/auth/login/email')
        .send({ 
          email: 'invalid-email', 
          password: 'password123' 
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should sanitize malicious input', async () => {
      const response = await request(app)
        .post('/api/auth/login/email')
        .send({ 
          email: 'test@example.com<script>alert("xss")</script>', 
          password: 'password123' 
        })
        .expect(400); // Will fail validation due to sanitized email

      // The sanitized email should not contain script tags
      expect(response.body.error).toBeDefined();
    });

    it('should apply rate limiting to auth endpoints', async () => {
      // Make multiple requests to trigger rate limiting
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/api/auth/login/email')
            .send({ 
              email: 'test@example.com', 
              password: 'password123' 
            })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      // Should have some rate limited responses
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should handle CORS properly', async () => {
      const response = await request(app)
        .get('/api/health/security')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should handle preflight OPTIONS requests', async () => {
      await request(app)
        .options('/api/auth/login/email')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type')
        .expect(204);
    });
  });

  describe('Error Handling Integration', () => {
    beforeEach(() => {
      // Add endpoint that throws errors
      app.post('/api/test/error', (req, res) => {
        if (req.body.throwError) {
          throw new Error('Test error');
        }
        res.json({ success: true });
      });

      // Add endpoint that simulates database constraint violation
      app.post('/api/test/constraint', (req, res, next) => {
        if (req.body.simulateConstraint) {
          const error: any = new Error('Duplicate key violation');
          error.code = '23505';
          error.constraint = 'users_email_key';
          error.detail = 'Key (email)=(test@example.com) already exists.';
          return next(error);
        }
        res.json({ success: true });
      });
    });

    it('should handle unhandled errors gracefully', async () => {
      const response = await request(app)
        .post('/api/test/error')
        .send({ throwError: true })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(response.body.error.message).toBeDefined();
    });

    it('should handle database constraint violations', async () => {
      const response = await request(app)
        .post('/api/test/constraint')
        .send({ simulateConstraint: true })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DUPLICATE_RESOURCE');
      expect(response.body.error.message).toContain('email');
    });
  });

  describe('Security Middleware Order', () => {
    it('should apply middleware in correct order', async () => {
      const response = await request(app)
        .post('/api/auth/signup/phone/start')
        .send({ phone: '+1234567890' })
        .expect(200);

      // Should have security headers (applied first)
      expect(response.headers['x-content-type-options']).toBeDefined();
      
      // Should have request ID (from security context)
      expect(response.headers['x-request-id']).toBeDefined();
      
      // Should have rate limit headers (from rate limiting)
      expect(response.headers['x-ratelimit-limit']).toBeDefined();
    });
  });

  describe('Security Health Check', () => {
    beforeEach(() => {
      app.get('/api/health/security', securityIntegration.createSecurityHealthCheck());
    });

    it('should provide security status information', async () => {
      const response = await request(app)
        .get('/api/health/security')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.security).toEqual({
        headersApplied: true,
        rateLimitingActive: true,
        inputSanitizationActive: true,
        validationActive: true,
        monitoringActive: true
      });
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.environment).toBeDefined();
    });
  });

  describe('Manual Security Middleware Access', () => {
    it('should provide access to security middleware instance', () => {
      const middleware = securityIntegration.getSecurityMiddleware();
      expect(middleware).toBeDefined();
      expect(typeof middleware.createRateLimit).toBe('function');
    });
  });
});

describe('Security Integration with Real Authentication Flow', () => {
  let app: express.Application;
  let securityIntegration: SecurityIntegration;

  beforeEach(() => {
    app = express();
    securityIntegration = new SecurityIntegration();
    
    // Initialize security
    securityIntegration.initializeAllSecurity(app);
    app.use(express.json());

    // Mock authentication endpoints
    app.post('/api/auth/signup/phone/start', (req, res) => {
      res.json({ 
        success: true, 
        signupStateId: 'mock-uuid',
        message: 'OTP sent to phone number' 
      });
    });

    app.post('/api/auth/signup/phone/verify', (req, res) => {
      res.json({ 
        success: true, 
        message: 'Phone verified, proceed to email verification' 
      });
    });

    app.post('/api/auth/login/email', (req, res) => {
      res.json({ 
        success: true, 
        accessToken: 'mock-jwt-token',
        refreshToken: 'mock-refresh-token' 
      });
    });
  });

  it('should handle complete phone signup flow with security', async () => {
    // Step 1: Start phone signup
    const step1Response = await request(app)
      .post('/api/auth/signup/phone/start')
      .send({ phone: '+1234567890' })
      .expect(200);

    expect(step1Response.body.success).toBe(true);
    expect(step1Response.headers['x-request-id']).toBeDefined();
    expect(step1Response.headers['x-ratelimit-remaining']).toBeDefined();

    // Step 2: Verify phone with OTP
    const step2Response = await request(app)
      .post('/api/auth/signup/phone/verify')
      .send({ 
        signupStateId: 'mock-uuid-here-12345678',
        otpCode: '123456' 
      })
      .expect(200);

    expect(step2Response.body.success).toBe(true);
    expect(step2Response.headers['x-request-id']).toBeDefined();
  });

  it('should handle email login with security measures', async () => {
    const response = await request(app)
      .post('/api/auth/login/email')
      .send({ 
        email: 'user@example.com', 
        password: 'SecurePassword123!' 
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.accessToken).toBeDefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-ratelimit-limit']).toBeDefined();
  });

  it('should reject invalid authentication attempts', async () => {
    // Invalid phone format
    await request(app)
      .post('/api/auth/signup/phone/start')
      .send({ phone: 'invalid-phone' })
      .expect(400);

    // Invalid email format
    await request(app)
      .post('/api/auth/login/email')
      .send({ 
        email: 'invalid-email', 
        password: 'password' 
      })
      .expect(400);

    // Weak password (if we had password creation endpoint)
    // This would be tested in the actual password creation endpoint
  });
});