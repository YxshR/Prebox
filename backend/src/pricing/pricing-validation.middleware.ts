import { Request, Response, NextFunction } from 'express';
import { PricingValidationService } from './pricing-validation.service';
import { ApiResponse } from '../shared/types';

const pricingValidationService = new PricingValidationService();

/**
 * Middleware to validate pricing data in requests
 * Requirement 4.2: Implement server-side validation for pricing displays
 */
export const validatePricingMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { planId, amount, currency } = req.body;

    // Skip validation if pricing data is not present
    if (!planId || typeof amount !== 'number') {
      return next();
    }

    const validation = await pricingValidationService.validatePricingRequest({
      planId,
      amount,
      currency: currency || 'INR',
      userId: req.user?.id,
      tenantId: req.user?.tenantId
    });

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          code: validation.errorCode || 'PRICING_VALIDATION_FAILED',
          message: validation.error || 'Invalid pricing data'
        }
      } as ApiResponse);
    }

    // Attach validated pricing data to request
    req.validatedPricing = {
      planId,
      amount: validation.validatedAmount!,
      currency: validation.validatedCurrency!,
      plan: validation.plan!
    };

    next();
  } catch (error) {
    console.error('Pricing validation middleware error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PRICING_VALIDATION_ERROR',
        message: 'Pricing validation failed'
      }
    } as ApiResponse);
  }
};

/**
 * Middleware to validate purchase requests with enhanced security
 * Requirement 4.3: Ensure data integrity and accuracy
 */
export const validatePurchaseMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { planId, amount, currency } = req.body;
    const { id: userId, tenantId } = req.user || {};

    if (!planId || typeof amount !== 'number') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PURCHASE_REQUEST',
          message: 'Plan ID and amount are required for purchase'
        }
      } as ApiResponse);
    }

    if (!userId || !tenantId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'User authentication required for purchase validation'
        }
      } as ApiResponse);
    }

    const validation = await pricingValidationService.validatePurchaseRequest(
      planId,
      amount,
      currency || 'INR',
      userId,
      tenantId
    );

    if (!validation.isValid) {
      // Log failed purchase validation
      console.warn('Purchase validation failed:', {
        userId,
        tenantId,
        planId,
        amount,
        error: validation.error,
        errorCode: validation.errorCode,
        timestamp: new Date().toISOString()
      });

      return res.status(400).json({
        success: false,
        error: {
          code: validation.errorCode || 'PURCHASE_VALIDATION_FAILED',
          message: validation.error || 'Purchase validation failed'
        }
      } as ApiResponse);
    }

    // Attach validated purchase data to request
    req.validatedPurchase = {
      planId,
      amount: validation.validatedAmount!,
      currency: validation.validatedCurrency!,
      plan: validation.plan!,
      userId,
      tenantId
    };

    next();
  } catch (error) {
    console.error('Purchase validation middleware error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PURCHASE_VALIDATION_ERROR',
        message: 'Purchase validation failed'
      }
    } as ApiResponse);
  }
};

/**
 * Middleware to ensure pricing data freshness
 * Requirement 4.2: Add caching mechanism for pricing data
 */
export const ensureFreshPricingMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const cacheStats = await pricingValidationService.getCacheStatistics();
    
    // If cache is not active or data is stale, refresh it
    if (!cacheStats.isCached) {
      console.log('Pricing cache not active, refreshing...');
      await pricingValidationService.refreshPricingCache();
    } else if (cacheStats.lastUpdated) {
      const cacheAge = Date.now() - new Date(cacheStats.lastUpdated).getTime();
      const maxCacheAge = 10 * 60 * 1000; // 10 minutes
      
      if (cacheAge > maxCacheAge) {
        console.log('Pricing cache is stale, refreshing...');
        // Refresh cache in background, don't wait for it
        pricingValidationService.refreshPricingCache().catch(error => {
          console.error('Background cache refresh failed:', error);
        });
      }
    }

    next();
  } catch (error) {
    console.error('Fresh pricing middleware error:', error);
    // Don't block the request, just log the error
    next();
  }
};

/**
 * Middleware to add pricing validation headers
 */
export const addPricingValidationHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Add security headers for pricing endpoints
  res.setHeader('X-Pricing-Validation', 'server-side');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  
  next();
};

/**
 * Error handling middleware for pricing validation
 */
export const pricingValidationErrorHandler = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Pricing validation error:', error);

  // Check if response was already sent
  if (res.headersSent) {
    return next(error);
  }

  // Determine error type and respond appropriately
  let statusCode = 500;
  let errorCode = 'PRICING_VALIDATION_ERROR';
  let message = 'Pricing validation failed';

  if (error.message.includes('not found')) {
    statusCode = 404;
    errorCode = 'PRICING_PLAN_NOT_FOUND';
    message = 'Pricing plan not found';
  } else if (error.message.includes('invalid')) {
    statusCode = 400;
    errorCode = 'INVALID_PRICING_DATA';
    message = 'Invalid pricing data provided';
  } else if (error.message.includes('unauthorized')) {
    statusCode = 401;
    errorCode = 'UNAUTHORIZED_PRICING_ACCESS';
    message = 'Unauthorized access to pricing data';
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }
  } as ApiResponse);
};

// Extend Express Request interface to include validated pricing data
declare global {
  namespace Express {
    interface Request {
      validatedPricing?: {
        planId: string;
        amount: number;
        currency: string;
        plan: any;
      };
      validatedPurchase?: {
        planId: string;
        amount: number;
        currency: string;
        plan: any;
        userId: string;
        tenantId: string;
      };
    }
  }
}