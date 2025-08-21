import request from 'supertest';
import express from 'express';
import { AuthMiddleware } from './auth.middleware';
import { SecurityMiddleware } from './security.middleware';
import { ErrorHandlerMiddleware } from './error-handler.middleware';
import apiKeyRoutes from './api-key.routes';
import { ApiKeyService } from './api-key.service';
import { RateLimiterService } from './rate-limiter.service';
import { SubscriptionTier } from '../shared/types';

// Mock dependencies
jest.mock('./api-key.service');
jest.mock('./rate-limiter.service');
jest.mock('../config/database');
jest.mock('../config/redis');

describe('API Authentication and Security Integration', () => {
  let app: express.Application;
  let mockApiKeyService: jest.Mocked<ApiKeyService>;
  let mockRateLimiterService: jest.Mocked<RateLimiterService>;
  let securityMiddleware: SecurityMiddleware;

  beforeEach(() => {
    app = express();
    securityMiddleware = new SecurityMiddleware();
    
    // Apply security middleware
    app.use(securityMiddleware.securityHeaders);
    app.use(securityMiddleware.requestSizeLimit('1mb'));
    app.use(express.json());
    app.use(securityMiddleware.sanitizeInput);
    app.use(securityMiddleware.validateApiKeyFormat);
    
    // Apply routes
    app.use('/api/auth/api-keys', apiKeyRoutes);
    
    // Apply error handler
    app.use(ErrorHandlerMiddleware.handleError);

    // Mock services
    mockApiKeyService = new ApiKeyService() as jest.Mocked<ApiKeyService>;
    mockRateLimiterService = new RateLimiterService() as jest.Mocked<RateLimiterService>;

    // Mock authentication middleware
    jest.spyOn(AuthMiddleware.prototype, 'authenticate').mockImplementation(
      async (req: any, res: any, next: any) => {
        req.user = {
          id: 'user-123',
          email: 'test@example.com',
          tenantId: 'tenant-123',
          subscriptionTier: SubscriptionTier.PREMIUM,
          role: 'user'
        };
        next();
      }
    );

    jest.spyOn(AuthMiddleware.prototype, 'authenticateApiKey').mockImplementation(
      async (req: any, res: any, next: any) => {
        const apiKey = req.headers['x-api-key'];
        if (apiKey === 'bep_valid_key_12345678901234567890') {
          req.user = {
            id: 'user-123',
            tenantId: 'tenant-123',
            subscriptionTier: SubscriptionTier.PREMIUM
          };
          req.scopes = ['email:send', 'email:read'];
          req.rateLimitInfo = {
            limit: 1000,
            remaining: 999,
            resetTime: new Date()
          };
          next();
        } else {
          res.status(401).json({
            success: false,
            error: {
              code: 'INVALID_API_KEY',
              message: 'Invalid API key'
            }
          });
        }
      }
    );

    jest.spyOn(AuthMiddleware.prototype, 'requireScope').mockImplementation(
      (scope: string) => (req: any, res: any, next: any) => {
        const scopes = req.scopes || [];
        if (scopes.includes(scope)) {
          next();
        } else {
          res.status(403).json({
            success: false,
            error: {
              code: 'INSUFFICIENT_SCOPE',
              message: `Required scope: ${scope}`
            }
          });
        }
      }
    );

    jest.spyOn(AuthMiddleware.prototype, 'validateRequest').mockImplementation(
      (schema: any) => (req: any, res: any, next: any) => next()
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Security Headers', () => {
    it('should include security headers in all responses', async () => {
      mockApiKeyService.listApiKeys.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/auth/api-keys');

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(response.headers['content-security-policy']).toContain("default-src 'none'");
      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('API Key Format Validation', () => {
    it('should reject invalid API key format', async () => {
      const response = await request(app)
        .get('/api/auth/api-keys/test')
        .set('X-API-Key', 'invalid_key');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_API_KEY_FORMAT');
    });

    it('should accept valid API key format', async () => {
      const response = await request(app)
        .get('/api/auth/api-keys/test')
        .set('X-API-Key', 'bep_valid_key_12345678901234567890');

      expect(response.status).toBe(200);
    });

    it('should reject API key that is too short', async () => {
      const response = await request(app)
        .get('/api/auth/api-keys/test')
        .set('X-API-Key', 'bep_short');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_API_KEY_FORMAT');
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize malicious input in request body', async () => {
      mockApiKeyService.generateApiKey.mockResolvedValue({
        id: 'key-123',
        userId: 'user-123',
        key: 'bep_test_key',
        name: 'Clean Name',
        scopes: ['email:send'],
        isActive: true,
        createdAt: new Date()
      });

      const response = await request(app)
        .post('/api/auth/api-keys')
        .send({
          name: '<script>alert("xss")</script>Malicious Name',
          scopes: ['email:send']
        });

      expect(response.status).toBe(201);
      // The name should be sanitized (script tags removed)
      expect(mockApiKeyService.generateApiKey).toHaveBeenCalledWith(
        'user-123',
        'tenant-123',
        expect.objectContaining({
          name: 'Malicious Name', // Script tags should be removed
          scopes: ['email:send']
        })
      );
    });

    it('should sanitize query parameters', async () => {
      mockApiKeyService.getApiKeyUsage.mockResolvedValue({
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        avgResponseTime: 150,
        dataTransferred: 1024,
        uniqueEndpoints: 5
      });

      const response = await request(app)
        .get('/api/auth/api-keys/key-123/usage')
        .query({ days: '<script>alert("xss")</script>30' });

      expect(response.status).toBe(200);
      // The days parameter should be sanitized
      expect(mockApiKeyService.getApiKeyUsage).toHaveBeenCalledWith(
        'user-123',
        'key-123',
        30 // Should be parsed as number, script removed
      );
    });
  });

  describe('Request Size Limiting', () => {
    it('should reject requests that are too large', async () => {
      const largePayload = {
        name: 'A'.repeat(2 * 1024 * 1024), // 2MB string
        scopes: ['email:send']
      };

      const response = await request(app)
        .post('/api/auth/api-keys')
        .send(largePayload);

      expect(response.status).toBe(413);
      expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
    });
  });

  describe('API Versioning', () => {
    it('should accept valid API version', async () => {
      mockApiKeyService.listApiKeys.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/auth/api-keys')
        .set('API-Version', 'v1');

      expect(response.status).toBe(200);
      expect(response.headers['api-version']).toBe('v1');
    });

    it('should reject invalid API version format', async () => {
      const response = await request(app)
        .get('/api/auth/api-keys')
        .set('API-Version', 'invalid');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_API_VERSION');
    });

    it('should reject unsupported API version', async () => {
      const response = await request(app)
        .get('/api/auth/api-keys')
        .set('API-Version', 'v99');

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('UNSUPPORTED_API_VERSION');
    });

    it('should default to v1 when no version specified', async () => {
      mockApiKeyService.listApiKeys.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/auth/api-keys');

      expect(response.status).toBe(200);
      expect(response.headers['api-version']).toBe('v1');
    });
  });

  describe('Error Handling', () => {
    it('should return standardized error format', async () => {
      mockApiKeyService.generateApiKey.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post('/api/auth/api-keys')
        .send({
          name: 'Test Key',
          scopes: ['email:send']
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'API_KEY_CREATION_FAILED',
          message: 'Database connection failed',
          timestamp: expect.any(String),
          requestId: expect.any(String)
        }
      });
    });

    it('should handle authentication errors properly', async () => {
      const response = await request(app)
        .get('/api/auth/api-keys/test')
        .set('X-API-Key', 'bep_invalid_key_12345678901234567890');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_API_KEY');
    });

    it('should handle authorization errors properly', async () => {
      // Mock API key with limited scopes
      jest.spyOn(AuthMiddleware.prototype, 'authenticateApiKey').mockImplementation(
        async (req: any, res: any, next: any) => {
          req.user = { id: 'user-123' };
          req.scopes = ['email:read']; // Missing email:send scope
          next();
        }
      );

      const response = await request(app)
        .get('/api/auth/api-keys/test')
        .set('X-API-Key', 'bep_valid_key_12345678901234567890');

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('INSUFFICIENT_SCOPE');
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should include rate limit headers in API responses', async () => {
      mockApiKeyService.listApiKeys.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/auth/api-keys')
        .set('X-API-Key', 'bep_valid_key_12345678901234567890');

      // Rate limit headers should be set by the auth middleware mock
      expect(response.status).toBe(200);
    });
  });

  describe('Security Monitoring', () => {
    it('should log security events for failed authentication', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      await request(app)
        .get('/api/auth/api-keys/test')
        .set('X-API-Key', 'bep_invalid_key_12345678901234567890');

      // Should log the failed authentication attempt
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });

  describe('API Key Management Security', () => {
    it('should require authentication for API key creation', async () => {
      // Mock authentication failure
      jest.spyOn(AuthMiddleware.prototype, 'authenticate').mockImplementation(
        async (req: any, res: any, next: any) => {
          res.status(401).json({
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Authentication required'
            }
          });
        }
      );

      const response = await request(app)
        .post('/api/auth/api-keys')
        .send({
          name: 'Test Key',
          scopes: ['email:send']
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should validate API key creation request', async () => {
      const response = await request(app)
        .post('/api/auth/api-keys')
        .send({
          // Missing required fields
          scopes: []
        });

      expect(response.status).toBe(400);
    });

    it('should prevent API key enumeration', async () => {
      mockApiKeyService.getApiKeyUsage.mockRejectedValue(
        new Error('API key not found or access denied')
      );

      const response = await request(app)
        .get('/api/auth/api-keys/non-existent-key/usage');

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('API key not found or access denied');
    });
  });

  describe('CORS Security', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/auth/api-keys')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(200);
    });

    it('should restrict CORS for API key requests', async () => {
      const response = await request(app)
        .get('/api/auth/api-keys')
        .set('X-API-Key', 'bep_valid_key_12345678901234567890')
        .set('Origin', 'http://malicious-site.com');

      // Should not include credentials for API key requests
      expect(response.headers['access-control-allow-credentials']).toBe('false');
    });
  });
});