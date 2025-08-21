const { SecureOTPService } = require('./dist/auth/secure-otp.service');
const { OTPCleanupService } = require('./dist/auth/otp-cleanup.service');
const pool = require('./dist/config/database').default;
const redisClient = require('./dist/config/redis').default;

async function testOTPSystem() {
  console.log('🧪 Starting OTP System Manual Test...');
  
  try {
    // Connect to Redis
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    
    // Initialize services
    const otpService = new SecureOTPService({
      expiryMinutes: 10,
      maxAttempts: 3,
      rateLimitWindow: 60,
      maxOTPsPerWindow: 5,
      codeLength: 6
    });
    
    const cleanupService = new OTPCleanupService({
      enabled: true,
      batchSize: 100,
      maxAge: 24,
      logResults: true
    });
    
    const testPhone = '+1234567890';
    const testUserId = 'test-user-' + Date.now();
    
    console.log('📱 Testing OTP Generation...');
    
    // Test 1: Generate OTP
    const otpResult = await otpService.generateOTP(testPhone, 'registration', testUserId);
    console.log('✅ OTP Generated:', {
      otpId: otpResult.otpId,
      expiresAt: otpResult.expiresAt,
      attemptsRemaining: otpResult.attemptsRemaining
    });
    
    // Test 2: Check OTP in database
    const dbResult = await pool.query(
      'SELECT * FROM otp_verifications WHERE id = $1',
      [otpResult.otpId]
    );
    
    if (dbResult.rows.length > 0) {
      console.log('✅ OTP stored in database correctly');
      const otp = dbResult.rows[0];
      console.log('   - Phone:', otp.phone_number);
      console.log('   - Type:', otp.type);
      console.log('   - User ID:', otp.user_id);
      console.log('   - Is Used:', otp.is_used);
      console.log('   - Attempts:', otp.attempts);
      console.log('   - Max Attempts:', otp.max_attempts);
      console.log('   - Code Hash Length:', otp.otp_code.length);
    } else {
      console.log('❌ OTP not found in database');
    }
    
    // Test 3: Test invalid OTP validation
    console.log('🔍 Testing invalid OTP validation...');
    const invalidResult = await otpService.validateOTP(otpResult.otpId, '999999');
    console.log('✅ Invalid OTP rejected:', {
      isValid: invalidResult.isValid,
      attemptsRemaining: invalidResult.attemptsRemaining,
      errorMessage: invalidResult.errorMessage
    });
    
    // Test 4: Test attempt tracking
    console.log('📊 Testing attempt tracking...');
    const attemptInfo = await otpService.getOTPAttemptInfo(testPhone, 'registration');
    console.log('✅ Attempt info retrieved:', {
      attempts: attemptInfo.attempts,
      maxAttempts: attemptInfo.maxAttempts,
      isBlocked: attemptInfo.isBlocked
    });
    
    // Test 5: Test health status
    console.log('🏥 Testing health status...');
    const health = await otpService.getHealthStatus();
    console.log('✅ Health status:', health);
    
    // Test 6: Test cleanup service
    console.log('🧹 Testing cleanup service...');
    
    // Create an expired OTP for cleanup testing
    await pool.query(`
      INSERT INTO otp_verifications (
        id, phone_number, otp_code, type, expires_at, 
        attempts, max_attempts, is_used, created_at
      ) VALUES (
        gen_random_uuid(), $1, 'expired_hash', 'test', 
        CURRENT_TIMESTAMP - INTERVAL '1 hour',
        0, 3, false, CURRENT_TIMESTAMP - INTERVAL '1 hour'
      )
    `, [testPhone + '_expired']);
    
    const cleanupStats = await cleanupService.runCleanup();
    console.log('✅ Cleanup completed:', {
      deletedOTPs: cleanupStats.deletedOTPs,
      cleanedRedisKeys: cleanupStats.cleanedRedisKeys,
      duration: cleanupStats.duration + 'ms',
      errors: cleanupStats.errors.length
    });
    
    // Test 7: Test rate limiting
    console.log('🚦 Testing rate limiting...');
    try {
      // Generate multiple OTPs to test rate limiting
      for (let i = 0; i < 6; i++) {
        await otpService.generateOTP(testPhone + '_rate_test', 'registration', testUserId + i);
      }
      console.log('❌ Rate limiting not working - should have failed');
    } catch (error) {
      if (error.message.includes('Rate limit exceeded')) {
        console.log('✅ Rate limiting working correctly');
      } else {
        console.log('❌ Unexpected error:', error.message);
      }
    }
    
    // Cleanup test data
    console.log('🧽 Cleaning up test data...');
    await pool.query('DELETE FROM otp_verifications WHERE phone_number LIKE $1', [testPhone + '%']);
    await redisClient.del(`otp_rate_limit:${testPhone}`);
    await redisClient.del(`otp_rate_limit:${testPhone}_rate_test`);
    
    console.log('🎉 All OTP system tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Close connections
    await redisClient.quit();
    await pool.end();
  }
}

// Run the test
testOTPSystem().catch(console.error);