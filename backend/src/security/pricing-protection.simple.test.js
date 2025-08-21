// Simple test to verify pricing protection service functionality
const { PricingProtectionService } = require('./pricing-protection.service');

// Mock the database pool
jest.mock('../config/database', () => ({
  query: jest.fn()
}));

describe('PricingProtectionService - Simple Test', () => {
  let pricingService;

  beforeEach(() => {
    pricingService = new PricingProtectionService();
  });

  test('should generate JWT signature for pricing data', () => {
    const mockPricingData = {
      planId: 'test-plan-1',
      planName: 'Test Plan',
      priceAmount: 99.99,
      currency: 'INR',
      billingCycle: 'monthly',
      features: ['Feature 1', 'Feature 2'],
      limits: { emails: 1000, recipients: 5000 },
      isPopular: false
    };

    const signature = pricingService.signPricingData(mockPricingData);
    
    expect(signature).toBeDefined();
    expect(typeof signature).toBe('string');
    expect(signature.split('.')).toHaveLength(3); // JWT has 3 parts
  });

  test('should verify valid pricing signature', () => {
    const mockPricingData = {
      planId: 'test-plan-1',
      planName: 'Test Plan',
      priceAmount: 99.99,
      currency: 'INR',
      billingCycle: 'monthly',
      features: ['Feature 1', 'Feature 2'],
      limits: { emails: 1000, recipients: 5000 },
      isPopular: false
    };

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

  test('should reject invalid pricing signature', () => {
    const mockPricingData = {
      planId: 'test-plan-1',
      planName: 'Test Plan',
      priceAmount: 99.99,
      currency: 'INR',
      billingCycle: 'monthly',
      features: ['Feature 1', 'Feature 2'],
      limits: { emails: 1000, recipients: 5000 },
      isPopular: false
    };

    const signature = pricingService.signPricingData(mockPricingData);
    
    // Try to verify with different price amount (tampering attempt)
    const isValid = pricingService.verifyPricingSignature(
      mockPricingData.planId,
      199.99, // Different price
      mockPricingData.currency,
      mockPricingData.billingCycle,
      signature
    );
    
    expect(isValid).toBe(false);
  });

  test('should generate and verify pricing hash correctly', () => {
    const planId = 'test-plan';
    const priceAmount = 99.99;
    const timestamp = Date.now();

    const hash = pricingService.generatePricingHash(planId, priceAmount, timestamp);
    const isValid = pricingService.verifyPricingHash(planId, priceAmount, timestamp, hash);

    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(isValid).toBe(true);
  });

  test('should reject invalid pricing hash', () => {
    const planId = 'test-plan';
    const priceAmount = 99.99;
    const timestamp = Date.now();

    const hash = pricingService.generatePricingHash(planId, priceAmount, timestamp);
    
    // Try to verify with different price
    const isValid = pricingService.verifyPricingHash(planId, 199.99, timestamp, hash);

    expect(isValid).toBe(false);
  });
});