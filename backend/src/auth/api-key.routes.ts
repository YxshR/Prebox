import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { ApiKeyService, ApiKeyCreateRequest } from './api-key.service';
import { RateLimiterService } from './rate-limiter.service';
import { AuthMiddleware, AuthenticatedRequest } from './auth.middleware';

const router = Router();
const apiKeyService = new ApiKeyService();
const rateLimiterService = new RateLimiterService();
const authMiddleware = new AuthMiddleware();

// Validation schemas
const createApiKeySchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  scopes: Joi.array().items(Joi.string()).min(1).required(),
  expiresAt: Joi.date().greater('now').optional()
});

const updateApiKeySchema = Joi.object({
  name: Joi.string().min(1).max(100).optional(),
  scopes: Joi.array().items(Joi.string()).min(1).optional(),
  expiresAt: Joi.date().greater('now').allow(null).optional()
});

// Create new API key
router.post('/', 
  authMiddleware.authenticate,
  authMiddleware.validateRequest(createApiKeySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const request: ApiKeyCreateRequest = req.body;

      const apiKey = await apiKeyService.generateApiKey(user.id, user.tenantId, request);

      res.status(201).json({
        success: true,
        data: apiKey,
        message: 'API key created successfully. Please save the key securely as it will not be shown again.'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: {
          code: 'API_KEY_CREATION_FAILED',
          message: error.message
        }
      });
    }
  }
);

// List user's API keys
router.get('/', 
  authMiddleware.authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const apiKeys = await apiKeyService.listApiKeys(user.id);

      res.json({
        success: true,
        data: {
          apiKeys,
          total: apiKeys.length
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          code: 'API_KEY_LIST_FAILED',
          message: error.message
        }
      });
    }
  }
);

// Get API key usage statistics
router.get('/:keyId/usage', 
  authMiddleware.authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { keyId } = req.params;
      const days = parseInt(req.query.days as string) || 30;

      const usage = await apiKeyService.getApiKeyUsage(user.id, keyId, days);

      res.json({
        success: true,
        data: usage
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: {
          code: 'API_KEY_USAGE_FAILED',
          message: error.message
        }
      });
    }
  }
);

// Update API key
router.put('/:keyId', 
  authMiddleware.authenticate,
  authMiddleware.validateRequest(updateApiKeySchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { keyId } = req.params;
      const updates = req.body;

      await apiKeyService.updateApiKey(user.id, keyId, updates);

      res.json({
        success: true,
        message: 'API key updated successfully'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: {
          code: 'API_KEY_UPDATE_FAILED',
          message: error.message
        }
      });
    }
  }
);

// Revoke API key
router.delete('/:keyId', 
  authMiddleware.authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const { keyId } = req.params;

      await apiKeyService.revokeApiKey(user.id, keyId);

      res.json({
        success: true,
        message: 'API key revoked successfully'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: {
          code: 'API_KEY_REVOCATION_FAILED',
          message: error.message
        }
      });
    }
  }
);

// Get API analytics for tenant
router.get('/analytics', 
  authMiddleware.authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const days = parseInt(req.query.days as string) || 30;
      const apiKeyId = req.query.apiKeyId as string;

      const analytics = await rateLimiterService.getApiAnalytics(user.tenantId, apiKeyId, days);

      res.json({
        success: true,
        data: {
          analytics,
          period: `${days} days`,
          tenantId: user.tenantId
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          code: 'API_ANALYTICS_FAILED',
          message: error.message
        }
      });
    }
  }
);

// Get available scopes for current user's subscription tier
router.get('/scopes', 
  authMiddleware.authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      
      // Get allowed scopes based on subscription tier
      const scopes = getAvailableScopes(user.subscriptionTier);
      const limits = getApiKeyLimits(user.subscriptionTier);

      res.json({
        success: true,
        data: {
          availableScopes: scopes,
          limits,
          currentTier: user.subscriptionTier
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          code: 'SCOPES_FETCH_FAILED',
          message: error.message
        }
      });
    }
  }
);

// Test API key endpoint (for validating API key functionality)
router.get('/test', 
  authMiddleware.authenticateApiKey,
  authMiddleware.requireScope('email:read'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const scopes = req.scopes!;
      const rateLimitInfo = req.rateLimitInfo;

      res.json({
        success: true,
        data: {
          message: 'API key is valid and working',
          user: {
            id: user.id,
            email: user.email,
            tenantId: user.tenantId,
            subscriptionTier: user.subscriptionTier
          },
          scopes,
          rateLimit: {
            limit: rateLimitInfo?.limit,
            remaining: rateLimitInfo?.remaining,
            resetTime: rateLimitInfo?.resetTime
          }
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          code: 'API_KEY_TEST_FAILED',
          message: error.message
        }
      });
    }
  }
);

// Helper functions
function getAvailableScopes(subscriptionTier: string): string[] {
  const baseScopes = ['email:send', 'email:read'];
  
  switch (subscriptionTier) {
    case 'free':
      return baseScopes;
    case 'paid_standard':
      return [...baseScopes, 'templates:read', 'templates:write', 'contacts:read'];
    case 'premium':
      return [...baseScopes, 'templates:read', 'templates:write', 'contacts:read', 'contacts:write', 'analytics:read', 'domains:read'];
    case 'enterprise':
      return [...baseScopes, 'templates:read', 'templates:write', 'contacts:read', 'contacts:write', 'analytics:read', 'domains:read', 'domains:write', 'admin:read'];
    default:
      return baseScopes;
  }
}

function getApiKeyLimits(subscriptionTier: string): { maxKeys: number; rateLimits: any } {
  switch (subscriptionTier) {
    case 'free':
      return { 
        maxKeys: 1, 
        rateLimits: { hourly: 50, daily: 100, monthly: 2000 }
      };
    case 'paid_standard':
      return { 
        maxKeys: 3, 
        rateLimits: { hourly: 500, daily: 1000, monthly: 30000 }
      };
    case 'premium':
      return { 
        maxKeys: 10, 
        rateLimits: { hourly: 2000, daily: 5000, monthly: 100000 }
      };
    case 'enterprise':
      return { 
        maxKeys: 50, 
        rateLimits: { hourly: 10000, daily: 25000, monthly: 1000000 }
      };
    default:
      return { 
        maxKeys: 1, 
        rateLimits: { hourly: 50, daily: 100, monthly: 2000 }
      };
  }
}

export default router;