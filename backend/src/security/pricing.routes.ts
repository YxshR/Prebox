import express from 'express';
import { PricingProtectionService } from './pricing-protection.service';
import {
  validatePricingSignature,
  addSecurityHeaders,
  rateLimitPricingRequests
} from './pricing-validation.middleware';
import { authMiddleware } from '../auth/auth.middleware';

const router = express.Router();
const pricingService = new PricingProtectionService();

/**
 * Secure Pricing API Routes
 * Implements secure pricing retrieval with JWT protection
 * Requirements 7.1, 7.2, 7.3, 8.1, 8.2
 */

/**
 * GET /api/pricing - Get all active pricing plans
 * Requirement 7.2: Verify JWT signatures before displaying prices
 */
router.get(
  '/',
  addSecurityHeaders,
  rateLimitPricingRequests(50, 15 * 60 * 1000), // 50 requests per 15 minutes
  async (req, res) => {
    try {
      const pricingPlans = await pricingService.getSecurePricing();

      // Verify all signatures before returning data
      const validatedPlans = [];
      for (const plan of pricingPlans) {
        const isValid = pricingService.verifyPricingSignature(
          plan.planId,
          plan.priceAmount,
          plan.currency,
          plan.billingCycle,
          plan.jwtSignature
        );

        if (isValid) {
          // Remove JWT signature from client response for security
          const { jwtSignature, ...clientPlan } = plan;
          validatedPlans.push({
            ...clientPlan,
            // Add integrity hash for client-side verification
            integrityHash: pricingService.generatePricingHash(
              plan.planId,
              plan.priceAmount,
              Date.now()
            )
          });
        } else {
          console.error('🚨 Invalid pricing signature detected:', plan.planId);
        }
      }

      res.json({
        success: true,
        data: {
          plans: validatedPlans,
          timestamp: new Date().toISOString(),
          count: validatedPlans.length
        }
      });
    } catch (error) {
      console.error('Failed to retrieve pricing plans:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PRICING_RETRIEVAL_ERROR',
          message: 'Failed to retrieve pricing plans'
        }
      });
    }
  }
);

/**
 * GET /api/pricing/:planId - Get specific pricing plan
 * Requirement 7.2: Verify JWT signatures before displaying prices
 */
router.get(
  '/:planId',
  addSecurityHeaders,
  rateLimitPricingRequests(100, 15 * 60 * 1000), // 100 requests per 15 minutes
  validatePricingSignature,
  async (req, res) => {
    try {
      const { planId } = req.params;
      const pricingData = req.pricingData; // Set by validatePricingSignature middleware

      // Remove JWT signature from response
      const { jwtSignature, ...clientPlan } = pricingData;

      res.json({
        success: true,
        data: {
          plan: {
            ...clientPlan,
            integrityHash: pricingService.generatePricingHash(
              pricingData.planId,
              pricingData.priceAmount,
              Date.now()
            )
          },
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Failed to retrieve pricing plan:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PRICING_RETRIEVAL_ERROR',
          message: 'Failed to retrieve pricing plan'
        }
      });
    }
  }
);

/**
 * POST /api/pricing/validate - Validate pricing data
 * Requirement 7.3: Validate all pricing server-side using database values
 */
router.post(
  '/validate',
  addSecurityHeaders,
  rateLimitPricingRequests(200, 15 * 60 * 1000), // 200 requests per 15 minutes
  async (req, res) => {
    try {
      const { planId, amount, currency = 'INR' } = req.body;

      if (!planId || !amount) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_VALIDATION_DATA',
            message: 'Plan ID and amount are required'
          }
        });
      }

      const validation = await pricingService.validatePricing(planId, amount, currency);

      res.json({
        success: true,
        data: {
          isValid: validation.isValid,
          planId,
          validatedAmount: validation.pricingData?.priceAmount,
          currency: validation.pricingData?.currency,
          error: validation.error,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Pricing validation error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Pricing validation failed'
        }
      });
    }
  }
);

/**
 * POST /api/pricing/purchase/validate - Validate purchase request
 * Requirement 7.4: Ignore client-side pricing data and use only server-verified amounts
 */
