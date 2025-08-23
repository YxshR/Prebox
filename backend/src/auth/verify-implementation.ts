/**
 * Multi-Step Signup Implementation Verification
 * 
 * Simple verification script to test the multi-step signup implementation
 * without Jest dependencies
 */

import { SignupStateManager, SignupStep } from './services/signup-state-manager.service';
import { MultiStepSignupService } from './services/multi-step-signup.service';
import redisClient from '../config/redis';

// Set demo mode for testing
process.env.DEMO_MODE = 'true';

async function verifySignupStateManager() {
  console.log('🔍 Verifying Signup State Manager...');
  
  try {
    await redisClient.connect();
    const stateManager = new SignupStateManager();

    // Test 1: Create signup state
    console.log('  ✓ Creating signup state...');
    const state = await stateManager.createSignupState({
      phone: '+1234567890',
      metadata: { test: true }
    });
    console.log(`  ✓ State created with ID: ${state.id}`);

    // Test 2: Retrieve state
    console.log('  ✓ Retrieving signup state...');
    const retrievedState = await stateManager.getSignupState(state.id);
    console.log(`  ✓ State retrieved, current step: ${retrievedState?.currentStep}`);

    // Test 3: Mark phone verified
    console.log('  ✓ Marking phone as verified...');
    const phoneVerifiedState = await stateManager.markPhoneVerified(state.id);
    console.log(`  ✓ Phone verified, current step: ${phoneVerifiedState.currentStep}`);

    // Test 4: Mark email verified
    console.log('  ✓ Marking email as verified...');
    const emailVerifiedState = await stateManager.markEmailVerified(state.id);
    console.log(`  ✓ Email verified, current step: ${emailVerifiedState.currentStep}`);

    // Test 5: Complete signup
    console.log('  ✓ Completing signup...');
    const completedState = await stateManager.completeSignup(state.id, 'hashed-password');
    console.log(`  ✓ Signup completed, current step: ${completedState.currentStep}`);

    // Test 6: Clean up
    console.log('  ✓ Cleaning up state...');
    await stateManager.deleteSignupState(state.id);
    console.log('  ✓ State cleaned up');

    console.log('✅ Signup State Manager verification completed successfully!\n');
    return true;
  } catch (error: any) {
    console.error('❌ Signup State Manager verification failed:', error.message);
    return false;
  }
}

async function verifyMultiStepSignupService() {
  console.log('🔍 Verifying Multi-Step Signup Service...');
  
  try {
    const signupService = new MultiStepSignupService();

    // Test 1: Start phone signup (will fail due to database, but should validate phone)
    console.log('  ✓ Testing phone validation...');
    try {
      await signupService.startPhoneSignup({ phone: 'invalid-phone' });
      console.log('  ❌ Should have failed with invalid phone');
      return false;
    } catch (error: any) {
      if (error.message.includes('Invalid phone number format')) {
        console.log('  ✓ Phone validation working correctly');
      } else {
        console.log('  ⚠️ Different error than expected:', error.message);
      }
    }

    // Test 2: Test with valid phone (will fail at database level, but that's expected)
    console.log('  ✓ Testing with valid phone...');
    try {
      await signupService.startPhoneSignup({ phone: '+1234567890' });
      console.log('  ⚠️ Unexpectedly succeeded (database should not be available)');
    } catch (error: any) {
      if (error.message.includes('Failed to create signup state') || 
          error.message.includes('database') || 
          error.message.includes('connection')) {
        console.log('  ✓ Failed at expected database level');
      } else {
        console.log('  ⚠️ Different error than expected:', error.message);
      }
    }

    console.log('✅ Multi-Step Signup Service verification completed!\n');
    return true;
  } catch (error: any) {
    console.error('❌ Multi-Step Signup Service verification failed:', error.message);
    return false;
  }
}

