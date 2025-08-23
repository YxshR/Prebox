import { Request, Response, NextFunction } from 'express';
import { PricingProtectionService } from './pricing-protection.service';

export interface PricingValidationRequest extends Request {
  validatedPricing?: {
    planId: string;
    amount: number;
    currency: string;
    plan: any;
  };
  pricingData?: any;
}

/**
 * Pricing Validation Middleware
 * Implements server-side pricing validation to prevent client-side manipulation
 * Requirements 7.3, 7.4, 8.1, 8.2
 */
export class PricingValidationMiddleware {
  private pricingService: PricingProtectionService;

  constructor() {
    this.pricingService = new PricingProtectionService();
  }

  /**
   * Validate pricing data in subscription/purchase requests
   * Requirement 7.3: Validate all pricing server-side using database values
   */
  validateSubscriptionPricing = async (
    req: PricingValidationRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { planId, amount, currency } = req.body;
      const userId = req.user?.id;

      // Extract client IP and user agent for security logging
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      if (!planId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PLAN_ID',
            message: 'Plan ID is required'
          }
        });
        return;
      }

      if (!amount || typeof amount !== 'number') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_AMOUNT',
            message: 'Valid amount is required'
          }
        });
        return;
      }

      // Validate pricing against server-side data
      const validation = await this.pricingService.validatePurchaseRequest(
        planId,
        amount,
        userId
      );

      if (!validation.isValid) {
        // Log security event with additional context
        console.warn('🚨 Pricing validation failed:', {
          userId,
          planId,
          clientAmount: amount,
          serverAmount: validation.serverAmount,
          clientIp,
          userAgent,
          error: validation.error
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'PRICING_VALIDATION_FAILED',
            message: 'Invalid pricing data',
            details: {
              reason: validation.error
            }
          }
        });
        return;
      }

      // Attach validated pricing to request for downstream use
      req.validatedPricing = {
        planId,
        amount: validation.serverAmount!,
        currency: 'USD',
        plan: validation
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
      });
    }
  };

  /**
   * Validate pricing data in payment processing requests
   * Requirement 7.4: Ignore client-side pricing data and use only server-verified amounts
   */
  validatePaymentPricing = async (
    req: PricingValidationRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { planId, amount, paymentIntentId } = req.body;
      const userId = req.user?.id;

      if (!planId || !amount || !paymentIntentId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PAYMENT_DATA',
            message: 'Plan ID, amount, and payment intent ID are required'
          }
        });
        return;
      }

      // Validate pricing for payment processing
      const validation = await this.pricingService.validatePurchaseRequest(
        planId,
        amount,
        userId
      );

      if (!validation.isValid) {
        // Critical security event - payment tampering attempt
        console.error('🚨 CRITICAL: Payment pricing tampering attempt:', {
          userId,
          planId,
          clientAmount: amount,
          serverAmount: validation.serverAmount,
          paymentIntentId,
          timestamp: new Date().toISOString()
        });

        res.status(403).json({
          success: false,
          error: {
            code: 'PAYMENT_SECURITY_VIOLATION',
            message: 'Payment security validation failed'
          }
        });
        return;
      }

      // Override client amount with server-verified amount
      req.body.amount = validation.serverAmount;
      req.validatedPricing = {
        planId,
        amount: validation.serverAmount!,
        currency: 'USD',
        plan: validation
      };

      next();
    } catch (error) {
      console.error('Payment pricing validation error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'PAYMENT_VALIDATION_ERROR',
          message: 'Payment validation failed'
        }
      });
    }
  };

  /**
   * Validate pricing signature in API responses
   * Requirement 7.2: Verify JWT signatures before displaying prices
   */
  validatePricingSignature = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { planId } = req.params;

      if (!planId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PLAN_ID',
            message: 'Plan ID is required'
          }
        });
        return;
      }

      // Get secure pricing data with signature validation
      const pricingData = await this.pricingService.getSecurePricing(planId);

      if (pricingData.length === 0) {
        res.status(404).json({
          success: false,
          error: {
            code: 'PLAN_NOT_FOUND',
            message: 'Pricing plan not found'
          }
        });
        return;
      }

      // Verify signature integrity
      const pricing = pricingData[0];
      const signatureValid = this.pricingService.verifyPricingSignature(
        pricing.planId,
        pricing.priceAmount,
        pricing.currency,
        pricing.billingCycle,
        pricing.jwtSignature
      );

      if (!signatureValid) {
        console.error('🚨 Pricing signature validation failed:', {
          planId: pricing.planId,
          timestamp: new Date().toISOString()
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'PRICING_SIGNATURE_INVALID',
            message: 'Pricing data integrity check failed'
          }
        });
        return;
      }

      // Attach validated pricing to request
      (req as any).pricingData = pricing;
      next();
    } catch (error) {
      console.error('Pricing signature validation error:', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'SIGNATURE_VALIDATION_ERROR',
          message: 'Pricing signature validation failed'
        }
      });
    }
  };

  /**
   * Rate limiting for pricing-related requests to prevent abuse
   * Requirement 8.2: Validate all critical operations server-side
   */
  rateLimitPricingRequests = (maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) => {
    const requestCounts = new Map<string, { count: number; resetTime: number }>();

    return (req: Request, res: Response, next: NextFunction): void => {
      const clientId = req.ip || req.connection.remoteAddress || 'unknown';
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean up old entries
      for (const [key, value] of requestCounts.entries()) {
        if (value.resetTime < windowStart) {
          requestCounts.delete(key);
        }
      }

      // Get or create request count for this client
      let clientData = requestCounts.get(clientId);
      if (!clientData || clientData.resetTime < windowStart) {
        clientData = { count: 0, resetTime: now + windowMs };
        requestCounts.set(clientId, clientData);
      }

      // Check rate limit
      if (clientData.count >= maxRequests) {
        console.warn('🚨 Rate limit exceeded for pricing requests:', {
          clientId,
          count: clientData.count,
          maxRequests,
          timestamp: new Date().toISOString()
        });

        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many pricing requests',
            details: {
              retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
            }
          }
        });
        return;
      }

      // Increment request count
      clientData.count++;
      next();
    };
  };

  /**
   * Security headers middleware for pricing endpoints
   * Requirement 8.1: Prevent access to sensitive pricing modification functions
   */
  addSecurityHeaders = (req: Request, res: Response, next: NextFunction): void => {
    // Prevent caching of pricing data
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    // Content Security Policy
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'none'");

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // XSS Protection
    res.setHeader('X-XSS-Protection', '1; mode=block');

    next();
  };
}

// Export middleware instance
export const pricingValidationMiddleware = new PricingValidationMiddleware();

// Export individual middleware functions for easier use
export const {
  validateSubscriptionPricing,
  validatePaymentPricing,
  validatePricingSignature,
  rateLimitPricingRequests,
  addSecurityHeaders
} = pricingValidationMiddleware;