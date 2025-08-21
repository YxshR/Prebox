import { Router } from 'express';
import { PricingValidationService } from './pricing-validation.service';
import { authMiddleware } from '../auth/auth.middleware';
import { ApiResponse } from '../shared/types';
import rateLimit from 'express-rate-limit';

const router = Router();
const pricingValidationService = new PricingValidationService();

// Rate limiting for pricing endpoints
const pricingRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many pricing requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

const strictPricingRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs for validation endpoints
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many validation requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * GET /api/pricing/validation/plans - Get all validated pricing plans
 * Requirement 4.1: Display server-validated pricing information
 */
router.get('/plans', pricingRateLimit, async (req, res) => {
  try {
    const plans = await pricingValidationService.getValidatedPricingPlans();

    res.json({
      success: true,
      data: {
        plans,
        count: plans.length,
        timestamp: new Date().toISOString()
      }
    } as ApiResponse);
  } catch (error) {
    console.error('Failed to get validated pricing plans:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PRICING_SERVICE_ERROR',
        message: 'Failed to retrieve pricing plans'
      }
    } as ApiResponse);
  }
});

/**
 * GET /api/pricing/validation/plans/:planId - Get specific validated pricing plan
 * Requirement 4.1: Display server-validated pricing information
 */
router.get('/plans/:planId', pricingRateLimit, async (req, res) => {
  try {
    const { planId } = req.params;
    
    if (!planId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PLAN_ID',
          message: 'Plan ID is required'
        }
      } as ApiResponse);
    }

    const plan = await pricingValidationService.getValidatedPricingPlan(planId);

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Pricing plan not found'
        }
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: {
        plan,
        timestamp: new Date().toISOString()
      }
    } as ApiResponse);
  } catch (error) {
    console.error('Failed to get validated pricing plan:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PRICING_SERVICE_ERROR',
        message: 'Failed to retrieve pricing plan'
      }
    } as ApiResponse);
  }
});

/**
 * POST /api/pricing/validation/validate - Validate pricing request
 * Requirement 4.2: Fetch current prices from backend with validation
 */
router.post('/validate', strictPricingRateLimit, async (req, res) => {
  try {
    const { planId, amount, currency = 'INR', userId, tenantId } = req.body;

    // Validate required fields
    if (!planId || typeof amount !== 'number') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Plan ID and amount are required'
        }
      } as ApiResponse);
    }

    if (amount < 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_AMOUNT',
          message: 'Amount must be a positive number'
        }
      } as ApiResponse);
    }

    const validation = await pricingValidationService.validatePricingRequest({
      planId,
      amount,
      currency,
      userId,
      tenantId
    });

    const statusCode = validation.isValid ? 200 : 400;

    res.status(statusCode).json({
      success: validation.isValid,
      data: validation.isValid ? {
        planId,
        validatedAmount: validation.validatedAmount,
        validatedCurrency: validation.validatedCurrency,
        plan: validation.plan,
        timestamp: new Date().toISOString()
      } : null,
      error: validation.isValid ? null : {
        code: validation.errorCode || 'VALIDATION_FAILED',
        message: validation.error || 'Pricing validation failed'
      }
    } as ApiResponse);
  } catch (error) {
    console.error('Pricing validation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'VALIDATION_SERVICE_ERROR',
        message: 'Pricing validation service error'
      }
    } as ApiResponse);
  }
});

/**
 * POST /api/pricing/validation/purchase - Validate purchase request
 * Requirement 4.3: Ensure data integrity and accuracy
 */
router.post('/purchase', strictPricingRateLimit, authMiddleware, async (req, res) => {
  try {
    const { planId, amount, currency = 'INR' } = req.body;
    const { userId, tenantId } = req.user;

    // Validate required fields
    if (!planId || typeof amount !== 'number') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Plan ID and amount are required'
        }
      } as ApiResponse);
    }

    if (amount < 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_AMOUNT',
          message: 'Amount must be a positive number'
        }
      } as ApiResponse);
    }

    const validation = await pricingValidationService.validatePurchaseRequest(
      planId,
      amount,
      currency,
      userId,
      tenantId
    );

    const statusCode = validation.isValid ? 200 : 400;

    // Log purchase validation attempt
    console.log('Purchase validation attempt:', {
      userId,
      tenantId,
      planId,
      amount,
      currency,
      isValid: validation.isValid,
      error: validation.error,
      timestamp: new Date().toISOString()
    });

    res.status(statusCode).json({
      success: validation.isValid,
      data: validation.isValid ? {
        planId,
        validatedAmount: validation.validatedAmount,
        validatedCurrency: validation.validatedCurrency,
        plan: validation.plan,
        timestamp: new Date().toISOString()
      } : null,
      error: validation.isValid ? null : {
        code: validation.errorCode || 'PURCHASE_VALIDATION_FAILED',
        message: validation.error || 'Purchase validation failed'
      }
    } as ApiResponse);
  } catch (error) {
    console.error('Purchase validation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PURCHASE_VALIDATION_ERROR',
        message: 'Purchase validation service error'
      }
    } as ApiResponse);
  }
});

/**
 * POST /api/pricing/validation/cache/refresh - Refresh pricing cache (Admin only)
 * Requirement 4.2: Add caching mechanism for pricing data
 */
router.post('/cache/refresh', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin access required'
        }
      } as ApiResponse);
    }

    await pricingValidationService.refreshPricingCache();

    // Log admin action
    console.log('Pricing cache refreshed by admin:', {
      adminId: req.user.userId,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        message: 'Pricing cache refreshed successfully',
        timestamp: new Date().toISOString()
      }
    } as ApiResponse);
  } catch (error) {
    console.error('Failed to refresh pricing cache:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CACHE_REFRESH_ERROR',
        message: 'Failed to refresh pricing cache'
      }
    } as ApiResponse);
  }
});

/**
 * GET /api/pricing/validation/cache/stats - Get pricing cache statistics
 * Requirement 4.2: Add caching mechanism for pricing data
 */
router.get('/cache/stats', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin access required'
        }
      } as ApiResponse);
    }

    const stats = await pricingValidationService.getCacheStatistics();

    res.json({
      success: true,
      data: {
        cache: stats,
        timestamp: new Date().toISOString()
      }
    } as ApiResponse);
  } catch (error) {
    console.error('Failed to get cache statistics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CACHE_STATS_ERROR',
        message: 'Failed to retrieve cache statistics'
      }
    } as ApiResponse);
  }
});

/**
 * GET /api/pricing/validation/health - Health check for pricing validation service
 */
router.get('/health', async (req, res) => {
  try {
    // Test basic service functionality
    const plans = await pricingValidationService.getValidatedPricingPlans();
    const cacheStats = await pricingValidationService.getCacheStatistics();

    const health = {
      status: 'healthy',
      service: 'pricing-validation',
      planCount: plans.length,
      cacheStatus: cacheStats.isCached ? 'active' : 'inactive',
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      data: health
    } as ApiResponse);
  } catch (error) {
    console.error('Pricing validation health check failed:', error);
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        service: 'pricing-validation',
        error: error.message,
        timestamp: new Date().toISOString()
      }
    } as ApiResponse);
  }
});

export default router;