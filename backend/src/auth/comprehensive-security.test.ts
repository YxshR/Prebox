/**
 * Comprehensive Security Middleware Tests
 * 
 * Tests for all security measures implemented in task 14:
 * - Rate limiting for authentication endpoints
 * - Input sanitization and validation
 * - Secure password hashing and JWT token management
 * - CORS configuration and security headers
 */

import request from 'supertest';
import express from 'express';
import ComprehensiveSecurityMiddleware from './comprehensive-security.middleware';

describe('Comprehensive Security Middleware', () => {
  let app: express.Application;
  let securityMiddleware: ComprehensiveSecurityMiddleware;

  beforeEach(() => {
    app = express();
    securityMiddleware = new ComprehensiveSecurityMiddleware();
    
    // Apply security middleware
    app.use(securityMiddleware.securityHeaders);
    app.use(securityMiddleware.corsMiddleware);
    app.use(securityMiddleware.initializeSecurityContext);
    app.use(securityMiddleware.sanitizeInput);
    app.use(express.json());
  });

  describe('Security Headers', () => {
    beforeEach(() => {
      app.get('/test-headers', (req, res) => {
        res.json({ success: true });
      });
    });

    it('should set comprehensive security headers', async () => {
      const response = await request(app)
        .get('/test-headers')
        .expect(200);

      // Check for essential security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['cache-control']).toContain('no-store');
      expect(response.headers['x-powered-by']).toBeUndefined();
      expect(response.headers['server']).toBeUndefined();
    });

    it('should set CORS headers correctly', async () => {
      const response = await request(app)
        .get('/test-headers')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toContain('GET');
      expect(response.headers['access-control-allow-methods']).toContain('POST');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should handle preflight OPTIONS requests', async () => {
      await request(app)
        .options('/test-headers')
        .set('Origin', 'http://localhost:3000')
        .expect(204);
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      app.use('/auth', securityMiddleware.createRateLimit('auth'));
      app.post('/auth/login', (req, res) => {
        res.json({ success: true });
      });

      app.use('/phone', securityMiddleware.createRateLimit('phone'));
      app.post('/phone/send-otp', (req, res) => {
        res.json({ success: true });
      });
    });

    it('should allow requests within rate limit', async () => {
      await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password' })
        .expect(200);
    });

    it('should set rate limit headers', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password' })
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should block requests after rate limit exceeded', async () => {
      // Make multiple requests to exceed rate limit
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          request(app)
            .post('/auth/login')
            .send({ email: 'test@example.com', password: 'password' })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      expect(rateLimitedResponses[0].body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should have different rate limits for different endpoint types', async () => {
      // Test phone endpoint has different limits
      const phoneResponse = await request(app)
        .post('/phone/send-otp')
        .send({ phone: '+1234567890' })
        .expect(200);

      expect(phoneResponse.headers['x-ratelimit-limit']).toBeDefined();
      
      // The limit should be different from auth endpoints
      const authResponse = await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com', password: 'password' })
        .expect(200);

      // Phone and auth should have different rate limits
      expect(phoneResponse.headers['x-ratelimit-limit']).not.toBe(
        authResponse.headers['x-ratelimit-limit']
      );
    });
  });

  describe('Input Sanitization', () => {
    beforeEach(() => {
      app.post('/test-sanitization', (req, res) => {
        res.json({ 
          body: req.body,
          query: req.query,
          params: req.params
        });
      });
    });

    it('should sanitize malicious script tags from request body', async () => {
      const maliciousInput = {
        name: 'John<script>alert("xss")</script>Doe',
        email: 'test@example.com<script>alert("xss")</script>'
      };

      const response = await request(app)
        .post('/test-sanitization')
        .send(maliciousInput)
        .expect(200);

      expect(response.body.body.name).not.toContain('<script>');
      expect(response.body.body.email).not.toContain('<script>');
      expect(response.body.body.name).toBe('JohnDoe');
    });

    it('should sanitize javascript protocols', async () => {
      const maliciousInput = {
        url: 'javascript:alert("xss")',
        link: 'javascript:void(0)'
      };

      const response = await request(app)
        .post('/test-sanitization')
        .send(maliciousInput)
        .expect(200);

      expect(response.body.body.url).not.toContain('javascript:');
      expect(response.body.body.link).not.toContain('javascript:');
    });

    it('should sanitize event handlers', async () => {
      const maliciousInput = {
        content: 'Hello onclick="alert(\'xss\')" world',
        description: 'Test onmouseover="alert(\'xss\')" content'
      };

      const response = await request(app)
        .post('/test-sanitization')
        .send(maliciousInput)
        .expect(200);

      expect(response.body.body.content).not.toContain('onclick=');
      expect(response.body.body.description).not.toContain('onmouseover=');
    });

    it('should sanitize query parameters', async () => {
      const response = await request(app)
        .post('/test-sanitization?search=<script>alert("xss")</script>&filter=javascript:alert("xss")')
        .send({})
        .expect(200);

      expect(response.body.query.search).not.toContain('<script>');
      expect(response.body.query.filter).not.toContain('javascript:');
    });

    it('should handle nested objects in sanitization', async () => {
      const maliciousInput = {
        user: {
          profile: {
            bio: 'Hello <script>alert("xss")</script> world',
            links: ['javascript:alert("xss")', 'https://example.com']
          }
        }
      };

      const response = await request(app)
        .post('/test-sanitization')
        .send(maliciousInput)
        .expect(200);

      expect(response.body.body.user.profile.bio).not.toContain('<script>');
      expect(response.body.body.user.profile.links[0]).not.toContain('javascript:');
      expect(response.body.body.user.profile.links[1]).toBe('https://example.com');
    });
  });

  describe('Password Hashing', () => {
    it('should hash passwords securely', async () => {
      const password = 'testPassword123!';
      const hash = await ComprehensiveSecurityMiddleware.hashPassword(password);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hashes are typically 60 characters
      expect(hash.startsWith('$2')).toBe(true); // bcrypt format
    });

    it('should verify passwords correctly', async () => {
      const password = 'testPassword123!';
      const hash = await ComprehensiveSecurityMiddleware.hashPassword(password);

      const isValid = await ComprehensiveSecurityMiddleware.verifyPassword(password, hash);
      const isInvalid = await ComprehensiveSecurityMiddleware.verifyPassword('wrongPassword', hash);

      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'testPassword123!';
      const hash1 = await ComprehensiveSecurityMiddleware.hashPassword(password);
      const hash2 = await ComprehensiveSecurityMiddleware.hashPassword(password);

      expect(hash1).not.toBe(hash2);
      
      // Both should still verify correctly
      expect(await ComprehensiveSecurityMiddleware.verifyPassword(password, hash1)).toBe(true);
      expect(await ComprehensiveSecurityMiddleware.verifyPassword(password, hash2)).toBe(true);
    });
  });

  describe('JWT Token Management', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = {
        ...originalEnv,
        JWT_SECRET: 'test-secret-key-for-testing-only',
        JWT_REFRESH_SECRET: 'test-refresh-secret-key-for-testing-only',
        JWT_ISSUER: 'test-issuer',
        JWT_AUDIENCE: 'test-audience'
      };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should generate valid access tokens', () => {
      const payload = { userId: '123', email: 'test@example.com' };
      const token = ComprehensiveSecurityMiddleware.generateAccessToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT format: header.payload.signature
    });

    it('should generate valid refresh tokens', () => {
      const payload = { userId: '123' };
      const token = ComprehensiveSecurityMiddleware.generateRefreshToken(payload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
    });

    it('should verify access tokens correctly', () => {
      const payload = { userId: '123', email: 'test@example.com' };
      const token = ComprehensiveSecurityMiddleware.generateAccessToken(payload);
      
      const decoded = ComprehensiveSecurityMiddleware.verifyAccessToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.email).toBe(payload.email);
      expect(decoded.iss).toBe('test-issuer');
      expect(decoded.aud).toBe('test-audience');
    });

    it('should verify refresh tokens correctly', () => {
      const payload = { userId: '123' };
      const token = ComprehensiveSecurityMiddleware.generateRefreshToken(payload);
      
      const decoded = ComprehensiveSecurityMiddleware.verifyRefreshToken(token);

      expect(decoded.userId).toBe(payload.userId);
      expect(decoded.iss).toBe('test-issuer');
      expect(decoded.aud).toBe('test-audience');
    });

    it('should reject invalid tokens', () => {
      expect(() => {
        ComprehensiveSecurityMiddleware.verifyAccessToken('invalid.token.here');
      }).toThrow();

      expect(() => {
        ComprehensiveSecurityMiddleware.verifyRefreshToken('invalid.token.here');
      }).toThrow();
    });

    it('should reject tokens with wrong secret', () => {
      const payload = { userId: '123' };
      const token = ComprehensiveSecurityMiddleware.generateAccessToken(payload);
      
      // Change the secret
      process.env.JWT_SECRET = 'different-secret';
      
      expect(() => {
        ComprehensiveSecurityMiddleware.verifyAccessToken(token);
      }).toThrow();
    });
  });

  describe('Request Limits and Timeouts', () => {
    beforeEach(() => {
      app.use(securityMiddleware.requestLimits('1mb', 5000)); // 1MB, 5 second timeout
      app.post('/test-limits', (req, res) => {
        // Simulate slow response for timeout testing
        if (req.body.slow) {
          setTimeout(() => res.json({ success: true }), 6000);
        } else {
          res.json({ success: true });
        }
      });
    });

    it('should accept requests within size limits', async () => {
      const smallPayload = { data: 'a'.repeat(1000) }; // 1KB
      
      await request(app)
        .post('/test-limits')
        .send(smallPayload)
        .expect(200);
    });

    it('should handle timeout for slow requests', async () => {
      const response = await request(app)
        .post('/test-limits')
        .send({ slow: true })
        .timeout(6000);

      expect(response.status).toBe(408);
      expect(response.body.error.code).toBe('REQUEST_TIMEOUT');
    }, 7000);
  });

  describe('IP Blocking and Security Monitoring', () => {
    beforeEach(() => {
      app.use(securityMiddleware.checkBlockedIPs);
      app.use(securityMiddleware.securityMonitoring);
      app.post('/test-security', (req, res) => {
        res.json({ success: true });
      });
      app.post('/test-auth-fail', (req, res) => {
        res.status(401).json({ success: false, error: 'Unauthorized' });
      });
    });

    it('should allow requests from non-blocked IPs', async () => {
      await request(app)
        .post('/test-security')
        .send({})
        .expect(200);
    });

    it('should add request ID to responses', async () => {
      const response = await request(app)
        .post('/test-security')
        .send({})
        .expect(200);

      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['x-request-id']).toMatch(/^req_\d+_[a-z0-9]+$/);
    });

    it('should monitor authentication failures', async () => {
      const response = await request(app)
        .post('/test-auth-fail')
        .send({})
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Slow Down Middleware', () => {
    beforeEach(() => {
      app.use(securityMiddleware.slowDownMiddleware);
      app.get('/test-slowdown', (req, res) => {
        res.json({ success: true, timestamp: Date.now() });
      });
    });

    it('should not delay initial requests', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/test-slowdown')
        .expect(200);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(100); // Should be fast initially
    });

    it('should skip delay for authenticated requests', async () => {
      const startTime = Date.now();
      
      await request(app)
        .get('/test-slowdown')
        .set('Authorization', 'Bearer test-token')
        .expect(200);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      expect(responseTime).toBeLessThan(100); // Should skip delay
    });
  });

  describe('Environment Configuration', () => {
    it('should handle missing JWT secrets gracefully', () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      expect(() => {
        ComprehensiveSecurityMiddleware.generateAccessToken({ userId: '123' });
      }).toThrow('JWT_SECRET environment variable is required');

      process.env.JWT_SECRET = originalSecret;
    });

    it('should use fallback values for missing configuration', () => {
      const originalIssuer = process.env.JWT_ISSUER;
      delete process.env.JWT_ISSUER;

      process.env.JWT_SECRET = 'test-secret';
      const token = ComprehensiveSecurityMiddleware.generateAccessToken({ userId: '123' });
      const decoded = ComprehensiveSecurityMiddleware.verifyAccessToken(token);

      expect(decoded.iss).toBe('bulk-email-platform'); // Default issuer

      process.env.JWT_ISSUER = originalIssuer;
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      app.post('/test-error', (req, res) => {
        if (req.body.triggerError) {
          throw new Error('Test error');
        }
        res.json({ success: true });
      });
    });

    it('should handle sanitization errors gracefully', async () => {
      // Create a circular reference that might cause sanitization issues
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      const response = await request(app)
        .post('/test-error')
        .send(circularObj);

      // Should either succeed with sanitized data or return 400
      expect([200, 400]).toContain(response.status);
    });
  });
});

