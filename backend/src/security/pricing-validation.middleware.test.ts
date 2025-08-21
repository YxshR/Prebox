import { Request, Response, NextFunction } from 'express';
import { PricingValidationMiddleware, PricingValidationRequest } from './pricing-validation.middleware';
import { PricingProtectionService } from './pricing-protection.service';

// Mock the PricingProtectionService
jest.mock('./pricing-protection.service');

const MockedPricingProtectionService = PricingProtectionService as jest.MockedClass<typeof PricingProtectionService>;

describe('PricingValidationMiddleware', () => {
  let middleware: PricingValidationMiddleware;
  let mockReq: Partial<PricingValidationRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let mockPricingService: jest.Mocked<PricingProtectionService>;

  beforeEach(() => {
    middleware = new PricingValidationMiddleware();
    mockPricingService = new MockedPricingProtectionService() as jest.Mocked<PricingProtectionService>;
    
    // Replace the service instance in middleware
    (middleware as any).pricingService = mockPricingService;

    mockReq = {
      body: {},
      params: {},
      user: { id: 'user-123', role: 'user' },
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Mozilla/5.0'),
      connection: { remoteAddress: '127.0.0.1' }
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe('validateSubscriptionPricing', () => {
    it('should validate correct subscription pricing', async () => {
      mockReq.body = {
        planId: 'test-plan-1',
        amount: 99.99,
        currency: 'INR'
      };

      mockPricingService.validatePurchaseRequest.mockResolvedValue({
        isValid: true,
        serverAmount: 99.99
      });

      await middleware.validateSubscriptionPricing(
        mockReq as PricingValidationRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockPricingService.validatePurchaseRequest).toHaveBeenCalledWith(
        'test-plan-1',
        99.99,
        'user-123'
      );
      expect(mockReq.validatedPricing).toEqual({
        planId: 'test-plan-1',
        serverAmount: 99.99,
        isValid: true
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject subscription with missing planId', async () => {
      mockReq.body = {
        amount: 99.99
      };

      await middleware.validateSubscriptionPricing(
        mockReq as PricingValidationRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_PLAN_ID',
          message: 'Plan ID is required'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject subscription with invalid amount', async () => {
      mockReq.body = {
        planId: 'test-plan-1',
        amount: 'invalid'
      };

      await middleware.validateSubscriptionPricing(
        mockReq as PricingValidationRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_AMOUNT',
          message: 'Valid amount is required'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject subscription with pricing validation failure', async () => {
      mockReq.body = {
        planId: 'test-plan-1',
        amount: 49.99
      };

      mockPricingService.validatePurchaseRequest.mockResolvedValue({
        isValid: false,
        error: 'Pricing data mismatch detected'
      });

      await middleware.validateSubscriptionPricing(
        mockReq as PricingValidationRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'PRICING_VALIDATION_FAILED',
          message: 'Invalid pricing data',
          details: {
            reason: 'Pricing data mismatch detected'
          }
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      mockReq.body = {
        planId: 'test-plan-1',
        amount: 99.99
      };

      mockPricingService.validatePurchaseRequest.mockRejectedValue(
        new Error('Service unavailable')
      );

      await middleware.validateSubscriptionPricing(
        mockReq as PricingValidationRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'PRICING_VALIDATION_ERROR',
          message: 'Pricing validation failed'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validatePaymentPricing', () => {
    it('should validate correct payment pricing and override client amount', async () => {
      mockReq.body = {
        planId: 'test-plan-1',
        amount: 99.99,
        paymentIntentId: 'pi_test123'
      };

      mockPricingService.validatePurchaseRequest.mockResolvedValue({
        isValid: true,
        serverAmount: 99.99
      });

      await middleware.validatePaymentPricing(
        mockReq as PricingValidationRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.body.amount).toBe(99.99); // Should be overridden with server amount
      expect(mockReq.validatedPricing).toEqual({
        planId: 'test-plan-1',
        serverAmount: 99.99,
        isValid: true
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject payment with missing required data', async () => {
      mockReq.body = {
        planId: 'test-plan-1'
        // Missing amount and paymentIntentId
      };

      await middleware.validatePaymentPricing(
        mockReq as PricingValidationRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_PAYMENT_DATA',
          message: 'Plan ID, amount, and payment intent ID are required'
        }
      });
    });

    it('should treat payment tampering as critical security violation', async () => {
      mockReq.body = {
        planId: 'test-plan-1',
        amount: 49.99, // Tampered amount
        paymentIntentId: 'pi_test123'
      };

      mockPricingService.validatePurchaseRequest.mockResolvedValue({
        isValid: false,
        serverAmount: 99.99,
        error: 'Pricing data mismatch detected'
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await middleware.validatePaymentPricing(
        mockReq as PricingValidationRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'PAYMENT_SECURITY_VIOLATION',
          message: 'Payment security validation failed'
        }
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚨 CRITICAL: Payment pricing tampering attempt:'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('validatePricingSignature', () => {
    it('should validate pricing signature and attach data to request', async () => {
      mockReq.params = { planId: 'test-plan-1' };

      const mockPricingData = {
        planId: 'test-plan-1',
        planName: 'Test Plan',
        priceAmount: 99.99,
        currency: 'INR',
        billingCycle: 'monthly',
        features: ['Feature 1'],
        limits: { emails: 1000 },
        isPopular: false,
        jwtSignature: 'valid.signature'
      };

      mockPricingService.getSecurePricing.mockResolvedValue([mockPricingData]);
      mockPricingService.verifyPricingSignature.mockReturnValue(true);

      await middleware.validatePricingSignature(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.pricingData).toEqual(mockPricingData);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject request with missing planId', async () => {
      mockReq.params = {};

      await middleware.validatePricingSignature(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'MISSING_PLAN_ID',
          message: 'Plan ID is required'
        }
      });
    });

    it('should reject request for non-existent plan', async () => {
      mockReq.params = { planId: 'non-existent-plan' };

      mockPricingService.getSecurePricing.mockResolvedValue([]);

      await middleware.validatePricingSignature(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Pricing plan not found'
        }
      });
    });

    it('should reject request with invalid signature', async () => {
      mockReq.params = { planId: 'test-plan-1' };

      const mockPricingData = {
        planId: 'test-plan-1',
        planName: 'Test Plan',
        priceAmount: 99.99,
        currency: 'INR',
        billingCycle: 'monthly',
        features: ['Feature 1'],
        limits: { emails: 1000 },
        isPopular: false,
        jwtSignature: 'invalid.signature'
      };

      mockPricingService.getSecurePricing.mockResolvedValue([mockPricingData]);
      mockPricingService.verifyPricingSignature.mockReturnValue(false);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await middleware.validatePricingSignature(
        mockReq as Request,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'PRICING_SIGNATURE_INVALID',
          message: 'Pricing data integrity check failed'
        }
      });

      consoleSpy.mockRestore();
    });
  });

  describe('rateLimitPricingRequests', () => {
    it('should allow requests within rate limit', () => {
      const rateLimiter = middleware.rateLimitPricingRequests(5, 60000); // 5 requests per minute

      // First request should pass
      rateLimiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding rate limit', () => {
      const rateLimiter = middleware.rateLimitPricingRequests(2, 60000); // 2 requests per minute

      // First two requests should pass
      rateLimiter(mockReq as Request, mockRes as Response, mockNext);
      rateLimiter(mockReq as Request, mockRes as Response, mockNext);
      
      // Third request should be blocked
      jest.clearAllMocks();
      rateLimiter(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many pricing requests',
          details: {
            retryAfter: expect.any(Number)
          }
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reset rate limit after time window', (done) => {
      const rateLimiter = middleware.rateLimitPricingRequests(1, 100); // 1 request per 100ms

      // First request should pass
      rateLimiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Second request should be blocked
      jest.clearAllMocks();
      rateLimiter(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(429);

      // After time window, request should pass again
      setTimeout(() => {
        jest.clearAllMocks();
        rateLimiter(mockReq as Request, mockRes as Response, mockNext);
        expect(mockNext).toHaveBeenCalledTimes(1);
        expect(mockRes.status).not.toHaveBeenCalled();
        done();
      }, 150);
    });
  });

  describe('addSecurityHeaders', () => {
    it('should add all required security headers', () => {
      middleware.addSecurityHeaders(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, private'
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
      expect(mockRes.setHeader).toHaveBeenCalledWith('Expires', '0');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'none'"
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Security Tests', () => {
    it('should handle requests without user context', async () => {
      mockReq.user = undefined;
      mockReq.body = {
        planId: 'test-plan-1',
        amount: 99.99
      };

      mockPricingService.validatePurchaseRequest.mockResolvedValue({
        isValid: true,
        serverAmount: 99.99
      });

      await middleware.validateSubscriptionPricing(
        mockReq as PricingValidationRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockPricingService.validatePurchaseRequest).toHaveBeenCalledWith(
        'test-plan-1',
        99.99,
        undefined
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle requests without IP address', async () => {
      mockReq.ip = undefined;
      mockReq.connection = {};
      mockReq.body = {
        planId: 'test-plan-1',
        amount: 99.99
      };

      mockPricingService.validatePurchaseRequest.mockResolvedValue({
        isValid: true,
        serverAmount: 99.99
      });

      await middleware.validateSubscriptionPricing(
        mockReq as PricingValidationRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle malicious input in request body', async () => {
      mockReq.body = {
        planId: '<script>alert("xss")</script>',
        amount: 'DROP TABLE users;',
        currency: '../../etc/passwd'
      };

      await middleware.validateSubscriptionPricing(
        mockReq as PricingValidationRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'INVALID_AMOUNT',
          message: 'Valid amount is required'
        }
      });
    });

    it('should handle extremely large numbers', async () => {
      mockReq.body = {
        planId: 'test-plan-1',
        amount: Number.MAX_SAFE_INTEGER
      };

      mockPricingService.validatePurchaseRequest.mockResolvedValue({
        isValid: false,
        error: 'Amount too large'
      });

      await middleware.validateSubscriptionPricing(
        mockReq as PricingValidationRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle negative amounts', async () => {
      mockReq.body = {
        planId: 'test-plan-1',
        amount: -99.99
      };

      mockPricingService.validatePurchaseRequest.mockResolvedValue({
        isValid: false,
        error: 'Negative amount not allowed'
      });

      await middleware.validateSubscriptionPricing(
        mockReq as PricingValidationRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});