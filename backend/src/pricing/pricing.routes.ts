import { Router } from 'express';
import { PricingService } from './pricing.service';
import { authMiddleware } from '../auth/auth.middleware';
import { ApiResponse } from '../shared/types';
import rateLimit from 'express-rate-limit';
import { body, param, validationResult } from 'express-validator';

const router = Router();
const pricingService = new PricingService();

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

const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit admin operations
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many admin requests, please try again later'
    }
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Validation middleware
const validateCreatePlan = [
  body('name').notEmpty().trim().isLength({ min: 1, max: 100 }).withMessage('Name is required and must be 1-100 characters'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
  body('features').isArray().withMessage('Features must be an array'),
  body('features.*').isString().withMessage('Each feature must be a string'),
  body('limits').isObject().withMessage('Limits must be an object'),
  body('active').optional().isBoolean().withMessage('Active must be a boolean')
];

const validateUpdatePlan = [
  param('id').isUUID().withMessage('Invalid plan ID'),
  body('name').optional().trim().isLength({ min: 1, max: 100 }).withMessage('Name must be 1-100 characters'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
  body('features').optional().isArray().withMessage('Features must be an array'),
  body('features.*').optional().isString().withMessage('Each feature must be a string'),
  body('limits').optional().isObject().withMessage('Limits must be an object'),
  body('active').optional().isBoolean().withMessage('Active must be a boolean')
];

const validatePlanId = [
  param('id').isUUID().withMessage('Invalid plan ID')
];

// Validation error handler
const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: errors.array()
      }
    } as ApiResponse);
  }
  next();
};

// Admin authorization middleware
const requireAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: 'Admin access required'
      }
    } as ApiResponse);
  }
  next();
};

/**
 * GET /api/pricing/plans - Get all pricing plans
 * Requirement 4.1: Display pricing information from database
 */
router.get('/plans', pricingRateLimit, async (req, res) => {
  try {
    const plans = await pricingService.getPlansWithFallback();

    res.json({
      success: true,
      data: {
        plans,
        count: plans.length,
        timestamp: new Date().toISOString()
      }
    } as ApiResponse);
  } catch (error) {
    console.error('Failed to get pricing plans:', error);
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
 * GET /api/pricing/plans/:id - Get specific pricing plan
 * Requirement 4.1: Display pricing information from database
 */
router.get('/plans/:id', pricingRateLimit, validatePlanId, handleValidationErrors, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const plan = await pricingService.getPlanById(id);

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
    console.error('Failed to get pricing plan:', error);
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
 * POST /api/pricing/plans - Create new pricing plan (Admin only)
 * Requirement 4.2: Manage pricing data in database
 */
router.post('/plans', adminRateLimit, authMiddleware, requireAdmin, validateCreatePlan, handleValidationErrors, async (req: any, res: any) => {
  try {
    const planData = req.body;
    const plan = await pricingService.createPlan(planData);

    // Log admin action
    console.log('Pricing plan created by admin:', {
      adminId: req.user?.userId || req.user?.id,
      planId: plan.id,
      planName: plan.name,
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      success: true,
      data: {
        plan,
        timestamp: new Date().toISOString()
      }
    } as ApiResponse);
  } catch (error) {
    console.error('Failed to create pricing plan:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PRICING_CREATE_ERROR',
        message: 'Failed to create pricing plan'
      }
    } as ApiResponse);
  }
});

/**
 * PUT /api/pricing/plans/:id - Update pricing plan (Admin only)
 * Requirement 4.2: Manage pricing data in database
 */
router.put('/plans/:id', adminRateLimit, authMiddleware, requireAdmin, validateUpdatePlan, handleValidationErrors, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const planData = req.body;
    
    const plan = await pricingService.updatePlan(id, planData);

    if (!plan) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Pricing plan not found'
        }
      } as ApiResponse);
    }

    // Log admin action
    console.log('Pricing plan updated by admin:', {
      adminId: req.user?.userId || req.user?.id,
      planId: plan.id,
      planName: plan.name,
      changes: Object.keys(planData),
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        plan,
        timestamp: new Date().toISOString()
      }
    } as ApiResponse);
  } catch (error) {
    console.error('Failed to update pricing plan:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PRICING_UPDATE_ERROR',
        message: 'Failed to update pricing plan'
      }
    } as ApiResponse);
  }
});

/**
 * DELETE /api/pricing/plans/:id - Delete pricing plan (Admin only)
 * Requirement 4.2: Manage pricing data in database
 */
router.delete('/plans/:id', adminRateLimit, authMiddleware, requireAdmin, validatePlanId, handleValidationErrors, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const deleted = await pricingService.deletePlan(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Pricing plan not found'
        }
      } as ApiResponse);
    }

    // Log admin action
    console.log('Pricing plan deleted by admin:', {
      adminId: req.user?.userId || req.user?.id,
      planId: id,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        message: 'Pricing plan deleted successfully',
        planId: id,
        timestamp: new Date().toISOString()
      }
    } as ApiResponse);
  } catch (error) {
    console.error('Failed to delete pricing plan:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PRICING_DELETE_ERROR',
        message: 'Failed to delete pricing plan'
      }
    } as ApiResponse);
  }
});

/**
 * POST /api/pricing/seed - Seed default pricing plans (Admin only)
 * Requirement 4.2: Initialize pricing data in database
 */
router.post('/seed', adminRateLimit, authMiddleware, requireAdmin, async (req, res) => {
  try {
    await pricingService.seedDefaultPlans();

    // Log admin action
    console.log('Default pricing plans seeded by admin:', {
      adminId: req.user?.userId || req.user?.id,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      data: {
        message: 'Default pricing plans seeded successfully',
        timestamp: new Date().toISOString()
      }
    } as ApiResponse);
  } catch (error) {
    console.error('Failed to seed pricing plans:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PRICING_SEED_ERROR',
        message: 'Failed to seed pricing plans'
      }
    } as ApiResponse);
  }
});

/**
 * GET /api/pricing/validate - Validate pricing data integrity (Admin only)
 * Requirement 4.3: Ensure data integrity and accuracy
 */
router.get('/validate', adminRateLimit, authMiddleware, requireAdmin, async (req, res) => {
  try {
    const validation = await pricingService.validatePricingIntegrity();

    const statusCode = validation.isValid ? 200 : 400;

    res.status(statusCode).json({
      success: validation.isValid,
      data: {
        validation,
        timestamp: new Date().toISOString()
      }
    } as ApiResponse);
  } catch (error) {
    console.error('Failed to validate pricing integrity:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PRICING_VALIDATION_ERROR',
        message: 'Failed to validate pricing integrity'
      }
    } as ApiResponse);
  }
});

/**
 * GET /api/pricing/health - Health check for pricing service
 */
router.get('/health', async (req, res) => {
  try {
    // Test basic service functionality
    const plans = await pricingService.getAllPlans();
    const validation = await pricingService.validatePricingIntegrity();

    const health = {
      status: validation.isValid ? 'healthy' : 'degraded',
      service: 'pricing',
      planCount: validation.planCount,
      errors: validation.errors,
      timestamp: new Date().toISOString()
    };

    const statusCode = validation.isValid ? 200 : 503;

    res.status(statusCode).json({
      success: validation.isValid,
      data: health
    } as ApiResponse);
  } catch (error) {
    console.error('Pricing service health check failed:', error);
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        service: 'pricing',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    } as ApiResponse);
  }
});

export default router;