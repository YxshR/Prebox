import { PricingProtectionService, SecurePricingData } from './pricing-protection.service';
import pool from '../config/database';
import jwt from 'jsonwebtoken';

// Mock the database pool
jest.mock('../config/database', () => ({
  query: jest.fn()
}));

const mockPool = pool as jest.Mocked<typeof pool>;

describe('PricingProtectionService', () => {
  let pricingService: PricingProtectionService;
  let mockPricingData: Omit<SecurePricingData, 'jwtSignature'>;

  beforeEach(() => {
    pricingService = new PricingProtectionService();
    mockPricingData = {
      planId: 'test-plan-1',
      planName: 'Test Plan',
      priceAmount: 99.99,
      currency: 'INR',
      billingCycle: 'monthly',
      features: ['Feature 1', 'Feature 2'],
      limits: { emails: 1000, recipients: 5000 },
      isPopular: false
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('signPricingData', () => {
    it('should generate a valid JWT signature for pricing data', () => {
      const signature = pricingService.signPricingData(mockPricingData);
      
      expect(signature).toBeDefined();
      expect(typeof signature).toBe('string');
      expect(signature.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should generate different signatures for different pricing data', () => {
      const signature1 = pricingService.signPricingData(mockPricingData);
      
      const modifiedData = { ...mockPricingData, priceAmount: 199.99 };
      const signature2 = pricingService.signPricingData(modifiedData);
      
      expect(signature1).not.toBe(signature2);
    });

    it('should handle errors gracefully when JWT signing fails', () => {
      // Mock JWT sign to throw an error
      jest.spyOn(jwt, 'sign').mockImplementation(() => {
        throw new Error('JWT signing failed');
      });

      expect(() => {
        pricingService.signPricingData(mockPricingData);
      }).toThrow('Pricing signature generation failed');
    });
  });

  describe('verifyPricingSignature', () => {
    it('should verify a valid pricing signature', () => {
      const signature = pricingService.signPricingData(mockPricingData);
      
      const isValid = pricingService.verifyPricingSignature(
        mockPricingData.planId,
        mockPricingData.priceAmount,
        mockPricingData.currency,
        mockPricingData.billingCycle,
        signature
      );
      
      expect(isValid).toBe(true);
    });

    it('should reject invalid pricing signature', () => {
      const signature = pricingService.signPricingData(mockPricingData);
      
      // Try to verify with different price amount
      const isValid = pricingService.verifyPricingSignature(
        mockPricingData.planId,
        199.99, // Different price
        mockPricingData.currency,
        mockPricingData.billingCycle,
        signature
      );
      
      expect(isValid).toBe(false);
    });

    it('should reject malformed JWT signature', () => {
      const isValid = pricingService.verifyPricingSignature(
        mockPricingData.planId,
        mockPricingData.priceAmount,
        mockPricingData.currency,
        mockPricingData.billingCycle,
        'invalid.jwt.signature'
      );
      
      expect(isValid).toBe(false);
    });

    it('should handle JWT verification errors gracefully', () => {
      // Mock JWT verify to throw an error
      jest.spyOn(jwt, 'verify').mockImplementation(() => {
        throw new Error('JWT verification failed');
      });

      const isValid = pricingService.verifyPricingSignature(
        mockPricingData.planId,
        mockPricingData.priceAmount,
        mockPricingData.currency,
        mockPricingData.billingCycle,
        'some.jwt.token'
      );
      
      expect(isValid).toBe(false);
    });
  });

  describe('getSecurePricing', () => {
    it('should retrieve all pricing plans when no planId specified', async () => {
      const mockDbResult = {
        rows: [
          {
            plan_id: 'plan-1',
            plan_name: 'Plan 1',
            price_amount: '99.99',
            currency: 'INR',
            billing_cycle: 'monthly',
            features: ['Feature 1'],
            limits: { emails: 1000 },
            is_popular: false,
            jwt_signature: 'mock.jwt.signature'
          }
        ]
      };

      mockPool.query.mockResolvedValue(mockDbResult);

      const result = await pricingService.getSecurePricing();

      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM get_secure_pricing()', []);
      expect(result).toHaveLength(1);
      expect(result[0].planId).toBe('plan-1');
      expect(result[0].priceAmount).toBe(99.99);
    });

    it('should retrieve specific pricing plan when planId specified', async () => {
      const mockDbResult = {
        rows: [
          {
            plan_id: 'test-plan-1',
            plan_name: 'Test Plan',
            price_amount: '99.99',
            currency: 'INR',
            billing_cycle: 'monthly',
            features: ['Feature 1'],
            limits: { emails: 1000 },
            is_popular: false,
            jwt_signature: 'mock.jwt.signature'
          }
        ]
      };

      mockPool.query.mockResolvedValue(mockDbResult);

      const result = await pricingService.getSecurePricing('test-plan-1');

      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM get_secure_pricing($1)', ['test-plan-1']);
      expect(result).toHaveLength(1);
      expect(result[0].planId).toBe('test-plan-1');
    });

    it('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValue(new Error('Database connection failed'));

      await expect(pricingService.getSecurePricing()).rejects.toThrow('Pricing data retrieval failed');
    });

    it('should handle JSON parsing for features and limits', async () => {
      const mockDbResult = {
        rows: [
          {
            plan_id: 'plan-1',
            plan_name: 'Plan 1',
            price_amount: '99.99',
            currency: 'INR',
            billing_cycle: 'monthly',
            features: '["Feature 1", "Feature 2"]', // JSON string
            limits: '{"emails": 1000}', // JSON string
            is_popular: false,
            jwt_signature: 'mock.jwt.signature'
          }
        ]
      };

      mockPool.query.mockResolvedValue(mockDbResult);

      const result = await pricingService.getSecurePricing();

      expect(result[0].features).toEqual(['Feature 1', 'Feature 2']);
      expect(result[0].limits).toEqual({ emails: 1000 });
    });
  });

  describe('validatePricing', () => {
    it('should validate correct pricing data', async () => {
      const mockDbResult = {
        rows: [
          {
            plan_id: 'test-plan-1',
            plan_name: 'Test Plan',
            price_amount: '99.99',
            currency: 'INR',
            billing_cycle: 'monthly',
            features: ['Feature 1'],
            limits: { emails: 1000 },
            is_popular: false,
            jwt_signature: 'valid.jwt.signature'
          }
        ]
      };

      mockPool.query.mockResolvedValue(mockDbResult);

      // Mock signature verification to return true
      jest.spyOn(pricingService, 'verifyPricingSignature').mockReturnValue(true);

      const result = await pricingService.validatePricing('test-plan-1', 99.99, 'INR');

      expect(result.isValid).toBe(true);
      expect(result.pricingData).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it('should detect pricing tampering attempts', async () => {
      const mockDbResult = {
        rows: [
          {
            plan_id: 'test-plan-1',
            plan_name: 'Test Plan',
            price_amount: '99.99',
            currency: 'INR',
            billing_cycle: 'monthly',
            features: ['Feature 1'],
            limits: { emails: 1000 },
            is_popular: false,
            jwt_signature: 'valid.jwt.signature'
          }
        ]
      };

      mockPool.query.mockResolvedValue(mockDbResult);

      // Mock signature verification to return true
      jest.spyOn(pricingService, 'verifyPricingSignature').mockReturnValue(true);

      // Mock tampering log insertion
      mockPool.query.mockResolvedValueOnce(mockDbResult); // For getSecurePricing
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // For logging tampering attempt

      // Try to validate with wrong price (tampering attempt)
      const result = await pricingService.validatePricing('test-plan-1', 49.99, 'INR');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Pricing data mismatch detected');
    });

    it('should reject plans with invalid signatures', async () => {
      const mockDbResult = {
        rows: [
          {
            plan_id: 'test-plan-1',
            plan_name: 'Test Plan',
            price_amount: '99.99',
            currency: 'INR',
            billing_cycle: 'monthly',
            features: ['Feature 1'],
            limits: { emails: 1000 },
            is_popular: false,
            jwt_signature: 'invalid.jwt.signature'
          }
        ]
      };

      mockPool.query.mockResolvedValue(mockDbResult);

      // Mock signature verification to return false
      jest.spyOn(pricingService, 'verifyPricingSignature').mockReturnValue(false);

      const result = await pricingService.validatePricing('test-plan-1', 99.99, 'INR');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Pricing signature validation failed');
    });

    it('should handle non-existent plans', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const result = await pricingService.validatePricing('non-existent-plan', 99.99, 'INR');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Plan not found');
    });
  });

  describe('validatePurchaseRequest', () => {
    it('should validate legitimate purchase requests', async () => {
      // Mock getSecurePricing call
      jest.spyOn(pricingService, 'getSecurePricing').mockResolvedValue([
        {
          ...mockPricingData,
          jwtSignature: 'valid.signature'
        }
      ]);

      // Mock signature verification
      jest.spyOn(pricingService, 'verifyPricingSignature').mockReturnValue(true);

      const result = await pricingService.validatePurchaseRequest('test-plan-1', 99.99, 'user-123');

      expect(result.isValid).toBe(true);
      expect(result.serverAmount).toBe(99.99);
      expect(result.error).toBeUndefined();
    });

    it('should detect and log purchase tampering attempts', async () => {
      // Mock getSecurePricing call
      jest.spyOn(pricingService, 'getSecurePricing').mockResolvedValue([
        {
          ...mockPricingData,
          jwtSignature: 'valid.signature'
        }
      ]);

      // Mock signature verification
      jest.spyOn(pricingService, 'verifyPricingSignature').mockReturnValue(true);

      // Mock tampering log insertion
      mockPool.query.mockResolvedValue({ rows: [] });

      // Attempt purchase with wrong amount
      const result = await pricingService.validatePurchaseRequest('test-plan-1', 49.99, 'user-123');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Pricing data mismatch detected');
    });
  });

  describe('createOrUpdatePricing', () => {
    it('should create new pricing plan with JWT signature', async () => {
      const mockDbResult = {
        rows: [
          {
            plan_id: 'test-plan-1',
            plan_name: 'Test Plan',
            price_amount: '99.99',
            currency: 'INR',
            billing_cycle: 'monthly',
            features: '["Feature 1"]',
            limits: '{"emails": 1000}',
            is_popular: false,
            jwt_signature: 'generated.jwt.signature'
          }
        ]
      };

      mockPool.query.mockResolvedValue(mockDbResult);

      const result = await pricingService.createOrUpdatePricing(mockPricingData);

      expect(mockPool.query).toHaveBeenCalled();
      expect(result.planId).toBe('test-plan-1');
      expect(result.jwtSignature).toBe('generated.jwt.signature');
    });

    it('should handle database errors during creation', async () => {
      mockPool.query.mockRejectedValue(new Error('Database error'));

      await expect(pricingService.createOrUpdatePricing(mockPricingData))
        .rejects.toThrow('Pricing creation/update failed');
    });
  });

  describe('generatePricingHash and verifyPricingHash', () => {
    it('should generate and verify pricing hash correctly', () => {
      const planId = 'test-plan';
      const priceAmount = 99.99;
      const timestamp = Date.now();

      const hash = pricingService.generatePricingHash(planId, priceAmount, timestamp);
      const isValid = pricingService.verifyPricingHash(planId, priceAmount, timestamp, hash);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(isValid).toBe(true);
    });

    it('should reject invalid pricing hash', () => {
      const planId = 'test-plan';
      const priceAmount = 99.99;
      const timestamp = Date.now();

      const hash = pricingService.generatePricingHash(planId, priceAmount, timestamp);
      
      // Try to verify with different price
      const isValid = pricingService.verifyPricingHash(planId, 199.99, timestamp, hash);

      expect(isValid).toBe(false);
    });
  });

  describe('getTamperingStatistics', () => {
    it('should retrieve tampering statistics for specified timeframe', async () => {
      const mockDbResult = {
        rows: [
          {
            total_attempts: '5',
            unique_users: '3',
            avg_price_difference: '50.25',
            plan_attempts: [
              { planId: 'plan-1', attempts: 3 },
              { planId: 'plan-2', attempts: 2 }
            ]
          }
        ]
      };

      mockPool.query.mockResolvedValue(mockDbResult);

      const stats = await pricingService.getTamperingStatistics('day');

      expect(stats.totalAttempts).toBe(5);
      expect(stats.uniqueUsers).toBe(3);
      expect(stats.averagePriceDifference).toBe(50.25);
      expect(stats.topTargetedPlans).toHaveLength(2);
    });

    it('should handle empty statistics gracefully', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const stats = await pricingService.getTamperingStatistics('day');

      expect(stats.totalAttempts).toBe(0);
      expect(stats.uniqueUsers).toBe(0);
      expect(stats.averagePriceDifference).toBe(0);
      expect(stats.topTargetedPlans).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      mockPool.query.mockRejectedValue(new Error('Database error'));

      const stats = await pricingService.getTamperingStatistics('day');

      expect(stats.totalAttempts).toBe(0);
      expect(stats.uniqueUsers).toBe(0);
      expect(stats.averagePriceDifference).toBe(0);
      expect(stats.topTargetedPlans).toEqual([]);
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle floating point precision in price comparison', async () => {
      const mockDbResult = {
        rows: [
          {
            plan_id: 'test-plan-1',
            plan_name: 'Test Plan',
            price_amount: '99.99',
            currency: 'INR',
            billing_cycle: 'monthly',
            features: ['Feature 1'],
            limits: { emails: 1000 },
            is_popular: false,
            jwt_signature: 'valid.jwt.signature'
          }
        ]
      };

      mockPool.query.mockResolvedValue(mockDbResult);
      jest.spyOn(pricingService, 'verifyPricingSignature').mockReturnValue(true);

      // Test with slight floating point difference (should be valid)
      const result = await pricingService.validatePricing('test-plan-1', 99.989, 'INR');

      expect(result.isValid).toBe(true);
    });

    it('should be case-insensitive for currency comparison', async () => {
      const mockDbResult = {
        rows: [
          {
            plan_id: 'test-plan-1',
            plan_name: 'Test Plan',
            price_amount: '99.99',
            currency: 'INR',
            billing_cycle: 'monthly',
            features: ['Feature 1'],
            limits: { emails: 1000 },
            is_popular: false,
            jwt_signature: 'valid.jwt.signature'
          }
        ]
      };

      mockPool.query.mockResolvedValue(mockDbResult);
      jest.spyOn(pricingService, 'verifyPricingSignature').mockReturnValue(true);

      // Test with lowercase currency (should be valid)
      const result = await pricingService.validatePricing('test-plan-1', 99.99, 'inr');

      expect(result.isValid).toBe(true);
    });

    it('should handle malicious JWT tokens safely', () => {
      const maliciousTokens = [
        'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0..', // None algorithm
        'invalid.jwt.token',
        '',
        null,
        undefined
      ];

      maliciousTokens.forEach(token => {
        const isValid = pricingService.verifyPricingSignature(
          'test-plan',
          99.99,
          'INR',
          'monthly',
          token as any
        );
        expect(isValid).toBe(false);
      });
    });
  });
});