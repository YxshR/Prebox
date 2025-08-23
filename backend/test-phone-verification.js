const { EnhancedPhoneVerificationService } = require('./dist/auth/enhanced-phone-verification.service');

async function testPhoneVerification() {
  try {
    console.log('🧪 Testing Enhanced Phone Verification Service...');
    
    const service = new EnhancedPhoneVerificationService({
      expiryMinutes: 10,
      maxAttempts: 5,
      rateLimitWindow: 60,
      maxOTPsPerWindow: 3,
      codeLength: 6,
      resendCooldown: 60
    });

    // Test phone check
    console.log('📱 Testing phone existence check...');
    const phoneCheck = await service.checkPhoneExists('+1234567890');
    console.log('Phone check result:', phoneCheck);

    // Test health status
    console.log('🏥 Testing health status...');
    const health = await service.getHealthStatus();
    console.log('Health status:', health);

    console.log('✅ Basic tests completed successfully!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testPhoneVerification();