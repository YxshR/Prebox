import { PricingValidationService } from './pricing-validation.service';
import { SubscriptionTier } from '../shared/types';
import redisClient from '../config/redis';

// Mock dependencies
jest.mock('../security/pricing-protection.service');
jest.mock('../billing/subscription.service');
jest.mock('../config/redis');

describe('PricingValidationService', () => {
  let service: PricingValidationService;
  let mockRedisClient: jest.Mocked<typeof redisClient>;

  beforeEach(() => {
    service = new PricingValidationService();
    mockRedisClient = redisClient as jest.Mocked<typeof redisClient>;
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('getValidatedPricingPlans', () => {
    it('should return validated pricing plans', async () => {
      // Mock Redis cache miss
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setex.mockResolvedValue('OK');

      const plans = await service.getValidatedPricingPlans();

      expect(plans).toBeDefined();
      expect(Array.isArray(plans)).toBe(true);
      expect(plans.length).toBeGreaterThan(0);
      
      // Verify plan structure
      const freePlan = plans.find(p => p.tier === SubscriptionTier.FREE);
      expect(freePlan).toBeDefined();
      expect(freePlan?.priceInr).toBe(0);
      expect(freePlan?.currency).toBe('INR');
      expect(freePlan?.isActive).toBe(true);
    });

    it('should return cached plans when available', async () => {
      const cachedData = {
        plans: [{
          id: 'test-plan',
          tier: SubscriptionTier.FREE,
          name: 'Test Plan',
          description: 'Test Description',
          priceInr: 0,
          currency: 'INR',
          billingCycle: 'monthly' as const,
          limits: {},
          features: [],
          isPopular: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }],
        lastUpdated: new Date(),
        version: 'v1'
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedData));

      const plans = await service.getValidatedPricingPlans();

      expect(plans).toEqual(cachedData.plans);
      expect(mockRedisClient.get).toHaveBeenCalledWith('pricing:validated_plans');
    });

    it('should handle cache errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));
      mockRedisClient.setex.mockResolvedValue('OK');

      const plans = await service.getValidatedPricingPlans();

      expect(plans).toBeDefined();
      expect(Array.isArray(plans)).toBe(true);
    });
  });

  describe('validatePricingRequest', () => {
    it('should validate correct pricing request', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setex.mockResolvedValue('OK');

      const request = {
        planId: 'free-tier',
        amount: 0,
        currency: 'INR'
      };

      const result = await service.validatePricingRequest(request);

      expect(result.isValid).toBe(true);
      expect(result.validatedAmount).toBe(0);
      expect(result.validatedCurrency).toBe('INR');
      expect(result.plan).toBeDefined();
    });

    it('should reject invalid plan ID', async () => {
      const request = {
        planId: 'invalid-plan',
        amount: 100,
        currency: 'INR'
      };

      const result = await service.validatePricingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Pricing plan not found');
      expect(result.errorCode).toBe('PLAN_NOT_FOUND');
    });

    it('should reject incorrect amount', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setex.mockResolvedValue('OK');

      const request = {
        planId: 'free-tier',
        amount: 100, // Should be 0 for free tier
        currency: 'INR'
      };

      const result = await service.validatePricingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('INVALID_AMOUNT');
      expect(result.error).toContain('Invalid amount');
    });

    it('should reject invalid currency', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setex.mockResolvedValue('OK');

      const request = {
        planId: 'free-tier',
        amount: 0,
        currency: 'USD' // Should be INR
      };

      const result = await service.validatePricingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('INVALID_CURRENCY');
      expect(result.error).toContain('Invalid currency');
    });

    it('should handle service errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Service error'));

      const request = {
        planId: 'free-tier',
        amount: 0,
        currency: 'INR'
      };

      const result = await service.validatePricingRequest(request);

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('VALIDATION_SERVICE_ERROR');
    });
  });

  describe('getValidatedPricingPlan', () => {
    it('should return specific pricing plan', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setex.mockResolvedValue('OK');

      const plan = await service.getValidatedPricingPlan('free-tier');

      expect(plan).toBeDefined();
      expect(plan?.id).toBe('free-tier');
      expect(plan?.tier).toBe(SubscriptionTier.FREE);
    });

    it('should return null for non-existent plan', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setex.mockResolvedValue('OK');

      const plan = await service.getValidatedPricingPlan('non-existent-plan');

      expect(plan).toBeNull();
    });
  });

  describe('validatePurchaseRequest', () => {
    it('should validate correct purchase request', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setex.mockResolvedValue('OK');

      const result = await service.validatePurchaseRequest(
        'paid-standard-tier',
        59,
        'INR',
        'user-123',
        'tenant-123'
      );

      expect(result.isValid).toBe(true);
      expect(result.validatedAmount).toBe(59);
      expect(result.plan).toBeDefined();
    });

    it('should reject invalid purchase request', async () => {
      const result = await service.validatePurchaseRequest(
        'invalid-plan',
        100,
        'INR',
        'user-123',
        'tenant-123'
      );

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('PLAN_NOT_FOUND');
    });
  });

  describe('refreshPricingCache', () => {
    it('should refresh pricing cache successfully', async () => {
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.get.mockResolvedValue(null);
      mockRedisClient.setex.mockResolvedValue('OK');

      await expect(service.refreshPricingCache()).resolves.not.toThrow();

      expect(mockRedisClient.del).toHaveBeenCalledWith('pricing:validated_plans');
    });

    it('should handle cache refresh errors', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Redis error'));

      await expect(service.refreshPricingCache()).rejects.toThrow('Redis error');
    });
  });

  describe('getCacheStatistics', () => {
    it('should return cache statistics when cached', async () => {
      const cachedData = {
        plans: [],
        lastUpdated: new Date(),
        version: 'v1'
      };

      mockRedisClient.get.mockResolvedValue(JSON.stringify(cachedData));

      const stats = await service.getCacheStatistics();

      expect(stats.isCached).toBe(true);
      expect(stats.lastUpdated).toEqual(cachedData.lastUpdated);
      expect(stats.version).toBe('v1');
      expect(stats.planCount).toBe(0);
    });

    it('should return no cache statistics when not cached', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const stats = await service.getCacheStatistics();

      expect(stats.isCached).toBe(false);
      expect(stats.lastUpdated).toBeUndefined();
      expect(stats.version).toBeUndefined();
      expect(stats.planCount).toBeUndefined();
    });

    it('should handle cache statistics errors', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const stats = await service.getCacheStatistics();

      expect(stats.isCached).toBe(false);
    });
  });
});