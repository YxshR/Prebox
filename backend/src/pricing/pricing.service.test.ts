import { PricingService, CreatePricingPlanRequest, UpdatePricingPlanRequest } from './pricing.service';
import pool from '../config/database';
import redisClient from '../config/redis';

// Mock dependencies
jest.mock('../config/database');
jest.mock('../config/redis');
jest.mock('../shared/logger');

const mockPool = pool as jest.Mocked<typeof pool>;
const mockRedis = redisClient as jest.Mocked<typeof redisClient>;

describe('PricingService', () => {
  let pricingService: PricingService;
  let mockClient: any;

  beforeEach(() => {
    pricingService = new PricingService();
    
    // Mock database client
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    
    mockPool.connect = jest.fn().mockResolvedValue(mockClient);
    
    // Mock Redis
    mockRedis.get = jest.fn();
    mockRedis.setex = jest.fn();
    mockRedis.del = jest.fn();
    
    jest.clearAllMocks();
  });

  describe('getAllPlans', () => {
    it('should return cached plans when available', async () => {
      const cachedPlans = [
        {
          id: '1',
          name: 'Free',
          price: 0,
          currency: 'USD',
          features: ['Basic'],
          limits: { emails: 100 },
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockRedis.get.mockResolvedValue(JSON.stringify(cachedPlans));

      const result = await pricingService.getAllPlans();

      expect(result).toEqual(cachedPlans);
      expect(mockRedis.get).toHaveBeenCalledWith('pricing:plans');
      expect(mockPool.connect).not.toHaveBeenCalled();
    });

    it('should fetch from database when cache is empty', async () => {
      const dbPlans = [
        {
          id: '1',
          name: 'Free',
          price: 0,
          currency: 'USD',
          features: ['Basic'],
          limits: { emails: 100 },
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockRedis.get.mockResolvedValue(null);
      mockClient.query.mockResolvedValue({ rows: dbPlans });
      mockRedis.setex.mockResolvedValue('OK');

      const result = await pricingService.getAllPlans();

      expect(result).toEqual(dbPlans);
      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
      expect(mockRedis.setex).toHaveBeenCalledWith('pricing:plans', 300, JSON.stringify(dbPlans));
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPool.connect.mockRejectedValue(new Error('Database connection failed'));

      await expect(pricingService.getAllPlans()).rejects.toThrow('Failed to retrieve pricing plans from database');
    });

    it('should handle malformed cached data', async () => {
      const dbPlans = [
        {
          id: '1',
          name: 'Free',
          price: 0,
          currency: 'USD',
          features: 'invalid', // Should be array
          limits: 'invalid', // Should be object
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockRedis.get.mockResolvedValue(null);
      mockClient.query.mockResolvedValue({ rows: dbPlans });

      const result = await pricingService.getAllPlans();

      expect(result[0].features).toEqual([]);
      expect(result[0].limits).toEqual({});
    });
  });

  describe('getPlanById', () => {
    it('should return plan when found', async () => {
      const plan = {
        id: '1',
        name: 'Free',
        price: 0,
        currency: 'USD',
        features: ['Basic'],
        limits: { emails: 100 },
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockClient.query.mockResolvedValue({ rows: [plan] });

      const result = await pricingService.getPlanById('1');

      expect(result).toEqual(plan);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = $1'),
        ['1']
      );
    });

    it('should return null when plan not found', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      const result = await pricingService.getPlanById('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockPool.connect.mockRejectedValue(new Error('Database error'));

      await expect(pricingService.getPlanById('1')).rejects.toThrow('Failed to retrieve pricing plan from database');
    });
  });

  describe('createPlan', () => {
    it('should create plan successfully', async () => {
      const planData: CreatePricingPlanRequest = {
        name: 'Test Plan',
        price: 29.99,
        currency: 'USD',
        features: ['Feature 1', 'Feature 2'],
        limits: { emails: 1000 },
        active: true
      };

      const createdPlan = {
        id: '1',
        ...planData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockClient.query.mockResolvedValue({ rows: [createdPlan] });
      mockRedis.del.mockResolvedValue(1);

      const result = await pricingService.createPlan(planData);

      expect(result).toEqual(createdPlan);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pricing_plans'),
        [
          planData.name,
          planData.price,
          planData.currency,
          JSON.stringify(planData.features),
          JSON.stringify(planData.limits),
          planData.active
        ]
      );
      expect(mockRedis.del).toHaveBeenCalledWith('pricing:plans');
    });

    it('should use default values for optional fields', async () => {
      const planData: CreatePricingPlanRequest = {
        name: 'Test Plan',
        price: 29.99,
        features: ['Feature 1'],
        limits: { emails: 1000 }
      };

      const createdPlan = {
        id: '1',
        ...planData,
        currency: 'USD',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockClient.query.mockResolvedValue({ rows: [createdPlan] });

      await pricingService.createPlan(planData);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO pricing_plans'),
        [
          planData.name,
          planData.price,
          'USD', // Default currency
          JSON.stringify(planData.features),
          JSON.stringify(planData.limits),
          true // Default active
        ]
      );
    });

    it('should handle database errors', async () => {
      const planData: CreatePricingPlanRequest = {
        name: 'Test Plan',
        price: 29.99,
        features: ['Feature 1'],
        limits: { emails: 1000 }
      };

      mockPool.connect.mockRejectedValue(new Error('Database error'));

      await expect(pricingService.createPlan(planData)).rejects.toThrow('Failed to create pricing plan in database');
    });
  });

  describe('updatePlan', () => {
    it('should update plan successfully', async () => {
      const updateData: UpdatePricingPlanRequest = {
        name: 'Updated Plan',
        price: 39.99
      };

      const updatedPlan = {
        id: '1',
        name: 'Updated Plan',
        price: 39.99,
        currency: 'USD',
        features: ['Feature 1'],
        limits: { emails: 1000 },
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockClient.query.mockResolvedValue({ rows: [updatedPlan] });
      mockRedis.del.mockResolvedValue(1);

      const result = await pricingService.updatePlan('1', updateData);

      expect(result).toEqual(updatedPlan);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pricing_plans'),
        expect.arrayContaining(['Updated Plan', 39.99, '1'])
      );
      expect(mockRedis.del).toHaveBeenCalledWith('pricing:plans');
    });

    it('should return null when plan not found', async () => {
      const updateData: UpdatePricingPlanRequest = {
        name: 'Updated Plan'
      };

      mockClient.query.mockResolvedValue({ rows: [] });

      const result = await pricingService.updatePlan('nonexistent', updateData);

      expect(result).toBeNull();
    });

    it('should throw error when no fields to update', async () => {
      await expect(pricingService.updatePlan('1', {})).rejects.toThrow('No fields to update');
    });

    it('should handle database errors', async () => {
      const updateData: UpdatePricingPlanRequest = {
        name: 'Updated Plan'
      };

      mockPool.connect.mockRejectedValue(new Error('Database error'));

      await expect(pricingService.updatePlan('1', updateData)).rejects.toThrow('Failed to update pricing plan in database');
    });
  });

  describe('deletePlan', () => {
    it('should delete plan successfully (soft delete)', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 1 });
      mockRedis.del.mockResolvedValue(1);

      const result = await pricingService.deletePlan('1');

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pricing_plans SET active = false'),
        ['1']
      );
      expect(mockRedis.del).toHaveBeenCalledWith('pricing:plans');
    });

    it('should return false when plan not found', async () => {
      mockClient.query.mockResolvedValue({ rowCount: 0 });

      const result = await pricingService.deletePlan('nonexistent');

      expect(result).toBe(false);
    });

    it('should handle database errors', async () => {
      mockPool.connect.mockRejectedValue(new Error('Database error'));

      await expect(pricingService.deletePlan('1')).rejects.toThrow('Failed to delete pricing plan from database');
    });
  });

  describe('getPlansWithFallback', () => {
    it('should return database plans when available', async () => {
      const dbPlans = [
        {
          id: '1',
          name: 'Free',
          price: 0,
          currency: 'USD',
          features: ['Basic'],
          limits: { emails: 100 },
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockRedis.get.mockResolvedValue(null);
      mockClient.query.mockResolvedValue({ rows: dbPlans });

      const result = await pricingService.getPlansWithFallback();

      expect(result).toEqual(dbPlans);
    });

    it('should return fallback plans when database fails', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockPool.connect.mockRejectedValue(new Error('Database error'));

      const result = await pricingService.getPlansWithFallback();

      expect(result).toHaveLength(3); // Fallback plans
      expect(result[0].id).toBe('fallback-free');
      expect(result[1].id).toBe('fallback-starter');
      expect(result[2].id).toBe('fallback-pro');
    });
  });

  describe('validatePricingIntegrity', () => {
    it('should validate pricing data successfully', async () => {
      const validPlans = [
        {
          id: '1',
          name: 'Free',
          price: 0,
          currency: 'USD',
          features: ['Basic'],
          limits: { emails: 100 }
        },
        {
          id: '2',
          name: 'Pro',
          price: 29.99,
          currency: 'USD',
          features: ['Advanced'],
          limits: { emails: 1000 }
        }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: validPlans }) // Main validation query
        .mockResolvedValueOnce({ rows: [] }); // Duplicate name check

      const result = await pricingService.validatePricingIntegrity();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.planCount).toBe(2);
    });

    it('should detect invalid pricing data', async () => {
      const invalidPlans = [
        {
          id: '1',
          name: '', // Invalid name
          price: -10, // Invalid price
          currency: 'INVALID', // Invalid currency
          features: 'not-array', // Invalid features
          limits: null // Invalid limits
        }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: invalidPlans })
        .mockResolvedValueOnce({ rows: [] });

      const result = await pricingService.validatePricingIntegrity();

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors).toContain('Plan 1: Invalid price -10');
      expect(result.errors).toContain('Plan 1: Invalid currency INVALID');
      expect(result.errors).toContain('Plan 1: Features must be an array');
      expect(result.errors).toContain('Plan 1: Limits must be an object');
      expect(result.errors).toContain('Plan 1: Name is required');
    });

    it('should detect duplicate plan names', async () => {
      const plansWithDuplicates = [
        {
          id: '1',
          name: 'Pro',
          price: 29.99,
          currency: 'USD',
          features: ['Advanced'],
          limits: { emails: 1000 }
        }
      ];

      const duplicateNames = [
        { name: 'Pro', count: 2 }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: plansWithDuplicates })
        .mockResolvedValueOnce({ rows: duplicateNames });

      const result = await pricingService.validatePricingIntegrity();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Duplicate plan name: Pro');
    });

    it('should handle database errors during validation', async () => {
      mockPool.connect.mockRejectedValue(new Error('Database error'));

      const result = await pricingService.validatePricingIntegrity();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Database validation failed: Database error');
    });
  });

  describe('seedDefaultPlans', () => {
    it('should seed default plans when none exist', async () => {
      // Mock empty plans check
      mockRedis.get.mockResolvedValue(null);
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // Empty plans check
        .mockResolvedValue({ rows: [{ id: '1', name: 'Free' }] }); // Create plan responses

      await pricingService.seedDefaultPlans();

      expect(mockClient.query).toHaveBeenCalledTimes(5); // 1 check + 4 creates
    });

    it('should skip seeding when plans already exist', async () => {
      const existingPlans = [
        {
          id: '1',
          name: 'Existing',
          price: 0,
          currency: 'USD',
          features: [],
          limits: {},
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockRedis.get.mockResolvedValue(JSON.stringify(existingPlans));

      await pricingService.seedDefaultPlans();

      // Should only call getAllPlans, not create any plans
      expect(mockClient.query).not.toHaveBeenCalled();
    });

    it('should handle errors during seeding', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // Empty check
      mockPool.connect.mockRejectedValue(new Error('Database error'));

      await expect(pricingService.seedDefaultPlans()).rejects.toThrow();
    });
  });
});