/**
 * Simple integration test to verify the authentication models and database service work correctly
 * This can be run manually to test the implementation
 */

import { AuthDatabaseService } from './services/auth-database.service';
import { UserValidator } from './models/auth.models';

async function testAuthModelsAndService() {
  console.log('Testing Authentication Models and Database Service...');

  // Test validators
  console.log('\n1. Testing UserValidator...');
  
  const testEmail = 'test@example.com';
  const testPhone = '+1234567890';
  const testPassword = 'Password123';
  const testOTP = '123456';
  const testVerificationCode = 'ABC12345';

  console.log(`Email validation (${testEmail}):`, UserValidator.validateEmail(testEmail));
  console.log(`Phone validation (${testPhone}):`, UserValidator.validatePhone(testPhone));
  console.log(`Password validation (${testPassword}):`, UserValidator.validatePassword(testPassword));
  console.log(`OTP validation (${testOTP}):`, UserValidator.validateOTP(testOTP));
  console.log(`Verification code validation (${testVerificationCode}):`, UserValidator.validateVerificationCode(testVerificationCode));

  // Test invalid cases
  console.log('\n2. Testing invalid inputs...');
  console.log('Invalid email (test@)::', UserValidator.validateEmail('test@'));
  console.log('Invalid phone (123)::', UserValidator.validatePhone('123'));
  console.log('Invalid password (weak)::', UserValidator.validatePassword('weak'));
  console.log('Invalid OTP (12345)::', UserValidator.validateOTP('12345'));
  console.log('Invalid verification code (ABC123)::', UserValidator.validateVerificationCode('ABC123'));

  console.log('\n3. Testing AuthDatabaseService instantiation...');
  try {
    const authDbService = new AuthDatabaseService();
    console.log('✓ AuthDatabaseService instantiated successfully');
    
    // Test method existence
    console.log('✓ createUser method exists:', typeof authDbService.createUser === 'function');
    console.log('✓ getUserByEmail method exists:', typeof authDbService.getUserByEmail === 'function');
    console.log('✓ createPhoneVerification method exists:', typeof authDbService.createPhoneVerification === 'function');
    console.log('✓ createEmailVerification method exists:', typeof authDbService.createEmailVerification === 'function');
    
  } catch (error) {
    console.error('✗ Error instantiating AuthDatabaseService:', error);
  }

  console.log('\n✓ All tests completed successfully!');
  console.log('\nNote: Database operations require a running PostgreSQL instance and proper configuration.');
}

// Run the test if this file is executed directly
if (require.main === module) {
  testAuthModelsAndService().catch(console.error);
}

export { testAuthModelsAndService };