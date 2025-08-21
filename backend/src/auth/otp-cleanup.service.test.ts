import { OTPCleanupService, CleanupStats } from './otp-cleanup.service';
import { SecureOTPService } from './secure-otp.service';
import pool from '../config/database';
import redisClient from '../config/redis';
import { jest } from '@jest/globals';

describe('OTPCleanupService', () => {
  let cleanupService: OTPCleanupService;
  let otpService: SecureOTPService;
  let testPhoneNumbers: string[];

  beforeAll(async () => {
    // Connect to Redis if not already connected
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  });

  beforeEach(async () => {
    cleanupService = new OTPCleanupService({
      enabled: true,
      cronSchedule: '*/5 * * * * *', // Every 5 seconds for testing
      batchSize: 100,
      maxAge: 1, // 1 hour for testing
      logResults: false // Disable logging during tests
    });

    otpService = new SecureOTPService();
    
    testPhoneNumbers = [
      '+1234567890',
      '+1234567891',
      '+1234567892'
    ];

    // Clean up any existing test data
    for (const phone of testPhoneNumbers) {
      await pool.query('DELETE FROM otp_verifications WHERE phone_number = $1', [phone]);
      await redisClient.del(`otp_rate_limit:${phone}`);
      await redisClient.del(`otp_attempts:${phone}:registration`);
    }
  });

  afterEach(async () => {
    // Clean up test data
    for (const phone of testPhoneNumbers) {
      await pool.query('DELETE FROM otp_verifications WHERE phone_number = $1', [phone]);
      await redisClient.del(`otp_rate_limit:${phone}`);
      await redisClient.del(`otp_attempts:${phone}:registration`);
    }
    
    cleanupService.stop();
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  describe('runCleanup', () => {
    it('should clean up expired OTPs from database', async () => {
      // Create some test OTPs
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await otpService.generateOTP(
          testPhoneNumbers[i],
          'registration',
          `user-${i}`
        );
        results.push(result);
      }

      // Make some OTPs expired by updating their expiry time
      await pool.query(`
        UPDATE otp_verifications 
        SET expires_at = $1 
        WHERE phone_number IN ($2, $3)
      `, [
        new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        testPhoneNumbers[0],
        testPhoneNumbers[1]
      ]);

      // Run cleanup
      const cleanupStats: CleanupStats = await cleanupService.runCleanup();

      expect(cleanupStats.deletedOTPs).toBe(2);
      expect(cleanupStats.duration).toBeGreaterThan(0);
      expect(cleanupStats.errors).toHaveLength(0);

      // Verify expired OTPs were deleted
      const remainingOTPs = await pool.query(`
        SELECT * FROM otp_verifications 
        WHERE phone_number IN ($1, $2, $3)
      `, testPhoneNumbers);

      expect(remainingOTPs.rows).toHaveLength(1);
      expect(remainingOTPs.rows[0].phone_number).toBe(testPhoneNumbers[2]);
    });

    it('should clean up used OTPs', async () => {
      // Create test OTPs
      const results = [];
      for (let i = 0; i < 2; i++) {
        const result = await otpService.generateOTP(
          testPhoneNumbers[i],
          'registration',
          `user-${i}`
        );
        results.push(result);
      }

      // Mark one as used
      await pool.query(`
        UPDATE otp_verifications 
        SET is_used = true, created_at = $1
        WHERE phone_number = $2
      `, [
        new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        testPhoneNumbers[0]
      ]);

      const cleanupStats = await cleanupService.runCleanup();

      expect(cleanupStats.deletedOTPs).toBe(1);

      // Verify used OTP was deleted
      const remainingOTPs = await pool.query(`
        SELECT * FROM otp_verifications 
        WHERE phone_number IN ($1, $2)
      `, [testPhoneNumbers[0], testPhoneNumbers[1]]);

      expect(remainingOTPs.rows).toHaveLength(1);
      expect(remainingOTPs.rows[0].phone_number).toBe(testPhoneNumbers[1]);
    });

    it('should clean up Redis keys for expired OTPs', async () => {
      // Create test OTPs and Redis keys
      for (let i = 0; i < 2; i++) {
        await otpService.generateOTP(testPhoneNumbers[i], 'registration', `user-${i}`);
        
        // Add some Redis keys
        await redisClient.setEx(`otp_attempts:${testPhoneNumbers[i]}:registration`, 3600, '1');
        await redisClient.setEx(`otp_rate_limit:${testPhoneNumbers[i]}`, 3600, '1');
      }

      // Make OTPs expired
      await pool.query(`
        UPDATE otp_verifications 
        SET expires_at = $1 
        WHERE phone_number IN ($2, $3)
      `, [
        new Date(Date.now() - 2 * 60 * 60 * 1000),
        testPhoneNumbers[0],
        testPhoneNumbers[1]
      ]);

      const cleanupStats = await cleanupService.runCleanup();

      expect(cleanupStats.cleanedRedisKeys).toBeGreaterThan(0);
      expect(cleanupStats.deletedOTPs).toBe(2);
    });

    it('should handle cleanup in batches', async () => {
      // Create cleanup service with small batch size
      const batchCleanupService = new OTPCleanupService({
        enabled: true,
        batchSize: 1, // Process one at a time
        maxAge: 1,
        logResults: false
      });

      // Create multiple expired OTPs
      for (let i = 0; i < 3; i++) {
        await otpService.generateOTP(testPhoneNumbers[i], 'registration', `user-${i}`);
      }

      // Make all OTPs expired
      await pool.query(`
        UPDATE otp_verifications 
        SET expires_at = $1 
        WHERE phone_number = ANY($2)
      `, [
        new Date(Date.now() - 2 * 60 * 60 * 1000),
        testPhoneNumbers
      ]);

      const cleanupStats = await batchCleanupService.runCleanup();

      expect(cleanupStats.deletedOTPs).toBe(3);
      expect(cleanupStats.errors).toHaveLength(0);

      batchCleanupService.stop();
    });

    it('should prevent concurrent cleanup runs', async () => {
      // Start a cleanup that will take some time
      const cleanupPromise1 = cleanupService.runCleanup();

      // Try to start another cleanup immediately
      await expect(cleanupService.runCleanup()).rejects.toThrow(
        'Cleanup is already running'
      );

      // Wait for first cleanup to complete
      await cleanupPromise1;
    });

    it('should handle database errors gracefully', async () => {
      // Mock pool.connect to throw an error
      const originalConnect = pool.connect;
      pool.connect = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      await expect(cleanupService.runCleanup()).rejects.toThrow('Database connection failed');

      // Restore original method
      pool.connect = originalConnect;
    });

    it('should track cleanup history', async () => {
      // Create some test data
      await otpService.generateOTP(testPhoneNumbers[0], 'registration', 'user-1');
      
      // Make it expired
      await pool.query(`
        UPDATE otp_verifications 
        SET expires_at = $1 
        WHERE phone_number = $2
      `, [
        new Date(Date.now() - 2 * 60 * 60 * 1000),
        testPhoneNumbers[0]
      ]);

      const cleanupStats = await cleanupService.runCleanup();

      expect(cleanupStats.timestamp).toBeInstanceOf(Date);
      expect(cleanupStats.deletedOTPs).toBe(1);
      expect(cleanupStats.duration).toBeGreaterThan(0);
    });
  });

  describe('Service Configuration', () => {
    it('should respect enabled/disabled configuration', () => {
      const disabledService = new OTPCleanupService({ enabled: false });
      
      // Should not throw when starting disabled service
      expect(() => disabledService.start()).not.toThrow();
      
      disabledService.stop();
    });

    it('should use custom configuration values', () => {
      const customService = new OTPCleanupService({
        enabled: true,
        cronSchedule: '0 0 * * *', // Daily
        batchSize: 500,
        maxAge: 48, // 48 hours
        logResults: true
      });

      expect(customService).toBeDefined();
      customService.stop();
    });
  });

  describe('Performance and Optimization', () => {
    it('should complete cleanup within reasonable time', async () => {
      // Create multiple OTPs for performance testing
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          otpService.generateOTP(`+123456789${i}`, 'registration', `user-${i}`)
        );
      }
      await Promise.all(promises);

      // Make all expired
      await pool.query(`
        UPDATE otp_verifications 
        SET expires_at = $1 
        WHERE phone_number LIKE '+123456789%'
      `, [new Date(Date.now() - 2 * 60 * 60 * 1000)]);

      const startTime = Date.now();
      const cleanupStats = await cleanupService.runCleanup();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      expect(cleanupStats.deletedOTPs).toBe(10);

      // Clean up test data
      await pool.query(`DELETE FROM otp_verifications WHERE phone_number LIKE '+123456789%'`);
    });

    it('should handle large datasets efficiently', async () => {
      // This test would be more comprehensive with a larger dataset
      // For now, we'll test the batch processing logic
      
      const largeDataService = new OTPCleanupService({
        enabled: true,
        batchSize: 2, // Small batch for testing
        maxAge: 1,
        logResults: false
      });

      // Create test data
      for (let i = 0; i < 5; i++) {
        await otpService.generateOTP(`+123456780${i}`, 'registration', `user-${i}`);
      }

      // Make all expired
      await pool.query(`
        UPDATE otp_verifications 
        SET expires_at = $1 
        WHERE phone_number LIKE '+123456780%'
      `, [new Date(Date.now() - 2 * 60 * 60 * 1000)]);

      const cleanupStats = await largeDataService.runCleanup();

      expect(cleanupStats.deletedOTPs).toBe(5);
      expect(cleanupStats.errors).toHaveLength(0);

      // Clean up
      await pool.query(`DELETE FROM otp_verifications WHERE phone_number LIKE '+123456780%'`);
      largeDataService.stop();
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis connection errors', async () => {
      // Create some test data
      await otpService.generateOTP(testPhoneNumbers[0], 'registration', 'user-1');
      
      // Make it expired
      await pool.query(`
        UPDATE otp_verifications 
        SET expires_at = $1 
        WHERE phone_number = $2
      `, [
        new Date(Date.now() - 2 * 60 * 60 * 1000),
        testPhoneNumbers[0]
      ]);

      // Mock Redis to throw errors
      const originalKeys = redisClient.keys;
      redisClient.keys = jest.fn().mockRejectedValue(new Error('Redis connection failed'));

      const cleanupStats = await cleanupService.runCleanup();

      // Should still clean up database records even if Redis fails
      expect(cleanupStats.deletedOTPs).toBe(1);
      expect(cleanupStats.cleanedRedisKeys).toBe(0);

      // Restore Redis
      redisClient.keys = originalKeys;
    });

    it('should rollback database changes on error', async () => {
      // Create test data
      await otpService.generateOTP(testPhoneNumbers[0], 'registration', 'user-1');
      
      // Mock a database error during cleanup
      const originalQuery = pool.query;
      let queryCount = 0;
      
      pool.query = jest.fn().mockImplementation((...args) => {
        queryCount++;
        if (queryCount === 3) { // Fail on the third query (after BEGIN)
          throw new Error('Simulated database error');
        }
        return originalQuery.apply(pool, args);
      });

      await expect(cleanupService.runCleanup()).rejects.toThrow('Simulated database error');

      // Verify data is still there (rollback worked)
      const remainingOTPs = await originalQuery.call(pool, `
        SELECT * FROM otp_verifications WHERE phone_number = $1
      `, [testPhoneNumbers[0]]);

      expect(remainingOTPs.rows).toHaveLength(1);

      // Restore pool
      pool.query = originalQuery;
    });
  });
});