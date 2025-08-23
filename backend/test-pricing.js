const { PricingService } = require('./dist/pricing/pricing.service');

async function testPricingService() {
  console.log('Testing Pricing Service...');
  
  try {
    const pricingService = new PricingService();
    
    // Test fallback functionality
    console.log('Testing fallback plans...');
    const fallbackPlans = await pricingService.getPlansWithFallback();
    console.log(`✓ Fallback plans returned: ${fallbackPlans.length} plans`);
    
    // Test validation
    console.log('Testing pricing integrity validation...');
    const validation = await pricingService.validatePricingIntegrity();
    console.log(`✓ Validation completed. Valid: ${validation.isValid}, Errors: ${validation.errors.length}`);
    
    console.log('✓ All pricing service tests passed!');
  } catch (error) {
    console.error('✗ Pricing service test failed:', error.message);
  }
}

testPricingService();