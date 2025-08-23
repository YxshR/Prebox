import request from 'supertest';
import express from 'express';
import pricingRoutes from './pricing.routes';
import { PricingService } from './pricing.service';
import pool from '../config/database';
import redisClient from '../config/redis';

// Mock dependencies
jest.mock('./pricing.service');
jest.mock('../config/database');
jest.mock('../config/redis');
jest.mock('../auth/auth.middleware');

const MockPricingService = PricingService as jest.MockedClass<typeof PricingService>;

describe('Pricing API Integration Tests', () => {
  let app: express.Application;
  let mockPricingService: jest.Mocked<PricingService>;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock auth middleware to simulate authenticated admin user
    app.use((req: any, res, next) => {
      req.user = {
        userId: 'admin-user-id',
        role: 'admin',
        tenantId: 'admin-tenant'
      };
      next();
    });
    
    app.use('/api/pricing', pricingRoutes);

    // Setup mocked service
    mockPricingService = {
      getAllPlans: jest.fn(),
      getPlanById: jest.fn(),
      createPlan: jest.fn(),
      updatePlan: jest.fn(),
      deletePlan: jest.fn(),
      getPlansWithFallback: jest.fn(),
      validatePricingIntegrity: jest.fn(),
      seedDefaultPlans: jest.fn()
    } as any;

    MockPricingService.mockImplementation(() => mockPricingService);

    jest.clearAllMocks();
  });

  describe('GET /api/pricing/plans', () => {
    it('should return all pricing plans successfully', async () => {
      const mockPlans = [
        {
          id: '1',
          name: 'Free',
          price: 0,
          currency: 'USD',
          features: ['Basic email sending'],
          limits: { emailsPerMonth: 1000 },
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: '2',
          name: 'Pro',
          price: 29.99,
          currency: 'USD',
          features: ['Advanced features'],
          limits: { emailsPerMonth: 10000 },
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockPricingService.getPlansWithFallback.mockResolvedValue(mockPlans);

      const response = await request(app)
        .get('/api/pricing/plans')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plans).toEqual(mockPlans);
      expect(response.body.data.count).toBe(2);
      expect(response.body.data.timestamp).toBeDefined();
    });

    it('should handle service errors gracefully', async () => {
      mockPricingService.getPlansWithFallback.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
        .get('/api/pricing/plans')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PRICING_SERVICE_ERROR');
    });

    it('should respect rate limiting', async () => {
      mockPricingService.getPlansWithFallback.mockResolvedValue([]);

      // Make multiple requests to test rate limiting
      const requests = Array.from({ length: 5 }, () =>
        request(app).get('/api/pricing/plans')
      );

      const responses = await Promise.all(requests);
      
      // All should succeed within rate limit
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('GET /api/pricing/plans/:id', () => {
    it('should return specific pricing plan', async () => {
      const mockPlan = {
        id: '1',
        name: 'Free',
        price: 0,
        currency: 'USD',
        features: ['Basic email sending'],
        limits: { emailsPerMonth: 1000 },
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPricingService.getPlanById.mockResolvedValue(mockPlan);

      const response = await request(app)
        .get('/api/pricing/plans/550e8400-e29b-41d4-a716-446655440000')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plan).toEqual(mockPlan);
    });

    it('should return 404 when plan not found', async () => {
      mockPricingService.getPlanById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/pricing/plans/550e8400-e29b-41d4-a716-446655440000')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PLAN_NOT_FOUND');
    });

    it('should validate UUID format', async () => {
      const response = await request(app)
        .get('/api/pricing/plans/invalid-uuid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/pricing/plans', () => {
    it('should create new pricing plan successfully', async () => {
      const planData = {
        name: 'Test Plan',
        price: 49.99,
        currency: 'USD',
        features: ['Feature 1', 'Feature 2'],
        limits: { emailsPerMonth: 5000 },
        active: true
      };

      const createdPlan = {
        id: '1',
        ...planData,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPricingService.createPlan.mockResolvedValue(createdPlan);

      const response = await request(app)
        .post('/api/pricing/plans')
        .send(planData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plan).toEqual(createdPlan);
      expect(mockPricingService.createPlan).toHaveBeenCalledWith(planData);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        // Missing name
        price: 49.99,
        features: ['Feature 1'],
        limits: { emailsPerMonth: 5000 }
      };

      const response = await request(app)
        .post('/api/pricing/plans')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate price is positive', async () => {
      const invalidData = {
        name: 'Test Plan',
        price: -10, // Invalid negative price
        features: ['Feature 1'],
        limits: { emailsPerMonth: 5000 }
      };

      const response = await request(app)
        .post('/api/pricing/plans')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate features is array', async () => {
      const invalidData = {
        name: 'Test Plan',
        price: 49.99,
        features: 'not-an-array', // Invalid
        limits: { emailsPerMonth: 5000 }
      };

      const response = await request(app)
        .post('/api/pricing/plans')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle service errors', async () => {
      const planData = {
        name: 'Test Plan',
        price: 49.99,
        features: ['Feature 1'],
        limits: { emailsPerMonth: 5000 }
      };

      mockPricingService.createPlan.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/pricing/plans')
        .send(planData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PRICING_CREATE_ERROR');
    });
  });

  describe('PUT /api/pricing/plans/:id', () => {
    it('should update pricing plan successfully', async () => {
      const updateData = {
        name: 'Updated Plan',
        price: 59.99
      };

      const updatedPlan = {
        id: '1',
        name: 'Updated Plan',
        price: 59.99,
        currency: 'USD',
        features: ['Feature 1'],
        limits: { emailsPerMonth: 5000 },
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPricingService.updatePlan.mockResolvedValue(updatedPlan);

      const response = await request(app)
        .put('/api/pricing/plans/550e8400-e29b-41d4-a716-446655440000')
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plan).toEqual(updatedPlan);
      expect(mockPricingService.updatePlan).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        updateData
      );
    });

    it('should return 404 when plan not found', async () => {
      mockPricingService.updatePlan.mockResolvedValue(null);

      const response = await request(app)
        .put('/api/pricing/plans/550e8400-e29b-41d4-a716-446655440000')
        .send({ name: 'Updated Plan' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PLAN_NOT_FOUND');
    });

    it('should validate UUID format', async () => {
      const response = await request(app)
        .put('/api/pricing/plans/invalid-uuid')
        .send({ name: 'Updated Plan' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/pricing/plans/:id', () => {
    it('should delete pricing plan successfully', async () => {
      mockPricingService.deletePlan.mockResolvedValue(true);

      const response = await request(app)
        .delete('/api/pricing/plans/550e8400-e29b-41d4-a716-446655440000')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Pricing plan deleted successfully');
      expect(mockPricingService.deletePlan).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000'
      );
    });

    it('should return 404 when plan not found', async () => {
      mockPricingService.deletePlan.mockResolvedValue(false);

      const response = await request(app)
        .delete('/api/pricing/plans/550e8400-e29b-41d4-a716-446655440000')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PLAN_NOT_FOUND');
    });
  });

  describe('POST /api/pricing/seed', () => {
    it('should seed default plans successfully', async () => {
      mockPricingService.seedDefaultPlans.mockResolvedValue();

      const response = await request(app)
        .post('/api/pricing/seed')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Default pricing plans seeded successfully');
      expect(mockPricingService.seedDefaultPlans).toHaveBeenCalled();
    });

    it('should handle seeding errors', async () => {
      mockPricingService.seedDefaultPlans.mockRejectedValue(new Error('Seeding failed'));

      const response = await request(app)
        .post('/api/pricing/seed')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PRICING_SEED_ERROR');
    });
  });

  describe('GET /api/pricing/validate', () => {
    it('should validate pricing integrity successfully', async () => {
      const validationResult = {
        isValid: true,
        errors: [],
        planCount: 4
      };

      mockPricingService.validatePricingIntegrity.mockResolvedValue(validationResult);

      const response = await request(app)
        .get('/api/pricing/validate')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.validation).toEqual(validationResult);
    });

    it('should return validation errors when integrity fails', async () => {
      const validationResult = {
        isValid: false,
        errors: ['Plan 1: Invalid price', 'Plan 2: Missing name'],
        planCount: 2
      };

      mockPricingService.validatePricingIntegrity.mockResolvedValue(validationResult);

      const response = await request(app)
        .get('/api/pricing/validate')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.data.validation).toEqual(validationResult);
    });
  });

  describe('GET /api/pricing/health', () => {
    it('should return healthy status when service is working', async () => {
      const validationResult = {
        isValid: true,
        errors: [],
        planCount: 4
      };

      mockPricingService.getAllPlans.mockResolvedValue([]);
      mockPricingService.validatePricingIntegrity.mockResolvedValue(validationResult);

      const response = await request(app)
        .get('/api/pricing/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.service).toBe('pricing');
    });

    it('should return degraded status when validation fails', async () => {
      const validationResult = {
        isValid: false,
        errors: ['Some error'],
        planCount: 1
      };

      mockPricingService.getAllPlans.mockResolvedValue([]);
      mockPricingService.validatePricingIntegrity.mockResolvedValue(validationResult);

      const response = await request(app)
        .get('/api/pricing/health')
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.data.status).toBe('degraded');
    });

    it('should return unhealthy status when service fails', async () => {
      mockPricingService.getAllPlans.mockRejectedValue(new Error('Service down'));

      const response = await request(app)
        .get('/api/pricing/health')
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.data.status).toBe('unhealthy');
    });
  });

  describe('Authorization', () => {
    beforeEach(() => {
      // Reset app with non-admin user
      app = express();
      app.use(express.json());
      
      app.use((req: any, res, next) => {
        req.user = {
          userId: 'regular-user-id',
          role: 'user', // Non-admin role
          tenantId: 'user-tenant'
        };
        next();
      });
      
      app.use('/api/pricing', pricingRoutes);
    });

    it('should deny access to admin endpoints for non-admin users', async () => {
      const planData = {
        name: 'Test Plan',
        price: 49.99,
        features: ['Feature 1'],
        limits: { emailsPerMonth: 5000 }
      };

      const response = await request(app)
        .post('/api/pricing/plans')
        .send(planData)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('should allow access to public endpoints for non-admin users', async () => {
      mockPricingService.getPlansWithFallback.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/pricing/plans')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app)
        .post('/api/pricing/plans')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      // Express should handle malformed JSON before reaching our routes
    });

    it('should handle missing request body', async () => {
      const response = await request(app)
        .post('/api/pricing/plans')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle very large request bodies', async () => {
      const largeFeatures = Array.from({ length: 1000 }, (_, i) => `Feature ${i}`);
      
      const planData = {
        name: 'Test Plan',
        price: 49.99,
        features: largeFeatures,
        limits: { emailsPerMonth: 5000 }
      };

      mockPricingService.createPlan.mockResolvedValue({
        id: '1',
        ...planData,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const response = await request(app)
        .post('/api/pricing/plans')
        .send(planData)
        .expect(201);

      expect(response.body.success).toBe(true);
    });
  });
});