router.post(
  '/purchase/validate',
  addSecurityHeaders,
  authMiddleware, // Require authentication for purchase validation
  rateLimitPricingRequests(50, 15 * 60 * 1000), // 50 requests per 15 minutes
  async (req, res) => {
    try {
      const { planId, amount } = req.body;
      const userId = req.user?.id;

      if (!planId || !amount) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PURCHASE_DATA',
            message: 'Plan ID and amount are required'
          }
        });
      }

      const validation = await pricingService.validatePurchaseRequest(
        planId,
        amount,
        userId
      );

      if (!validation.isValid) {
        // Log security event for failed purchase validation
        console.warn('🚨 Purchase validation failed:', {
          userId,
          planId,
          clientAmount: amount,
          serverAmount: validation.serverAmount,
          error: validation.error,
          timestamp: new Date().toISOString()
        });
      }

      res.json({
        success: validation.isValid,
        data: validation.isValid ? {
          planId,
          validatedAmount: validation.serverAmount,
          currency: 'INR',
          timestamp: new Date().toISOString()
        } : null,
        error: validation.isValid ? null : {
          code: 'PURCHASE_VALIDATION_FAILED',
          message: validation.error || 'Purchase validation failed'
        }
      });
    } catch (error) {
      console.error('Purchase validation error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PURCHASE_VALIDATION_ERROR',
          message: 'Purchase validation failed'
        }
      });
    }
  }
);

/**
 * GET /api/pricing/security/stats - Get pricing security statistics (Admin only)
 * Requirement 8.5: Monitor security events
 */
router.get(
  '/security/stats',
  addSecurityHeaders,
  authMiddleware,
  async (req, res) => {
    try {
      // Check if user is admin
      if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Admin access required'
          }
        });
      }

      const { timeframe = 'day' } = req.query;
      const validTimeframes = ['hour', 'day', 'week'];
      
      if (!validTimeframes.includes(timeframe as string)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_TIMEFRAME',
            message: 'Timeframe must be hour, day, or week'
          }
        });
      }

      const stats = await pricingService.getTamperingStatistics(timeframe as 'hour' | 'day' | 'week');

      res.json({
        success: true,
        data: {
          ...stats,
          timeframe,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Failed to retrieve security stats:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'STATS_RETRIEVAL_ERROR',
          message: 'Failed to retrieve security statistics'
        }
      });
    }
  }
);

/**
 * POST /api/pricing/admin/create - Create or update pricing plan (Admin only)
 * Requirement 7.1: Store pricing with JWT-signed integrity protection
 */
router.post(
  '/admin/create',
  addSecurityHeaders,
  authMiddleware,
  rateLimitPricingRequests(10, 60 * 60 * 1000), // 10 requests per hour
  async (req, res) => {
    try {
      // Check if user is admin
      if (req.user?.role !== 'admin' && req.user?.role !== 'super_admin') {
        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: 'Admin access required'
          }
        });
      }

      const {
        planId,
        planName,
        priceAmount,
        currency = 'INR',
        billingCycle = 'monthly',
        features = [],
        limits = {},
        isPopular = false
      } = req.body;

      // Validate required fields
      if (!planId || !planName || !priceAmount) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PLAN_DATA',
            message: 'Plan ID, name, and price amount are required'
          }
        });
      }

      // Validate price amount
      if (typeof priceAmount !== 'number' || priceAmount < 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PRICE',
            message: 'Price amount must be a positive number'
          }
        });
      }

      const pricingData = await pricingService.createOrUpdatePricing({
        planId,
        planName,
        priceAmount,
        currency: currency.toUpperCase(),
        billingCycle,
        features: Array.isArray(features) ? features : [],
        limits: typeof limits === 'object' ? limits : {},
        isPopular: Boolean(isPopular)
      });

      // Log admin action
      console.log('✅ Pricing plan created/updated by admin:', {
        adminId: req.user?.id,
        planId: pricingData.planId,
        priceAmount: pricingData.priceAmount,
        timestamp: new Date().toISOString()
      });

      // Remove JWT signature from response
      const { jwtSignature, ...responsePlan } = pricingData;

      res.json({
        success: true,
        data: {
          plan: responsePlan,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Failed to create/update pricing plan:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PLAN_CREATION_ERROR',
          message: 'Failed to create/update pricing plan'
        }
      });
    }
  }
);

export default router;