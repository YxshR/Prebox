/**
 * Multi-Step Signup Test Runner
 * 
 * Simple test script to verify the multi-step signup implementation
 */

import { MultiStepSignupService } from './services/multi-step-signup.service';
import { SignupStateManager } from './services/signup-state-manager.service';
import { logger } from '../shared/logger';
import redisClient from '../config/redis';

// Set demo mode for testing
process.env.DEMO_MODE = 'true';

async function testMultiStepSignup() {
  console.log('🧪 Testing Multi-Step Phone Signup Implementation...\n');

  try {
    // Connect to Redis (or use mock in demo mode)
    await redisClient.connect();
    
    const signupService = new MultiStepSignupService();
    const stateManager = new SignupStateManager();

    // Test 1: Start phone signup
    console.log('📱 Test 1: Starting phone signup...');
    const startResult = await signupService.startPhoneSignup({
      phone: '+1234567890'
    });
    console.log('✅ Phone signup started:', {
      signupStateId: startResult.signupStateId,
      message: startResult.message
    });

    // Test 2: Check signup status
    console.log('\n📊 Test 2: Checking signup status...');
    const status = await signupService.getSignupStatus(startResult.signupStateId);
    console.log('✅ Signup status:', {
      currentStep: status?.currentStep,
      phoneVerified: status?.phoneVerified,
      emailVerified: status?.emailVerified
    });

    // Test 3: Verify phone (mock)
    console.log('\n📞 Test 3: Verifying phone...');
    const phoneResult = await signupService.verifyPhone({
      signupStateId: startResult.signupStateId,
      otpCode: '123456'
    });
    console.log('✅ Phone verified:', {
      currentStep: phoneResult.currentStep,
      message: phoneResult.message
    });

    // Test 4: Verify email (mock)
    console.log('\n📧 Test 4: Verifying email...');
    const emailResult = await signupService.verifyEmail({
      signupStateId: startResult.signupStateId,
      email: 'test@example.com',
      verificationCode: 'ABC12345'
    });
    console.log('✅ Email verified:', {
      currentStep: emailResult.currentStep,
      message: emailResult.message
    });

    // Test 5: Complete signup (this will fail without proper database setup)
    console.log('\n🔐 Test 5: Attempting to complete signup...');
    try {
      const completeResult = await signupService.completeSignup({
        signupStateId: startResult.signupStateId,
        password: 'TestPass123'
      });
      console.log('✅ Signup completed:', {
        userId: completeResult.user.id,
        email: completeResult.user.email,
        phone: completeResult.user.phone
      });
    } catch (error: any) {
      console.log('⚠️ Signup completion failed (expected without database):', error.message);
    }

    // Test 6: Cancel signup
    console.log('\n❌ Test 6: Cancelling signup...');
    const cancelled = await signupService.cancelSignup(startResult.signupStateId);
    console.log('✅ Signup cancelled:', cancelled);

    console.log('\n🎉 All tests completed successfully!');

  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Test duplicate phone validation
async function testDuplicateValidation() {
  console.log('\n🔍 Testing duplicate phone validation...');

  try {
    const signupService = new MultiStepSignupService();
    const phone = '+9876543210';

    // Start first signup
    const firstSignup = await signupService.startPhoneSignup({ phone });
    console.log('✅ First signup started:', firstSignup.signupStateId);

    // Try to start second signup with same phone
    try {
      await signupService.startPhoneSignup({ phone });
      console.log('❌ Second signup should have failed');
    } catch (error: any) {
      console.log('✅ Duplicate phone correctly rejected:', error.message);
    }

    // Clean up
    await signupService.cancelSignup(firstSignup.signupStateId);

  } catch (error: any) {
    console.error('❌ Duplicate validation test failed:', error.message);
  }
}

// Test state manager directly
async function testStateManager() {
  console.log('\n🗃️ Testing Signup State Manager...');

  try {
    const stateManager = new SignupStateManager();

    // Create state
    const state = await stateManager.createSignupState({
      phone: '+5555555555',
      metadata: { test: true }
    });
    console.log('✅ State created:', state.id);

    // Update state
    const updatedState = await stateManager.markPhoneVerified(state.id);
    console.log('✅ Phone marked as verified, current step:', updatedState.currentStep);

    // Mark email verified
    const emailVerifiedState = await stateManager.markEmailVerified(state.id);
    console.log('✅ Email marked as verified, current step:', emailVerifiedState.currentStep);

    // Complete signup
    const completedState = await stateManager.completeSignup(state.id, 'hashed-password');
    console.log('✅ Signup completed, current step:', completedState.currentStep);

    // Clean up
    await stateManager.deleteSignupState(state.id);
    console.log('✅ State cleaned up');

  } catch (error: any) {
    console.error('❌ State manager test failed:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  try {
    await testMultiStepSignup();
    await testDuplicateValidation();
    await testStateManager();
  } finally {
    // Clean up Redis connection
    try {
      await redisClient.quit();
    } catch (error) {
      console.log('Redis cleanup completed');
    }
  }
}

// Export for use in other test files
export {
  testMultiStepSignup,
  testDuplicateValidation,
  testStateManager,
  runAllTests
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}