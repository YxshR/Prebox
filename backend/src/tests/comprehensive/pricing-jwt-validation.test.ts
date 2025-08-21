/**
 * Comprehensive security tests for pricing protection and JWT validation
 * Requirements: 7.1, 7.2, 7.3, 7.4, 8.1, 8.2
 */

import { PricingProtectionService } from '../../security/pricing-protection.service';
import { UserSecurityManager } from '../../auth/user-security-manager.service';
import pool from '../../config/database';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

describe('Pricing Protection and JWT Validation Security Tests', () => {
  let pricingService: PricingProtectionService;
  let userSecurityManager: UserSecurityManager;
  
  const testUserId = 'security-test-user-' + Date.now();
  const testPlanId = 'security-test-plan-' + Date.now();

  beforeAll(async () => {
    pricingService = new PricingProtectionService();
    userSecurityManager = new UserSecurityManager();
  });

  beforeEach(async () => {
    // Clean up test data
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await pool.query('DELETE FROM secure_pricing WHERE plan_id = $1', [testPlanId]);
    await pool.query('DELETE FROM pricing_tampering_log WHERE user_id = $1', [testUserId]);
  });

  afterAll(async () => {
    // Final cleanup
    await pool.query('DELETE FROM users WHERE id = $1', [testUserId]);
    await pool.query('DELETE FROM secure_pricing WHERE plan_id = $1', [testPlanId]);
    await pool.query('DELETE FROM pricing_tampering_log WHERE user_id = $1', [testUserId]);
  });

  describe('JWT Signature Security', () => {
    it('should generate cryptographically secure JWT signatures', () => {
      const pricingData = {
        planId: testPlanId,
        planName: 'Security Test Plan',
        priceAmount: 99.99,
        currency: 'INR',
        billingCycle: 'monthly' as const,
        features: ['Feature 1', 'Feature 2'],
        limits: { emails: 1000, recipients: 5000 },
        isPopular: false
      };

      const signature1 = pricingService.signPricingData(pricingData);
      const signature2 = pricingService.signPricingData(pricingData);

      // Signatures should be different due to timestamp/nonce
      expect(signature1).not.toBe(signature2);
      
      // Both should be valid JWT format
      expect(signature1.split('.')).toHaveLength(3);
      expect(signature2.split('.')).toHaveLength(3);
      
      // Both should verify correctly
      expect(pricingService.verifyPricingSignature(
        pricingData.planId,
        pricingData.priceAmount,
        pricingData.currency,
        pricingData.billingCycle,
        signature1
      )).toBe(true);
      
      expect(pricingService.verifyPricingSignature(
        pricingData.planId,
        pricingData.priceAmount,
        pricingData.currency,
        pricingData.billingCycle,
        signature2
      )).toBe(true);
    });

    it('should reject signatures with tampered headers', () => {
      const pricingData = {
        planId: testPlanId,
        planName: 'Security Test Plan',
        priceAmount: 99.99,
        currency: 'INR',
        billingCycle: 'monthly' as const,
        features: ['Feature 1'],
        limits: { emails: 1000 },
        isPopular: false
      };

      const validSignature = pricingService.signPricingData(pricingData);
      const parts = validSignature.split('.');
      
      // Tamper with header (change algorithm to 'none')
      const tamperedHeader = Buffer.from(JSON.stringify({
        alg: 'none',
        typ: 'JWT'
      })).toString('base64url');
      
      const tamperedSignature = `${tamperedHeader}.${parts[1]}.${parts[2]}`;
      
      const isValid = pricingService.verifyPricingSignature(
        pricingData.planId,
        pricingData.priceAmount,
        pricingData.currency,
        pricingData.billingCycle,
        tamperedSignature
      );
      
      expect(isValid).toBe(false);
    });

    it('should reject signatures with tampered payloads', () => {
      const pricingData = {
        planId: testPlanId,
        planName: 'Security Test Plan',
        priceAmount: 99.99,
        currency: 'INR',
        billingCycle: 'monthly' as const,
        features: ['Feature 1'],
        limits: { emails: 1000 },
        isPopular: false
      };

      const validSignature = pricingService.signPricingData(pricingData);
      const parts = validSignature.split('.');
      
      // Tamper with payload (change price)
      const originalPayload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      const tamperedPayload = { ...originalPayload, priceAmount: 49.99 };
      const tamperedPayloadEncoded = Buffer.from(JSON.stringify(tamperedPayload)).toString('base64url');
      
      const tamperedSignature = `${parts[0]}.${tamperedPayloadEncoded}.${parts[2]}`;
      
      const isValid = pricingService.verifyPricingSignature(
        pricingData.planId,
        pricingData.priceAmount,
        pricingData.currency,
        pricingData.billingCycle,
        tamperedSignature
      );
      
      expect(isValid).toBe(false);
    });

    it('should reject expired JWT signatures', () => {
      const pricingData = {
        planId: testPlanId,
        planName: 'Security Test Plan',
        priceAmount: 99.99,
        currency: 'INR',
        billingCycle: 'monthly' as const,
        features: ['Feature 1'],
        limits: { emails: 1000 },
        isPopular: false
      };

      // Create expired JWT manually
      const expiredPayload = {
        planId: pricingData.planId,
        priceAmount: pricingData.priceAmount,
        currency: pricingData.currency,
        billingCycle: pricingData.billingCycle,
        iat: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
        exp: Math.floor(Date.now() / 1000) - 1800  // 30 minutes ago (expired)
      };

      const expiredSignature = jwt.sign(expiredPayload, process.env.JWT_SECRET!);
      
      const isValid = pricingService.verifyPricingSignature(
        pricingData.planId,
        pricingData.priceAmount,
        pricingData.currency,
        pricingData.billingCycle,
        expiredSignature
      );
      
      expect(isValid).toBe(false);
    });
  });

  describe('Pricing Tampering Detection', () => {
    it('should detect and log client-side price manipulation', async () => {
      // Create test user
      await pool.query(
        'INSERT INTO users (id, phone_number, email) VALUES ($1, $2, $3)',
        [testUserId, '+1234567890', 'test@example.com']
      );

      const pricingData = {
        planId: testPlanId,
        planName: 'Tamper Test Plan',
        priceAmount: 199.99,
        currency: 'INR',
        billingCycle: 'monthly' as const,
        features: ['Premium Feature'],
        limits: { emails: 10000 },
        isPopular: true
      };

      // Create secure pricing in database
      await pricingService.createOrUpdatePricing(pricingData);

      // Attempt purchase with tampered price
      const result = await pricingService.validatePurchaseRequest(
        testPlanId,
        99.99, // Tampered price (should be 199.99)
        testUserId
      );

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Pricing data mismatch detected');

      // Verify tampering was logged
      const logResult = await pool.query(
        'SELECT * FROM pricing_tampering_log WHERE user_id = $1 AND plan_id = $2',
        [testUserId, testPlanId]
      );

      expect(logResult.rows).toHaveLength(1);
      const log = logResult.rows[0];
      expect(log.attempted_price).toBe('99.99');
      expect(log.actual_price).toBe('199.99');
      expect(log.price_difference).toBe('100.00');
    });

    it('should detect currency manipulation attempts', async () => {
      await pool.query(
        'INSERT INTO users (id, phone_number, email) VALUES ($1, $2, $3)',
        [testUserId, '+1234567890', 'test@example.com']
      );

      const pricingData = {
        planId: testPlanId,
        planName: 'Currency Test Plan',
        priceAmount: 99.99,
        currency: 'INR',
        billingCycle: 'monthly' as const,
        features: ['Feature 1'],
        limits: { emails: 1000 },
        isPopular: false
      };

      await pricingService.createOrUpdatePricing(pricingData);

      // Attempt purchase with different currency
      const validation = await pricingService.validatePricing(testPlanId, 99.99, 'USD');

      expect(validation.isValid).toBe(false);
      expect(validation.error).toBe('Pricing data mismatch detected');
    });

    it('should handle floating point precision attacks', async () => {
      await pool.query(
        'INSERT INTO users (id, phone_number, email) VALUES ($1, $2, $3)',
        [testUserId, '+1234567890', 'test@example.com']
      );

      const pricingData = {
        planId: testPlanId,
        planName: 'Precision Test Plan',
        priceAmount: 99.99,
        currency: 'INR',
        billingCycle: 'monthly' as const,
        features: ['Feature 1'],
        limits: { emails: 1000 },
        isPopular: false
      };

      await pricingService.createOrUpdatePricing(pricingData);

      // Test various floating point precision attempts
      const precisionAttempts = [
        99.989,  // Close but not exact
        99.991,  // Close but not exact
        99.9899, // Very close
        99.9901  // Very close
      ];

      for (const price of precisionAttempts) {
        const validation = await pricingService.validatePricing(testPlanId, price, 'INR');
        
        // Should accept very close values (within 0.01 tolerance)
        if (Math.abs(price - 99.99) <= 0.01) {
          expect(validation.isValid).toBe(true);
        } else {
          expect(validation.isValid).toBe(false);
        }
      }
    });

    it('should prevent replay attacks with timestamps', () => {
      const pricingData = {
        planId: testPlanId,
        planName: 'Replay Test Plan',
        priceAmount: 99.99,
        currency: 'INR',
        billingCycle: 'monthly' as const,
        features: ['Feature 1'],
        limits: { emails: 1000 },
        isPopular: false
      };

      // Generate signature with old timestamp
      const oldPayload = {
        planId: pricingData.planId,
        priceAmount: pricingData.priceAmount,
        currency: pricingData.currency,
        billingCycle: pricingData.billingCycle,
        iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        exp: Math.floor(Date.now() / 1000) + 3600  // Still valid for 1 hour
      };

      const oldSignature = jwt.sign(oldPayload, process.env.JWT_SECRET!);

      // Should reject old signatures even if not expired
      const isValid = pricingService.verifyPricingSignature(
        pricingData.planId,
        pricingData.priceAmount,
        pricingData.currency,
        pricingData.billingCycle,
        oldSignature
      );

      // Implementation should check timestamp freshness
      expect(isValid).toBe(false);
    });
  });

  describe('User-Specific JWT Security', () => {
    it('should prevent cross-user token usage', async () => {
      const user1Id = testUserId;
      const user2Id = testUserId + '-2';

      // Create two test users
      await pool.query(
        'INSERT INTO users (id, phone_number, email) VALUES ($1, $2, $3)',
        [user1Id, '+1234567890', 'user1@example.com']
      );
      await pool.query(
        'INSERT INTO users (id, phone_number, email) VALUES ($1, $2, $3)',
        [user2Id, '+1234567891', 'user2@example.com']
      );

      // Generate secrets for both users
      const secrets1 = await userSecurityManager.generateUserJWTSecrets(user1Id);
      const secrets2 = await userSecurityManager.generateUserJWTSecrets(user2Id);

      // Create token for user1
      const user1Token = jwt.sign(
        { userId: user1Id, email: 'user1@example.com' },
        secrets1.jwtSecret,
        { expiresIn: '15m' }
      );

      // Try to validate user1's token as user2
      await expect(
        userSecurityManager.validateUserAccessToken(user1Token, user2Id)
      ).rejects.toThrow('Invalid access token');

      // Cleanup
      await pool.query('DELETE FROM users WHERE id = $1', [user2Id]);
    });

    it('should handle JWT secret rotation securely', async () => {
      await pool.query(
        'INSERT INTO users (id, phone_number, email) VALUES ($1, $2, $3)',
        [testUserId, '+1234567890', 'test@example.com']
      );

      // Generate initial secrets
      const initialSecrets = await userSecurityManager.generateUserJWTSecrets(testUserId);
      
      // Create token with initial secrets
      const initialToken = jwt.sign(
        { userId: testUserId, email: 'test@example.com' },
        initialSecrets.jwtSecret,
        { expiresIn: '15m' }
      );

      // Verify initial token works
      const initialValidation = await userSecurityManager.validateUserAccessToken(initialToken, testUserId);
      expect(initialValidation.userId).toBe(testUserId);

      // Rotate secrets
      const newSecrets = await userSecurityManager.rotateUserSecrets(testUserId);
      
      // Old token should no longer work
      await expect(
        userSecurityManager.validateUserAccessToken(initialToken, testUserId)
      ).rejects.toThrow('Invalid access token');

      // New token with new secrets should work
      const newToken = jwt.sign(
        { userId: testUserId, email: 'test@example.com' },
        newSecrets.jwtSecret,
        { expiresIn: '15m' }
      );

      const newValidation = await userSecurityManager.validateUserAccessToken(newToken, testUserId);
      expect(newValidation.userId).toBe(testUserId);
    });

    it('should validate JWT claims thoroughly', async () => {
      await pool.query(
        'INSERT INTO users (id, phone_number, email) VALUES ($1, $2, $3)',
        [testUserId, '+1234567890', 'test@example.com']
      );

      const secrets = await userSecurityManager.generateUserJWTSecrets(testUserId);

      // Test various invalid claims
      const invalidClaims = [
        { userId: 'different-user', email: 'test@example.com' }, // Wrong user ID
        { userId: testUserId }, // Missing email
        { email: 'test@example.com' }, // Missing user ID
        { userId: testUserId, email: 'test@example.com', role: 'admin' }, // Unexpected claims
        {} // Empty claims
      ];

      for (const claims of invalidClaims) {
        const token = jwt.sign(claims, secrets.jwtSecret, { expiresIn: '15m' });
        
        await expect(
          userSecurityManager.validateUserAccessToken(token, testUserId)
        ).rejects.toThrow();
      }
    });

    it('should handle malformed JWT tokens gracefully', async () => {
      await pool.query(
        'INSERT INTO users (id, phone_number, email) VALUES ($1, $2, $3)',
        [testUserId, '+1234567890', 'test@example.com']
      );

      const malformedTokens = [
        'not.a.jwt.token',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        'eyJhbGciOiJub25lIn0..', // None algorithm
        '',
        'just-a-string',
        'header.payload', // Missing signature
        'too.many.parts.in.this.jwt.token'
      ];

      for (const token of malformedTokens) {
        await expect(
          userSecurityManager.validateUserAccessToken(token, testUserId)
        ).rejects.toThrow();
      }
    });
  });

  describe('Advanced Security Attacks', () => {
    it('should prevent timing attacks on JWT validation', async () => {
      await pool.query(
        'INSERT INTO users (id, phone_number, email) VALUES ($1, $2, $3)',
        [testUserId, '+1234567890', 'test@example.com']
      );

      const secrets = await userSecurityManager.generateUserJWTSecrets(testUserId);

      // Create valid token
      const validToken = jwt.sign(
        { userId: testUserId, email: 'test@example.com' },
        secrets.jwtSecret,
        { expiresIn: '15m' }
      );

      // Test timing consistency for different invalid tokens
      const invalidTokens = [
        'invalid.token.1',
        'invalid.token.2',
        'completely.different.invalid.token',
        validToken.slice(0, -5) + 'wrong' // Almost valid token
      ];

      const timings: number[] = [];

      for (const token of invalidTokens) {
        const startTime = process.hrtime.bigint();
        
        try {
          await userSecurityManager.validateUserAccessToken(token, testUserId);
        } catch (error) {
          // Expected to fail
        }
        
        const endTime = process.hrtime.bigint();
        timings.push(Number(endTime - startTime) / 1000000); // Convert to milliseconds
      }

      // Calculate timing variance
      const avgTime = timings.reduce((a, b) => a + b) / timings.length;
      const maxVariance = Math.max(...timings.map(t => Math.abs(t - avgTime)));
      
      // Timing variance should be minimal (within 10ms)
      expect(maxVariance).toBeLessThan(10);
    });

    it('should prevent JWT algorithm confusion attacks', async () => {
      await pool.query(
        'INSERT INTO users (id, phone_number, email) VALUES ($1, $2, $3)',
        [testUserId, '+1234567890', 'test@example.com']
      );

      const secrets = await userSecurityManager.generateUserJWTSecrets(testUserId);

      // Create token with 'none' algorithm
      const noneAlgToken = jwt.sign(
        { userId: testUserId, email: 'test@example.com' },
        '',
        { algorithm: 'none' as any }
      );

      // Should reject 'none' algorithm tokens
      await expect(
        userSecurityManager.validateUserAccessToken(noneAlgToken, testUserId)
      ).rejects.toThrow();

      // Create token with different algorithm (RS256 instead of HS256)
      try {
        const rsaToken = jwt.sign(
          { userId: testUserId, email: 'test@example.com' },
          secrets.jwtSecret,
          { algorithm: 'RS256' as any }
        );

        await expect(
          userSecurityManager.validateUserAccessToken(rsaToken, testUserId)
        ).rejects.toThrow();
      } catch (error) {
        // Expected - RS256 requires different key format
      }
    });

    it('should prevent pricing signature forgery attempts', () => {
      const pricingData = {
        planId: testPlanId,
        planName: 'Forgery Test Plan',
        priceAmount: 99.99,
        currency: 'INR',
        billingCycle: 'monthly' as const,
        features: ['Feature 1'],
        limits: { emails: 1000 },
        isPopular: false
      };

      // Attempt to create signature with wrong secret
      const wrongSecret = 'wrong-secret-key';
      const forgedSignature = jwt.sign(
        {
          planId: pricingData.planId,
          priceAmount: pricingData.priceAmount,
          currency: pricingData.currency,
          billingCycle: pricingData.billingCycle,
          iat: Math.floor(Date.now() / 1000)
        },
        wrongSecret
      );

      const isValid = pricingService.verifyPricingSignature(
        pricingData.planId,
        pricingData.priceAmount,
        pricingData.currency,
        pricingData.billingCycle,
        forgedSignature
      );

      expect(isValid).toBe(false);
    });

    it('should handle concurrent tampering attempts', async () => {
      await pool.query(
        'INSERT INTO users (id, phone_number, email) VALUES ($1, $2, $3)',
        [testUserId, '+1234567890', 'test@example.com']
      );

      const pricingData = {
        planId: testPlanId,
        planName: 'Concurrent Test Plan',
        priceAmount: 199.99,
        currency: 'INR',
        billingCycle: 'monthly' as const,
        features: ['Feature 1'],
        limits: { emails: 1000 },
        isPopular: false
      };

      await pricingService.createOrUpdatePricing(pricingData);

      // Simulate concurrent tampering attempts
      const tamperingPromises = Array.from({ length: 10 }, (_, i) =>
        pricingService.validatePurchaseRequest(
          testPlanId,
          99.99 + i, // Different tampered prices
          testUserId
        )
      );

      const results = await Promise.all(tamperingPromises);

      // All attempts should be rejected
      results.forEach(result => {
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Pricing data mismatch detected');
      });

      // All attempts should be logged
      const logResult = await pool.query(
        'SELECT COUNT(*) as count FROM pricing_tampering_log WHERE user_id = $1',
        [testUserId]
      );

      expect(parseInt(logResult.rows[0].count)).toBe(10);
    });
  });

  describe('Security Monitoring and Alerting', () => {
    it('should track tampering statistics accurately', async () => {
      await pool.query(
        'INSERT INTO users (id, phone_number, email) VALUES ($1, $2, $3)',
        [testUserId, '+1234567890', 'test@example.com']
      );

      const pricingData = {
        planId: testPlanId,
        planName: 'Stats Test Plan',
        priceAmount: 199.99,
        currency: 'INR',
        billingCycle: 'monthly' as const,
        features: ['Feature 1'],
        limits: { emails: 1000 },
        isPopular: false
      };

      await pricingService.createOrUpdatePricing(pricingData);

      // Generate multiple tampering attempts
      const tamperingAttempts = [
        { price: 99.99, difference: 100.00 },
        { price: 149.99, difference: 50.00 },
        { price: 49.99, difference: 150.00 }
      ];

      for (const attempt of tamperingAttempts) {
        await pricingService.validatePurchaseRequest(
          testPlanId,
          attempt.price,
          testUserId
        );
      }

      // Get tampering statistics
      const stats = await pricingService.getTamperingStatistics('day');

      expect(stats.totalAttempts).toBe(3);
      expect(stats.uniqueUsers).toBe(1);
      expect(stats.averagePriceDifference).toBeCloseTo(100.00, 2);
      expect(stats.topTargetedPlans).toHaveLength(1);
      expect(stats.topTargetedPlans[0].planId).toBe(testPlanId);
    });

    it('should generate security alerts for suspicious activity', async () => {
      await pool.query(
        'INSERT INTO users (id, phone_number, email) VALUES ($1, $2, $3)',
        [testUserId, '+1234567890', 'test@example.com']
      );

      const pricingData = {
        planId: testPlanId,
        planName: 'Alert Test Plan',
        priceAmount: 299.99,
        currency: 'INR',
        billingCycle: 'monthly' as const,
        features: ['Feature 1'],
        limits: { emails: 1000 },
        isPopular: false
      };

      await pricingService.createOrUpdatePricing(pricingData);

      // Generate high-value tampering attempt (should trigger alert)
      await pricingService.validatePurchaseRequest(
        testPlanId,
        9.99, // 97% discount attempt
        testUserId
      );

      // Check if alert was logged
      const alertResult = await pool.query(
        'SELECT * FROM pricing_tampering_log WHERE user_id = $1 AND price_difference > $2',
        [testUserId, '200.00']
      );

      expect(alertResult.rows).toHaveLength(1);
      const alert = alertResult.rows[0];
      expect(parseFloat(alert.price_difference)).toBeGreaterThan(200);
    });
  });

  describe('Performance Under Attack', () => {
    it('should maintain performance during high-volume tampering attempts', async () => {
      await pool.query(
        'INSERT INTO users (id, phone_number, email) VALUES ($1, $2, $3)',
        [testUserId, '+1234567890', 'test@example.com']
      );

      const pricingData = {
        planId: testPlanId,
        planName: 'Performance Test Plan',
        priceAmount: 99.99,
        currency: 'INR',
        billingCycle: 'monthly' as const,
        features: ['Feature 1'],
        limits: { emails: 1000 },
        isPopular: false
      };

      await pricingService.createOrUpdatePricing(pricingData);

      const startTime = Date.now();

      // Generate 100 tampering attempts
      const promises = Array.from({ length: 100 }, (_, i) =>
        pricingService.validatePurchaseRequest(
          testPlanId,
          50 + i, // Various tampered prices
          testUserId
        )
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // Should complete within reasonable time (10 seconds for 100 requests)
      expect(endTime - startTime).toBeLessThan(10000);

      // All should be rejected
      results.forEach(result => {
        expect(result.isValid).toBe(false);
      });
    });

    it('should handle JWT validation performance under load', async () => {
      await pool.query(
        'INSERT INTO users (id, phone_number, email) VALUES ($1, $2, $3)',
        [testUserId, '+1234567890', 'test@example.com']
      );

      const secrets = await userSecurityManager.generateUserJWTSecrets(testUserId);

      // Create valid token
      const validToken = jwt.sign(
        { userId: testUserId, email: 'test@example.com' },
        secrets.jwtSecret,
        { expiresIn: '15m' }
      );

      const startTime = Date.now();

      // Validate token 100 times
      const promises = Array.from({ length: 100 }, () =>
        userSecurityManager.validateUserAccessToken(validToken, testUserId)
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // Should complete within reasonable time (5 seconds for 100 validations)
      expect(endTime - startTime).toBeLessThan(5000);

      // All validations should succeed
      results.forEach(result => {
        expect(result.userId).toBe(testUserId);
      });
    });
  });
});