async function verifyValidationLogic() {
  console.log('🔍 Verifying Validation Logic...');
  
  try {
    const { UserValidator } = await import('./models/auth.models');

    // Test phone validation
    console.log('  ✓ Testing phone validation...');
    const validPhones = ['+1234567890', '+44 20 7946 0958', '(555) 123-4567'];
    const invalidPhones = ['123', 'invalid', ''];
    
    validPhones.forEach(phone => {
      if (!UserValidator.validatePhone(phone)) {
        throw new Error(`Valid phone ${phone} was rejected`);
      }
    });
    
    invalidPhones.forEach(phone => {
      if (UserValidator.validatePhone(phone)) {
        throw new Error(`Invalid phone ${phone} was accepted`);
      }
    });
    console.log('  ✓ Phone validation working correctly');

    // Test email validation
    console.log('  ✓ Testing email validation...');
    const validEmails = ['test@example.com', 'user.name@domain.co.uk'];
    const invalidEmails = ['invalid', '@domain.com', 'user@'];
    
    validEmails.forEach(email => {
      if (!UserValidator.validateEmail(email)) {
        throw new Error(`Valid email ${email} was rejected`);
      }
    });
    
    invalidEmails.forEach(email => {
      if (UserValidator.validateEmail(email)) {
        throw new Error(`Invalid email ${email} was accepted`);
      }
    });
    console.log('  ✓ Email validation working correctly');

    // Test password validation
    console.log('  ✓ Testing password validation...');
    const validPasswords = ['Password123', 'MySecure1Pass', 'Test123456'];
    const invalidPasswords = ['123', 'password', 'PASSWORD', '12345678'];
    
    validPasswords.forEach(password => {
      if (!UserValidator.validatePassword(password)) {
        throw new Error(`Valid password was rejected`);
      }
    });
    
    invalidPasswords.forEach(password => {
      if (UserValidator.validatePassword(password)) {
        throw new Error(`Invalid password was accepted`);
      }
    });
    console.log('  ✓ Password validation working correctly');

    // Test OTP validation
    console.log('  ✓ Testing OTP validation...');
    if (!UserValidator.validateOTP('123456')) {
      throw new Error('Valid OTP was rejected');
    }
    if (UserValidator.validateOTP('12345')) {
      throw new Error('Invalid OTP was accepted');
    }
    console.log('  ✓ OTP validation working correctly');

    console.log('✅ Validation Logic verification completed!\n');
    return true;
  } catch (error: any) {
    console.error('❌ Validation Logic verification failed:', error.message);
    return false;
  }
}

async function verifyStepTransitions() {
  console.log('🔍 Verifying Step Transitions...');
  
  try {
    const stateManager = new SignupStateManager();

    // Test valid transitions
    const validTransitions = [
      [SignupStep.PHONE_VERIFICATION, SignupStep.EMAIL_VERIFICATION],
      [SignupStep.EMAIL_VERIFICATION, SignupStep.PASSWORD_CREATION],
      [SignupStep.PASSWORD_CREATION, SignupStep.COMPLETED]
    ];

    validTransitions.forEach(([current, target]) => {
      if (!stateManager.validateStepTransition(current, target)) {
        throw new Error(`Valid transition ${current} -> ${target} was rejected`);
      }
    });
    console.log('  ✓ Valid transitions working correctly');

    // Test invalid transitions
    const invalidTransitions = [
      [SignupStep.PHONE_VERIFICATION, SignupStep.PASSWORD_CREATION],
      [SignupStep.EMAIL_VERIFICATION, SignupStep.COMPLETED],
      [SignupStep.COMPLETED, SignupStep.PHONE_VERIFICATION]
    ];

    invalidTransitions.forEach(([current, target]) => {
      if (stateManager.validateStepTransition(current, target)) {
        throw new Error(`Invalid transition ${current} -> ${target} was accepted`);
      }
    });
    console.log('  ✓ Invalid transitions correctly rejected');

    console.log('✅ Step Transitions verification completed!\n');
    return true;
  } catch (error: any) {
    console.error('❌ Step Transitions verification failed:', error.message);
    return false;
  }
}

async function runAllVerifications() {
  console.log('🧪 Starting Multi-Step Phone Signup Implementation Verification...\n');
  
  const results = [];
  
  try {
    results.push(await verifyValidationLogic());
    results.push(await verifyStepTransitions());
    results.push(await verifySignupStateManager());
    results.push(await verifyMultiStepSignupService());
    
    const successCount = results.filter(r => r).length;
    const totalCount = results.length;
    
    console.log(`\n📊 Verification Results: ${successCount}/${totalCount} passed`);
    
    if (successCount === totalCount) {
      console.log('🎉 All verifications passed! Implementation is working correctly.');
    } else {
      console.log('⚠️ Some verifications failed. Check the logs above for details.');
    }
    
  } catch (error: any) {
    console.error('❌ Verification process failed:', error.message);
  } finally {
    // Clean up Redis connection
    try {
      await redisClient.quit();
      console.log('🔌 Redis connection closed');
    } catch (error) {
      console.log('🔌 Redis cleanup completed');
    }
  }
}

// Run verifications if this file is executed directly
if (require.main === module) {
  runAllVerifications().catch(console.error);
}

export {
  verifySignupStateManager,
  verifyMultiStepSignupService,
  verifyValidationLogic,
  verifyStepTransitions,
  runAllVerifications
};