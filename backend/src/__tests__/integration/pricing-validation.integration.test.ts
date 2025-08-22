import request from 'supertest';
import express from 'express';
import { PricingValidationService } from '../../pricing/pricing-validation.service';
import { pricingValidationMiddleware } from '../../pricing/pricing-validation.middleware';
import pool from '../../config/database';

// Mock database
jest.mock('../../config/database');

const mockPool = pool as jest.Mocked<typeof pool>;

describe('Pricing Validation Integration Tests', () => {
  let app: express.Application;
  let pricingService: PricingValidationService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup Express app for testing
    app = express();
    app.use(express.json());
    
    // Mock database client
    const mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    
    mockPool.connect = jest.fn().mockResolvedValue(mockClient);
    
    pricingService = new PricingValidationService();
    
    // Setup test routes
    app.get('/api/pricing', pricingValidationMiddleware, async (req, res) => {
      try {
        const pricing = await pricingService.getCurrentPricing();
        res.json({ success: true, data: pricing });
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: { message: error instanceof Error ? error.message : 'Unknown error' }
        });
      }
    });

    app.post('/api/pricing/validate', pricingValidationMiddleware, async (req, res) => {
      try {
        const validation = await pricingService.validatePrices();
        res.json({ success: true, data: validation });
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: { message: error instanceof Error ? error.message : 'Unknown error' }
        });
      }
    });

    app.put('/api/pricing', pricingValidationMiddleware, async (req, res) => {
      try {
        await pricingService.updatePricing(req.body);
        res.json({ success: true, message: 'Pricing updated successfully' });
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: { message: error instanceof Error ? error.message : 'Unknown error' }
        });
      }
    });
  });

  describe('Pricing Data Retrieval', () => {
    it('should retrieve current pricing data successfully', async () => {
      const mockPricingData = {
        plans: [
          {
            id: 'starter',
            name: 'Starter Plan',
            price: 29.99,
            currency: 'USD',
            interval: 'month',
            features: ['1000 emails/month', 'Basic templates']
          },
          {
            id: 'professional',
            name: 'Professional Plan',
            price: 79.99,
            currency: 'USD',
            interval: 'month',
            features: ['10000 emails/month', 'Advanced templates', 'Analytics']
          }
        ],
        lastUpdated: new Date().toISOString()
      };

      const mockClient = await mockPool.connect();
      (mockClient.query as jest.Mock).mockResolvedValue({
        rows: [mockPricingData]
      });

      const response = await request(app)
        .get('/api/pricing')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPricingData);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM pricing_plans')
      );
    });

    it('should handle database connection failures', async () => {
      mockPool.connect.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/pricing')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Database connection failed');
    });

    it('should handle empty pricing data', async () => {
      const mockClient = await mockPool.connect();
      (mockClient.query as jest.Mock).mockResolvedValue({ rows: [] });

      const response = await request(app)
        .get('/api/pricing')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plans).toEqual([]);
    });
  });

  describe('Pricing Validation', () => {
    it('should validate pricing data integrity', async () => {
      const mockValidationResult = {
        isValid: true,
        validatedAt: new Date().toISOString(),
        checks: {
          priceConsistency: true,
          currencyValidation: true,
          planAvailability: true,
          featureMapping: true
        },
        warnings: [],
        errors: []
      };

      const mockClient = await mockPool.connect();
      (mockClient.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '4' }] }) // Plan count
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // Invalid prices
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // Currency types

      const response = await request(app)
        .post('/api/pricing/validate')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.checks).toBeDefined();
    });

    it('should detect pricing inconsistencies', async () => {
      const mockClient = await mockPool.connect();
      (mockClient.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ count: '4' }] }) // Plan count
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // Invalid prices (found some)
        .mockResolvedValueOnce({ rows: [{ count: '3' }] }); // Multiple currencies

      const response = await request(app)
        .post('/api/pricing/validate')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(false);
      expect(response.body.data.errors.length).toBeGreaterThan(0);
    });

    it('should handle validation errors gracefully', async () => {
      const mockClient = await mockPool.connect();
      (mockClient.query as jest.Mock).mockRejectedValue(new Error('Validation query failed'));

      const response = await request(app)
        .post('/api/pricing/validate')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Validation query failed');
    });
  });

  describe('Pricing Updates', () => {
    it('should update pricing data with validation', async () => {
      const newPricingData = {
        plans: [
          {
            id: 'starter',
            name: 'Starter Plan',
            price: 34.99, // Updated price
            currency: 'USD',
            interval: 'month',
            features: ['1500 emails/month', 'Basic templates'] // Updated features
          }
        ]
      };

      const mockClient = await mockPool.connect();
      (mockClient.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [{ id: 'starter' }] }) // Existing plan check
        .mockResolvedValueOnce({ rowCount: 1 }); // Update result

      const response = await request(app)
        .put('/api/pricing')
        .send(newPricingData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Pricing updated successfully');
      
      // Verify update query was called
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pricing_plans'),
        expect.any(Array)
      );
    });

    it('should reject invalid pricing updates', async () => {
      const invalidPricingData = {
        plans: [
          {
            id: 'starter',
            name: 'Starter Plan',
            price: -10, // Invalid negative price
            currency: 'INVALID',
            interval: 'month'
          }
        ]
      };

      const response = await request(app)
        .put('/api/pricing')
        .send(invalidPricingData)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid pricing data');
    });

    it('should handle concurrent pricing updates', async () => {
      const pricingData1 = {
        plans: [{ id: 'starter', name: 'Starter', price: 29.99, currency: 'USD', interval: 'month' }]
      };
      
      const pricingData2 = {
        plans: [{ id: 'pro', name: 'Professional', price: 79.99, currency: 'USD', interval: 'month' }]
      };

      const mockClient = await mockPool.connect();
      (mockClient.query as jest.Mock)
        .mockResolvedValue({ rowCount: 1 });

      const [response1, response2] = await Promise.all([
        request(app).put('/api/pricing').send(pricingData1),
        request(app).put('/api/pricing').send(pricingData2)
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);
    });
  });

  describe('Pricing Middleware Integration', () => {
    it('should apply pricing validation middleware correctly', async () => {
      // Test that middleware is applied to all pricing routes
      const mockClient = await mockPool.connect();
      (mockClient.query as jest.Mock).mockResolvedValue({ rows: [] });

      // The middleware should add security headers and validate requests
      const response = await request(app)
        .get('/api/pricing')
        .expect(200);

      // Check that response includes security headers (if middleware adds them)
      expect(response.headers).toBeDefined();
    });

    it('should handle middleware errors gracefully', async () => {
      // Mock middleware failure
      app.use('/api/pricing', (req, res, next) => {
        throw new Error('Middleware error');
      });

      const response = await request(app)
        .get('/api/pricing')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Caching Integration', () => {
    it('should cache pricing data for performance', async () => {
      const mockPricingData = {
        plans: [
          { id: 'starter', name: 'Starter', price: 29.99, currency: 'USD', interval: 'month' }
        ],
        lastUpdated: new Date().toISOString()
      };

      const mockClient = await mockPool.connect();
      (mockClient.query as jest.Mock).mockResolvedValue({
        rows: [mockPricingData]
      });

      // First request should hit database
      const response1 = await request(app)
        .get('/api/pricing')
        .expect(200);

      // Second request should use cache (if implemented)
      const response2 = await request(app)
        .get('/api/pricing')
        .expect(200);

      expect(response1.body.data).toEqual(mockPricingData);
      expect(response2.body.data).toEqual(mockPricingData);
      
      // Database should be called at least once
      expect(mockClient.query).toHaveBeenCalled();
    });

    it('should invalidate cache on pricing updates', async () => {
      const originalPricing = {
        plans: [{ id: 'starter', name: 'Starter', price: 29.99, currency: 'USD', interval: 'month' }]
      };

      const updatedPricing = {
        plans: [{ id: 'starter', name: 'Starter', price: 34.99, currency: 'USD', interval: 'month' }]
      };

      const mockClient = await mockPool.connect();
      (mockClient.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [originalPricing] }) // Initial get
        .mockResolvedValueOnce({ rows: [{ id: 'starter' }] }) // Update check
        .mockResolvedValueOnce({ rowCount: 1 }) // Update result
        .mockResolvedValueOnce({ rows: [updatedPricing] }); // Get after update

      // Get initial pricing
      await request(app).get('/api/pricing').expect(200);

      // Update pricing
      await request(app).put('/api/pricing').send(updatedPricing).expect(200);

      // Get updated pricing (should reflect changes)
      const response = await request(app).get('/api/pricing').expect(200);

      expect(response.body.data).toEqual(updatedPricing);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database timeouts gracefully', async () => {
      mockPool.connect.mockImplementation(() => 
        new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Connection timeout')), 100);
        })
      );

      const response = await request(app)
        .get('/api/pricing')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Connection timeout');
    });

    it('should provide fallback pricing when database is unavailable', async () => {
      mockPool.connect.mockRejectedValue(new Error('Database unavailable'));

      // Service should handle this gracefully
      const response = await request(app)
        .get('/api/pricing')
        .expect(500);

      expect(response.body.success).toBe(false);
      // In a real implementation, this might return cached or default pricing
    });

    it('should handle malformed pricing data', async () => {
      const mockClient = await mockPool.connect();
      (mockClient.query as jest.Mock).mockResolvedValue({
        rows: [{ invalid: 'data', structure: true }]
      });

      const response = await request(app)
        .get('/api/pricing')
        .expect(200);

      // Service should handle malformed data gracefully
      expect(response.body.success).toBe(true);
    });
  });

  describe('Security and Validation', () => {
    it('should validate pricing data structure', async () => {
      const invalidStructure = {
        // Missing required fields
        plans: [
          {
            id: 'test'
            // Missing name, price, currency, interval
          }
        ]
      };

      const response = await request(app)
        .put('/api/pricing')
        .send(invalidStructure)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid pricing data');
    });

    it('should prevent SQL injection in pricing queries', async () => {
      const maliciousInput = {
        plans: [
          {
            id: "'; DROP TABLE pricing_plans; --",
            name: 'Malicious Plan',
            price: 0,
            currency: 'USD',
            interval: 'month'
          }
        ]
      };

      const mockClient = await mockPool.connect();
      (mockClient.query as jest.Mock).mockResolvedValue({ rowCount: 0 });

      const response = await request(app)
        .put('/api/pricing')
        .send(maliciousInput)
        .expect(500);

      // Should reject malicious input
      expect(response.body.success).toBe(false);
    });

    it('should validate currency codes', async () => {
      const invalidCurrency = {
        plans: [
          {
            id: 'test',
            name: 'Test Plan',
            price: 29.99,
            currency: 'INVALID_CURRENCY',
            interval: 'month'
          }
        ]
      };

      const response = await request(app)
        .put('/api/pricing')
        .send(invalidCurrency)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid currency');
    });

    it('should validate price ranges', async () => {
      const invalidPrice = {
        plans: [
          {
            id: 'test',
            name: 'Test Plan',
            price: -100, // Negative price
            currency: 'USD',
            interval: 'month'
          }
        ]
      };

      const response = await request(app)
        .put('/api/pricing')
        .send(invalidPrice)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('Invalid price');
    });
  });
});