describe('ComprehensiveSecurityMiddleware Integration', () => {
  let app: express.Application;
  let securityMiddleware: ComprehensiveSecurityMiddleware;

  beforeEach(() => {
    app = express();
    securityMiddleware = new ComprehensiveSecurityMiddleware();
    
    // Apply all security middleware in correct order
    app.use(securityMiddleware.securityHeaders);
    app.use(securityMiddleware.corsMiddleware);
    app.use(securityMiddleware.initializeSecurityContext);
    app.use(securityMiddleware.checkBlockedIPs);
    app.use(securityMiddleware.requestLimits());
    app.use(securityMiddleware.slowDownMiddleware);
    app.use(securityMiddleware.sanitizeInput);
    app.use(securityMiddleware.securityMonitoring);
    app.use(express.json());
  });

  it('should apply all security measures in integration', async () => {
    app.post('/integration-test', (req: any, res) => {
      res.json({ 
        success: true,
        securityContext: !!req.securityContext,
        sanitizedInput: req.body
      });
    });

    const response = await request(app)
      .post('/integration-test')
      .set('Origin', 'http://localhost:3000')
      .send({ 
        message: 'Hello <script>alert("xss")</script> World',
        data: 'javascript:alert("xss")'
      })
      .expect(200);

    // Check security headers
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['access-control-allow-origin']).toBeDefined();
    expect(response.headers['x-request-id']).toBeDefined();

    // Check input sanitization
    expect(response.body.sanitizedInput.message).not.toContain('<script>');
    expect(response.body.sanitizedInput.data).not.toContain('javascript:');
    
    // Check security context
    expect(response.body.securityContext).toBe(true);
  });

  it('should handle authentication flow with all security measures', async () => {
    app.use('/auth', securityMiddleware.createRateLimit('auth'));
    app.post('/auth/login', (req, res) => {
      res.json({ 
        success: true,
        token: 'mock-jwt-token',
        sanitizedCredentials: req.body
      });
    });

    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'test@example.com<script>alert("xss")</script>',
        password: 'password123'
      })
      .expect(200);

    // Should have rate limit headers
    expect(response.headers['x-ratelimit-limit']).toBeDefined();
    expect(response.headers['x-ratelimit-remaining']).toBeDefined();
    
    // Should sanitize email
    expect(response.body.sanitizedCredentials.email).not.toContain('<script>');
    expect(response.body.sanitizedCredentials.email).toContain('test@example.com');
  });
});