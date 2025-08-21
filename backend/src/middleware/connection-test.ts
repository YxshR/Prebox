import axios from 'axios';
import { createApiRetry, createDatabaseRetry } from './retry-logic.middleware';

/**
 * Test utilities for verifying connection fixes
 */
export class ConnectionTestUtils {
  
  /**
   * Test CORS configuration
   */
  static async testCorsConfiguration(baseUrl: string = 'http://localhost:3001'): Promise<boolean> {
    try {
      const response = await axios.get(`${baseUrl}/health/cors-test`, {
        headers: {
          'Origin': 'http://localhost:3000'
        }
      });
      
      console.log('✅ CORS test passed:', response.data);
      return true;
    } catch (error: any) {
      console.error('❌ CORS test failed:', error.message);
      return false;
    }
  }

  /**
   * Test health check endpoints
   */
  static async testHealthEndpoints(baseUrl: string = 'http://localhost:3001'): Promise<boolean> {
    const endpoints = [
      '/health',
      '/health/detailed',
      '/health/ready',
      '/health/live',
      '/health/connection'
    ];

    let allPassed = true;

    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${baseUrl}${endpoint}`);
        console.log(`✅ Health check ${endpoint} passed:`, response.status);
      } catch (error: any) {
        console.error(`❌ Health check ${endpoint} failed:`, error.message);
        allPassed = false;
      }
    }

    return allPassed;
  }

  /**
   * Test retry logic with simulated failures
   */
  static async testRetryLogic(): Promise<boolean> {
    const retryFunction = createApiRetry({
      maxRetries: 2,
      baseDelay: 100
    });

    let attemptCount = 0;
    
    try {
      await retryFunction(async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Simulated failure');
        }
        return 'Success';
      });
      
      console.log('✅ Retry logic test passed after', attemptCount, 'attempts');
      return true;
    } catch (error: any) {
      console.error('❌ Retry logic test failed:', error.message);
      return false;
    }
  }

  /**
   * Test database retry logic
   */
  static async testDatabaseRetry(db: any): Promise<boolean> {
    const retryFunction = createDatabaseRetry({
      maxRetries: 1,
      baseDelay: 100
    });

    try {
      await retryFunction(async () => {
        const result = await db.query('SELECT 1 as test');
        return result.rows[0];
      });
      
      console.log('✅ Database retry test passed');
      return true;
    } catch (error: any) {
      console.error('❌ Database retry test failed:', error.message);
      return false;
    }
  }

  /**
   * Run all connection tests
   */
  static async runAllTests(baseUrl?: string, db?: any): Promise<void> {
    console.log('🧪 Running connection tests...\n');

    const corsTest = await ConnectionTestUtils.testCorsConfiguration(baseUrl);
    const healthTest = await ConnectionTestUtils.testHealthEndpoints(baseUrl);
    const retryTest = await ConnectionTestUtils.testRetryLogic();
    
    let dbTest = true;
    if (db) {
      dbTest = await ConnectionTestUtils.testDatabaseRetry(db);
    }

    const allPassed = corsTest && healthTest && retryTest && dbTest;
    
    console.log('\n📊 Test Results:');
    console.log(`CORS Configuration: ${corsTest ? '✅' : '❌'}`);
    console.log(`Health Endpoints: ${healthTest ? '✅' : '❌'}`);
    console.log(`Retry Logic: ${retryTest ? '✅' : '❌'}`);
    console.log(`Database Retry: ${dbTest ? '✅' : '❌'}`);
    console.log(`\nOverall: ${allPassed ? '✅ All tests passed' : '❌ Some tests failed'}`);
  }
}

// Export for use in tests or manual verification
export default ConnectionTestUtils;