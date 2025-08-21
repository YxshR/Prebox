import request from 'supertest';
import express from 'express';
import pricingRoutes from './pricing.routes';
import { PricingProtectionService } from './pricing-protection.service';
import { authMiddleware } from '../auth/auth.middleware';

// Mock dependencies
jest.mock('./pricing-protection.service');
jest.mock('../auth/auth.middleware');

const MockedPricingProtectionService = PricingProtectionService as jest.MockedClass<typeof PricingProtectionService>;
const mockedAuthMiddleware = authMiddleware as jest.MockedFunction<typeof authMiddleware>;

describe('Pricing Routes Integration Tests', () => {
  let app: express.Application;
  let mockPricingService: jest.Mocked<PricingProtectionService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock auth middleware to add user to request
    mockedAuthMiddleware.mockImplementation((req: any, res: any, next: any) => {
      req.user = { id: 'user-123', role: 'user' };
      next();
    });

    app.use('/api/pricing', pricingRoutes);

    mockPricingService = new MockedPricingProtectionService() as jest.Mocked<PricingProtectionService>;
    
    // Replace the service instance in the routes
    jest.clearAllMocks();
  });

  describe('GET /api/pricing', () => {
    it('should return all active pricing plans with validated signatures', async () => {
      const mockPlans = [
        {
          planId: 'free',
          planName: 'Free Plan',
          priceAmount: 0,
          currency: 'INR',
          billingCycle: 'monthly',
          features: ['Basic features'],
          limits: { emails: 100 },
          isPopular: false,
          jwtSignature: 'valid.signature.1'
        },
        {
          planId: 'premium',
          planName: 'Premium Plan',
          priceAmount: 99.99,
          currency: 'INR',
          billingCycle: 'monthly',
          features: ['Premium features'],
          limits: { emails: 10000 },
          isPopular: true,
          jwtSignature: 'valid.signature.2'
        }
      ];

      // Mock the service methods
      PricingProtectionService.prototype.getSecurePricing = jest.fn().mockResolvedValue(mockPlans);
      PricingProtectionService.prototype.verifyPricingSignature = jest.fn().mockReturnValue(true);
      PricingProtectionService.prototype.generatePricingHash = jest.fn().mockReturnValue('integrity-hash');

      const response = await request(app)
        .get('/api/pricing')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plans).toHaveLength(2);
      expect(response.body.data.plans[0]).not.toHaveProperty('jwtSignature');
      expect(response.body.data.plans[0]).toHaveProperty('integrityHash');
      expect(response.body.data.count).toBe(2);
    });

    it('should filter out plans with invalid signatures', async () => {
      const mockPlans = [
        {
          planId: 'valid-plan',
          planName: 'Valid Plan',
          priceAmount: 99.99,
          currency: 'INR',
          billingCycle: 'monthly',
          features: ['Features'],
          limits: { emails: 1000 },
          isPopular: false,
          jwtSignature: 'valid.signature'
        },
        {
          planId: 'invalid-plan',
          planName: 'Invalid Plan',
          priceAmount: 199.99,
          currency: 'INR',
          billingCycle: 'monthly',
          features: ['Features'],
          limits: { emails: 2000 },
          isPopular: false,
          jwtSignature: 'invalid.signature'
        }
      ];

      PricingProtectionService.prototype.getSecurePricing = jest.fn().mockResolvedValue(mockPlans);
      PricingProtectionService.prototype.verifyPricingSignature = jest.fn()
        .mockReturnValueOnce(true)  // First plan valid
        .mockReturnValueOnce(false); // Second plan invalid
      PricingProtectionService.prototype.generatePricingHash = jest.fn().mockReturnValue('integrity-hash');

      const response = await request(app)
        .get('/api/pricing')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plans).toHaveLength(1);
      expect(response.body.data.plans[0].planId).toBe('valid-plan');
    });

    it('should handle service errors gracefully', async () => {
      PricingProtectionService.prototype.getSecurePricing = jest.fn()
        .mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/pricing')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PRICING_RETRIEVAL_ERROR');
    });

    it('should apply rate limiting', async () => {
      PricingProtectionService.prototype.getSecurePricing = jest.fn().mockResolvedValue([]);
      PricingProtectionService.prototype.verifyPricingSignature = jest.fn().mockReturnValue(true);

      // Make multiple requests rapidly
      const requests = Array(60).fill(null).map(() => 
        request(app).get('/api/pricing')
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/pricing/:planId', () => {
    it('should return specific pricing plan with valid signature', async () => {
      const mockPlan = {
        planId: 'premium',
        planName: 'Premium Plan',
        priceAmount: 99.99,
        currency: 'INR',
        billingCycle: 'monthly',
        features: ['Premium features'],
        limits: { emails: 10000 },
        isPopular: true,
        jwtSignature: 'valid.signature'
      };

      PricingProtectionService.prototype.getSecurePricing = jest.fn().mockResolvedValue([mockPlan]);
      PricingProtectionService.prototype.verifyPricingSignature = jest.fn().mockReturnValue(true);
      PricingProtectionService.prototype.generatePricingHash = jest.fn().mockReturnValue('integrity-hash');

      const response = await request(app)
        .get('/api/pricing/premium')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plan.planId).toBe('premium');
      expect(response.body.data.plan).not.toHaveProperty('jwtSignature');
      expect(response.body.data.plan).toHaveProperty('integrityHash');
    });

    it('should return 404 for non-existent plan', async () => {
      PricingProtectionService.prototype.getSecurePricing = jest.fn().mockResolvedValue([]);

      const response = await request(app)
        .get('/api/pricing/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PLAN_NOT_FOUND');
    });

    it('should return 500 for plan with invalid signature', async () => {
      const mockPlan = {
        planId: 'premium',
        planName: 'Premium Plan',
        priceAmount: 99.99,
        currency: 'INR',
        billingCycle: 'monthly',
        features: ['Premium features'],
        limits: { emails: 10000 },
        isPopular: true,
        jwtSignature: 'invalid.signature'
      };

      PricingProtectionService.prototype.getSecurePricing = jest.fn().mockResolvedValue([mockPlan]);
      PricingProtectionService.prototype.verifyPricingSignature = jest.fn().mockReturnValue(false);

      const response = await request(app)
        .get('/api/pricing/premium')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PRICING_SIGNATURE_INVALID');
    });
  });

  describe('POST /api/pricing/validate', () => {
    it('should validate correct pricing data', async () => {
      const mockValidation = {
        isValid: true,
        pricingData: {
          planId: 'premium',
          priceAmount: 99.99,
          currency: 'INR'
        }
      };

      PricingProtectionService.prototype.validatePricing = jest.fn().mockResolvedValue(mockValidation);

      const response = await request(app)
        .post('/api/pricing/validate')
        .send({
          planId: 'premium',
          amount: 99.99,
          currency: 'INR'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.validatedAmount).toBe(99.99);
    });

    it('should detect pricing tampering', async () => {
      const mockValidation = {
        isValid: false,
        error: 'Pricing data mismatch detected'
      };

      PricingProtectionService.prototype.validatePricing = jest.fn().mockResolvedValue(mockValidation);

      const response = await request(app)
        .post('/api/pricing/validate')
        .send({
          planId: 'premium',
          amount: 49.99, // Tampered amount
          currency: 'INR'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(false);
      expect(response.body.data.error).toBe('Pricing data mismatch detected');
    });

    it('should require planId and amount', async () => {
      const response = await request(app)
        .post('/api/pricing/validate')
        .send({
          planId: 'premium'
          // Missing amount
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_VALIDATION_DATA');
    });
  });

  describe('POST /api/pricing/purchase/validate', () => {
    it('should validate legitimate purchase request', async () => {
      const mockValidation = {
        isValid: true,
        serverAmount: 99.99
      };

      PricingProtectionService.prototype.validatePurchaseRequest = jest.fn().mockResolvedValue(mockValidation);

      const response = await request(app)
        .post('/api/pricing/purchase/validate')
        .send({
          planId: 'premium',
          amount: 99.99
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.validatedAmount).toBe(99.99);
    });

    it('should reject tampered purchase request', async () => {
      const mockValidation = {
        isValid: false,
        error: 'Pricing data mismatch detected'
      };

      PricingProtectionService.prototype.validatePurchaseRequest = jest.fn().mockResolvedValue(mockValidation);

      const response = await request(app)
        .post('/api/pricing/purchase/validate')
        .send({
          planId: 'premium',
          amount: 49.99 // Tampered amount
        })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PURCHASE_VALIDATION_FAILED');
    });

    it('should require authentication', async () => {
      // Mock auth middleware to reject request
      mockedAuthMiddleware.mockImplementation((req: any, res: any, next: any) => {
        res.status(401).json({ error: 'Unauthorized' });
      });

      const response = await request(app)
        .post('/api/pricing/purchase/validate')
        .send({
          planId: 'premium',
          amount: 99.99
        })
        .expect(401);

      expect(response.body.error).toBe('Unauthorized');
    });
  });

  describe('GET /api/pricing/security/stats', () => {
    it('should return security statistics for admin users', async () => {
      // Mock auth middleware to add admin user
      mockedAuthMiddleware.mockImplementation((req: any, res: any, next: any) => {
        req.user = { id: 'admin-123', role: 'admin' };
        next();
      });

      const mockStats = {
        totalAttempts: 5,
        uniqueUsers: 3,
        averagePriceDifference: 50.25,
        topTargetedPlans: [
          { planId: 'premium', attempts: 3 },
          { planId: 'enterprise', attempts: 2 }
        ]
      };

      PricingProtectionService.prototype.getTamperingStatistics = jest.fn().mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/pricing/security/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalAttempts).toBe(5);
      expect(response.body.data.uniqueUsers).toBe(3);
    });

    it('should reject non-admin users', async () => {
      // Mock auth middleware to add regular user
      mockedAuthMiddleware.mockImplementation((req: any, res: any, next: any) => {
        req.user = { id: 'user-123', role: 'user' };
        next();
      });

      const response = await request(app)
        .get('/api/pricing/security/stats')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should validate timeframe parameter', async () => {
      mockedAuthMiddleware.mockImplementation((req: any, res: any, next: any) => {
        req.user = { id: 'admin-123', role: 'admin' };
        next();
      });

      const response = await request(app)
        .get('/api/pricing/security/stats?timeframe=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TIMEFRAME');
    });
  });

  describe('POST /api/pricing/admin/create', () => {
    it('should create pricing plan for admin users', async () => {
      mockedAuthMiddleware.mockImplementation((req: any, res: any, next: any) => {
        req.user = { id: 'admin-123', role: 'admin' };
        next();
      });

      const mockCreatedPlan = {
        planId: 'new-plan',
        planName: 'New Plan',
        priceAmount: 149.99,
        currency: 'INR',
        billingCycle: 'monthly',
        features: ['New features'],
        limits: { emails: 5000 },
        isPopular: false,
        jwtSignature: 'generated.signature'
      };

      PricingProtectionService.prototype.createOrUpdatePricing = jest.fn().mockResolvedValue(mockCreatedPlan);

      const response = await request(app)
        .post('/api/pricing/admin/create')
        .send({
          planId: 'new-plan',
          planName: 'New Plan',
          priceAmount: 149.99,
          features: ['New features'],
          limits: { emails: 5000 }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plan.planId).toBe('new-plan');
      expect(response.body.data.plan).not.toHaveProperty('jwtSignature');
    });

    it('should reject non-admin users', async () => {
      mockedAuthMiddleware.mockImplementation((req: any, res: any, next: any) => {
        req.user = { id: 'user-123', role: 'user' };
        next();
      });

      const response = await request(app)
        .post('/api/pricing/admin/create')
        .send({
          planId: 'new-plan',
          planName: 'New Plan',
          priceAmount: 149.99
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should validate required fields', async () => {
      mockedAuthMiddleware.mockImplementation((req: any, res: any, next: any) => {
        req.user = { id: 'admin-123', role: 'admin' };
        next();
      });

      const response = await request(app)
        .post('/api/pricing/admin/create')
        .send({
          planId: 'new-plan'
          // Missing planName and priceAmount
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_PLAN_DATA');
    });

    it('should validate price amount', async () => {
      mockedAuthMiddleware.mockImplementation((req: any, res: any, next: any) => {
        req.user = { id: 'admin-123', role: 'admin' };
        next();
      });

      const response = await request(app)
        .post('/api/pricing/admin/create')
        .send({
          planId: 'new-plan',
          planName: 'New Plan',
          priceAmount: -99.99 // Invalid negative price
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_PRICE');
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in all responses', async () => {
      PricingProtectionService.prototype.getSecurePricing = jest.fn().mockResolvedValue([]);
      PricingProtectionService.prototype.verifyPricingSignature = jest.fn().mockReturnValue(true);

      const response = await request(app)
        .get('/api/pricing')
        .expect(200);

      expect(response.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, private');
      expect(response.headers['pragma']).toBe('no-cache');
      expect(response.headers['expires']).toBe('0');
      expect(response.headers['content-security-policy']).toBe("default-src 'self'; script-src 'none'");
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/pricing/validate')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      // Express should handle malformed JSON and return 400
      expect(response.status).toBe(400);
    });

    it('should handle very large request bodies', async () => {
      const largeData = {
        planId: 'test',
        amount: 99.99,
        largeField: 'x'.repeat(10000000) // 10MB string
      };

      const response = await request(app)
        .post('/api/pricing/validate')
        .send(largeData);

      // Should either succeed or fail gracefully (not crash)
      expect([200, 400, 413, 500]).toContain(response.status);
    });
  });
});