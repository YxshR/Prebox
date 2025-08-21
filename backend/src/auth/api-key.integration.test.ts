import request from 'supertest';
import express from 'express';
import apiKeyRoutes from './api-key.routes';
import { AuthMiddleware } from './auth.middleware';
import { ApiKeyService } from './api-key.service';
import { SubscriptionTier } from '../shared/types';

// Mock dependencies
jest.mock('./api-key.service');
jest.mock('./rate-limiter.service');
jest.mock('../config/database');
jest.mock('../config/redis');

const app = express();
app.use(express.json());
app.use('/api/keys', apiKeyRoutes);

describe('API Key Routes Integration', () => {
  let mockApiKeyService: jest.Mocked<ApiKeyService>;
  let mockAuthMiddleware: jest.Mocked<AuthMiddleware>;

  beforeEach(() => {
    mockApiKeyService = new ApiKeyService() as jest.Mocked<ApiKeyService>;
    mockAuthMiddleware = new AuthMiddleware() as jest.Mocked<AuthMiddleware>;

    // Mock authentication middleware to add user to request
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

    jest.spyOn(AuthMiddleware.prototype, 'validateRequest').mockImplementation(
      (schema: any) => (req: any, res: any, next: any) => next()
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/keys', () => {
    it('should create new API key successfully', async () => {
      const mockApiKey = {
        id: 'key-123',
        userId: 'user-123',
        key: 'bep_test_key_12345',
        name: 'Test Key',
        scopes: ['email:send', 'email:read'],
        isActive: true,
        createdAt: new Date()
      };

      mockApiKeyService.generateApiKey.mockResolvedValue(mockApiKey);

      const response = await request(app)
        .post('/api/keys')
        .send({
          name: 'Test Key',
          scopes: ['email:send', 'email:read']
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: 'key-123',
        name: 'Test Key',
        key: 'bep_test_key_12345'
      });
      expect(response.body.message).toContain('API key created successfully');
    });

    it('should return error when API key creation fails', async () => {
      mockApiKeyService.generateApiKey.mockRejectedValue(
        new Error('Maximum API keys limit reached')
      );

      const response = await request(app)
        .post('/api/keys')
        .send({
          name: 'Test Key',
          scopes: ['email:send']
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('API_KEY_CREATION_FAILED');
      expect(response.body.error.message).toBe('Maximum API keys limit reached');
    });
  });

  describe('GET /api/keys', () => {
    it('should list user API keys', async () => {
      const mockApiKeys = [
        {
          id: 'key-1',
          name: 'Key 1',
          scopes: ['email:send'],
          isActive: true,
          lastUsedAt: new Date(),
          createdAt: new Date()
        },
        {
          id: 'key-2',
          name: 'Key 2',
          scopes: ['email:read'],
          isActive: false,
          createdAt: new Date()
        }
      ];

      mockApiKeyService.listApiKeys.mockResolvedValue(mockApiKeys);

      const response = await request(app).get('/api/keys');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.apiKeys).toHaveLength(2);
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.apiKeys[0]).not.toHaveProperty('key');
    });
  });

  describe('GET /api/keys/:keyId/usage', () => {
    it('should return API key usage statistics', async () => {
      const mockUsage = {
        totalRequests: 1000,
        successfulRequests: 950,
        failedRequests: 50,
        avgResponseTime: 150.5,
        dataTransferred: 1024000,
        uniqueEndpoints: 15,
        lastUsed: new Date()
      };

      mockApiKeyService.getApiKeyUsage.mockResolvedValue(mockUsage);

      const response = await request(app)
        .get('/api/keys/key-123/usage')
        .query({ days: '7' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject(mockUsage);
      expect(mockApiKeyService.getApiKeyUsage).toHaveBeenCalledWith('user-123', 'key-123', 7);
    });
  });

  describe('PUT /api/keys/:keyId', () => {
    it('should update API key successfully', async () => {
      mockApiKeyService.updateApiKey.mockResolvedValue();

      const response = await request(app)
        .put('/api/keys/key-123')
        .send({
          name: 'Updated Key Name',
          scopes: ['email:send', 'templates:read']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('API key updated successfully');
      expect(mockApiKeyService.updateApiKey).toHaveBeenCalledWith(
        'user-123',
        'key-123',
        {
          name: 'Updated Key Name',
          scopes: ['email:send', 'templates:read']
        }
      );
    });
  });

  describe('DELETE /api/keys/:keyId', () => {
    it('should revoke API key successfully', async () => {
      mockApiKeyService.revokeApiKey.mockResolvedValue();

      const response = await request(app).delete('/api/keys/key-123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('API key revoked successfully');
      expect(mockApiKeyService.revokeApiKey).toHaveBeenCalledWith('user-123', 'key-123');
    });

    it('should return error when API key not found', async () => {
      mockApiKeyService.revokeApiKey.mockRejectedValue(
        new Error('API key not found or access denied')
      );

      const response = await request(app).delete('/api/keys/invalid-key');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('API_KEY_REVOCATION_FAILED');
    });
  });

  describe('GET /api/keys/scopes', () => {
    it('should return available scopes for user subscription tier', async () => {
      const response = await request(app).get('/api/keys/scopes');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.currentTier).toBe(SubscriptionTier.PREMIUM);
      expect(response.body.data.availableScopes).toContain('email:send');
      expect(response.body.data.availableScopes).toContain('analytics:read');
      expect(response.body.data.limits.maxKeys).toBe(10); // Premium tier limit
    });
  });

  describe('GET /api/keys/test', () => {
    beforeEach(() => {
      // Mock API key authentication
      jest.spyOn(AuthMiddleware.prototype, 'authenticateApiKey').mockImplementation(
        async (req: any, res: any, next: any) => {
          req.user = {
            id: 'user-123',
            email: 'test@example.com',
            tenantId: 'tenant-123',
            subscriptionTier: SubscriptionTier.PREMIUM
          };
          req.scopes = ['email:read', 'email:send'];
          req.rateLimitInfo = {
            limit: 1000,
            remaining: 999,
            resetTime: new Date()
          };
          next();
        }
      );

      jest.spyOn(AuthMiddleware.prototype, 'requireScope').mockImplementation(
        (scope: string) => (req: any, res: any, next: any) => next()
      );
    });

    it('should validate API key and return test response', async () => {
      const response = await request(app)
        .get('/api/keys/test')
        .set('X-API-Key', 'bep_test_key_12345');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('API key is valid and working');
      expect(response.body.data.user.id).toBe('user-123');
      expect(response.body.data.scopes).toContain('email:read');
      expect(response.body.data.rateLimit.limit).toBe(1000);
    });
  });

  describe('Rate Limiting Headers', () => {
    beforeEach(() => {
      jest.spyOn(AuthMiddleware.prototype, 'authenticateApiKey').mockImplementation(
        async (req: any, res: any, next: any) => {
          res.set({
            'X-RateLimit-Limit': '1000',
            'X-RateLimit-Remaining': '999',
            'X-RateLimit-Reset': Math.ceil(Date.now() / 1000 + 3600).toString()
          });
          req.user = { id: 'user-123', tenantId: 'tenant-123' };
          next();
        }
      );
    });

    it('should include rate limit headers in API responses', async () => {
      mockApiKeyService.listApiKeys.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/keys')
        .set('X-API-Key', 'bep_test_key_12345');

      expect(response.headers['x-ratelimit-limit']).toBe('1000');
      expect(response.headers['x-ratelimit-remaining']).toBe('999');
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors properly', async () => {
      jest.spyOn(AuthMiddleware.prototype, 'validateRequest').mockImplementation(
        (schema: any) => (req: any, res: any, next: any) => {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Request validation failed',
              details: {
                field: 'name',
                message: '"name" is required'
              }
            }
          });
        }
      );

      const response = await request(app)
        .post('/api/keys')
        .send({
          scopes: ['email:send'] // Missing name
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle authentication errors', async () => {
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

      const response = await request(app).get('/api/keys');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});