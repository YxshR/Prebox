/**
 * Database Operations Integration Tests
 * Tests database operations with real database connections
 */

import { DatabaseService } from '../../database/database.service';
import { TestDataSeeder } from '../utils/test-data-seeder';
import { TestCleanup } from '../utils/test-cleanup';

describe('Database Operations Integration Tests', () => {
  let dbService: DatabaseService;
  let seeder: TestDataSeeder;
  let cleanup: TestCleanup;

  beforeAll(async () => {
    dbService = new DatabaseService();
    seeder = new TestDataSeeder(dbService);
    cleanup = new TestCleanup(dbService);
    
    await dbService.connect();
    await seeder.seedTestData();
  });

  afterAll(async () => {
    await cleanup.cleanupAll();
    await dbService.disconnect();
  });

  afterEach(async () => {
    await cleanup.cleanupUserData();
  });

  describe('User Operations', () => {
    it('should create user with unique constraints', async () => {
      const userData = {
        email: 'unique@example.com',
        phone: '+1234567890',
        password: 'TestPass123!'
      };

      const user = await seeder.createUser(userData);

      expect(user).toMatchObject({
        email: userData.email,
        phone: userData.phone,
        phone_verified: false,
        email_verified: false
      });
      expect(user.id).toBeDefined();
      expect(user.created_at).toBeDefined();
    });

    it('should enforce unique email constraint', async () => {
      const email = 'duplicate@example.com';
      
      await seeder.createUser({ email });

      await expect(seeder.createUser({ email }))
        .rejects.toThrow(/duplicate key value violates unique constraint/);
    });

    it('should enforce unique phone constraint', async () => {
      const phone = '+1987654321';
      
      await seeder.createUser({ phone });

      await expect(seeder.createUser({ phone }))
        .rejects.toThrow(/duplicate key value violates unique constraint/);
    });

    it('should enforce unique auth0_id constraint', async () => {
      const auth0Id = 'auth0|test123';
      
      await seeder.createUser({ auth0Id });

      await expect(seeder.createUser({ auth0Id }))
        .rejects.toThrow(/duplicate key value violates unique constraint/);
    });

    it('should update user verification status', async () => {
      const user = await seeder.createUser({
        email: 'verify@example.com',
        phoneVerified: false,
        emailVerified: false
      });

      // Update phone verification
      await dbService.query(
        'UPDATE users SET phone_verified = TRUE WHERE id = $1',
        [user.id]
      );

      // Update email verification
      await dbService.query(
        'UPDATE users SET email_verified = TRUE WHERE id = $1',
        [user.id]
      );

      // Verify updates
      const updatedUser = await dbService.query(
        'SELECT * FROM users WHERE id = $1',
        [user.id]
      );

      expect(updatedUser.rows[0]).toMatchObject({
        phone_verified: true,
        email_verified: true
      });
    });

    it('should handle user deletion with cascading', async () => {
      const user = await seeder.createUser({ email: 'cascade@example.com' });
      
      // Create related records
      await seeder.createAuth0Profile(user.id, 'auth0|cascade', {});
      await seeder.createUserSession(user.id, 'test-token', 'test-refresh');

      // Delete user
      await dbService.query('DELETE FROM users WHERE id = $1', [user.id]);

      // Verify cascading deletion
      const profileCheck = await dbService.query(
        'SELECT * FROM auth0_profiles WHERE user_id = $1',
        [user.id]
      );
      expect(profileCheck.rows).toHaveLength(0);

      const sessionCheck = await dbService.query(
        'SELECT * FROM user_sessions WHERE user_id = $1',
        [user.id]
      );
      expect(sessionCheck.rows).toHaveLength(0);
    });
  });

  describe('Verification Operations', () => {
    it('should create and manage phone verifications', async () => {
      const phone = '+1555123456';
      const otp = '123456';

      const verification = await seeder.createPhoneVerification(phone, otp);

      expect(verification).toMatchObject({
        phone,
        otp_code: otp,
        verified_at: null,
        attempts: 0
      });
      expect(verification.expires_at).toBeInstanceOf(Date);
    });

    it('should create and manage email verifications', async () => {
      const email = 'verify@example.com';
      const code = '654321';

      const verification = await seeder.createEmailVerification(email, code);

      expect(verification).toMatchObject({
        email,
        verification_code: code,
        verified_at: null
      });
      expect(verification.expires_at).toBeInstanceOf(Date);
    });

    it('should update verification status when verified', async () => {
      const phone = '+1555987654';
      const verification = await seeder.createPhoneVerification(phone);

      // Mark as verified
      await dbService.query(
        'UPDATE phone_verifications SET verified_at = NOW(), attempts = attempts + 1 WHERE id = $1',
        [verification.id]
      );

      const updated = await dbService.query(
        'SELECT * FROM phone_verifications WHERE id = $1',
        [verification.id]
      );

      expect(updated.rows[0].verified_at).toBeTruthy();
      expect(updated.rows[0].attempts).toBe(1);
    });

    it('should clean up expired verifications', async () => {
      const phone = '+1555000000';
      
      // Create expired verification
      await dbService.query(`
        INSERT INTO phone_verifications (phone, otp_code, expires_at)
        VALUES ($1, $2, $3)
      `, [phone, '123456', new Date(Date.now() - 60000)]); // 1 minute ago

      // Clean up expired
      await dbService.query('DELETE FROM phone_verifications WHERE expires_at < NOW()');

      const remaining = await dbService.query(
        'SELECT * FROM phone_verifications WHERE phone = $1',
        [phone]
      );
      expect(remaining.rows).toHaveLength(0);
    });
  });

  describe('Session Management', () => {
    it('should create and manage user sessions', async () => {
      const user = await seeder.createUser({ email: 'session@example.com' });
      const accessToken = 'test-access-token';
      const refreshToken = 'test-refresh-token';

      const session = await seeder.createUserSession(user.id, accessToken, refreshToken);

      expect(session).toMatchObject({
        user_id: user.id,
        jwt_token: accessToken,
        refresh_token: refreshToken
      });
      expect(session.expires_at).toBeInstanceOf(Date);
    });

    it('should handle multiple sessions per user', async () => {
      const user = await seeder.createUser({ email: 'multisession@example.com' });

      await seeder.createUserSession(user.id, 'token1', 'refresh1');
      await seeder.createUserSession(user.id, 'token2', 'refresh2');

      const sessions = await dbService.query(
        'SELECT * FROM user_sessions WHERE user_id = $1',
        [user.id]
      );

      expect(sessions.rows).toHaveLength(2);
    });

    it('should invalidate expired sessions', async () => {
      const user = await seeder.createUser({ email: 'expired@example.com' });

      // Create expired session
      await dbService.query(`
        INSERT INTO user_sessions (user_id, jwt_token, refresh_token, expires_at)
        VALUES ($1, $2, $3, $4)
      `, [user.id, 'expired-token', 'expired-refresh', new Date(Date.now() - 60000)]);

      // Query for valid sessions
      const validSessions = await dbService.query(
        'SELECT * FROM user_sessions WHERE user_id = $1 AND expires_at > NOW()',
        [user.id]
      );

      expect(validSessions.rows).toHaveLength(0);
    });
  });

  describe('Pricing Operations', () => {
    it('should create and retrieve pricing plans', async () => {
      const planData = {
        name: 'Test Plan',
        price: 19.99,
        features: ['Feature 1', 'Feature 2'],
        limits: { emails: 1000, contacts: 500 }
      };

      const plan = await seeder.createPricingPlan(planData);

      expect(plan).toMatchObject({
        name: planData.name,
        price: planData.price.toString(), // Decimal comes back as string
        active: true
      });

      // Verify JSON fields
      const features = JSON.parse(plan.features);
      const limits = JSON.parse(plan.limits);
      expect(features).toEqual(planData.features);
      expect(limits).toEqual(planData.limits);
    });

    it('should retrieve active pricing plans', async () => {
      await seeder.createPricingPlan({
        name: 'Active Plan',
        price: 29.99,
        features: ['Active Feature'],
        limits: { emails: 2000 },
        active: true
      });

      await seeder.createPricingPlan({
        name: 'Inactive Plan',
        price: 39.99,
        features: ['Inactive Feature'],
        limits: { emails: 3000 },
        active: false
      });

      const activePlans = await dbService.query(
        'SELECT * FROM pricing_plans WHERE active = TRUE'
      );

      expect(activePlans.rows.length).toBeGreaterThan(0);
      activePlans.rows.forEach(plan => {
        expect(plan.active).toBe(true);
      });
    });

    it('should handle pricing plan updates', async () => {
      const plan = await seeder.createPricingPlan({
        name: 'Update Plan',
        price: 49.99,
        features: ['Original Feature'],
        limits: { emails: 4000 }
      });

      // Update plan
      await dbService.query(`
        UPDATE pricing_plans 
        SET price = $1, features = $2 
        WHERE id = $3
      `, [59.99, JSON.stringify(['Updated Feature']), plan.id]);

      const updated = await dbService.query(
        'SELECT * FROM pricing_plans WHERE id = $1',
        [plan.id]
      );

      expect(updated.rows[0].price).toBe('59.99');
      expect(JSON.parse(updated.rows[0].features)).toEqual(['Updated Feature']);
    });
  });

  describe('Database Performance', () => {
    it('should handle concurrent user creation', async () => {
      const promises = Array(10).fill(null).map((_, i) =>
        seeder.createUser({
          email: `concurrent${i}@example.com`,
          phone: `+155512345${i.toString().padStart(2, '0')}`
        })
      );

      const users = await Promise.all(promises);
      expect(users).toHaveLength(10);
      
      // Verify all users were created
      const userCount = await dbService.query(
        'SELECT COUNT(*) FROM users WHERE email LIKE $1',
        ['concurrent%@example.com']
      );
      expect(parseInt(userCount.rows[0].count)).toBe(10);
    });

    it('should handle large batch operations efficiently', async () => {
      const startTime = Date.now();
      
      // Create 100 users
      const users = await seeder.createMultipleUsers(100, {
        email: 'batch@example.com'
      });
      
      const duration = Date.now() - startTime;
      
      expect(users).toHaveLength(100);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should use indexes effectively for lookups', async () => {
      // Create test data
      await seeder.createMultipleUsers(50);

      const startTime = Date.now();

      // Perform indexed lookups
      await Promise.all([
        dbService.query('SELECT * FROM users WHERE email = $1', ['test@example.com']),
        dbService.query('SELECT * FROM users WHERE phone = $1', ['+1234567890']),
        dbService.query('SELECT * FROM users WHERE auth0_id = $1', ['auth0|test'])
      ]);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should be very fast with indexes
    });
  });

  describe('Transaction Handling', () => {
    it('should handle transaction rollback on error', async () => {
      const client = await dbService.getClient();
      
      try {
        await client.query('BEGIN');
        
        // Create user
        const userResult = await client.query(`
          INSERT INTO users (email, phone) 
          VALUES ($1, $2) 
          RETURNING id
        `, ['transaction@example.com', '+1555000001']);
        
        const userId = userResult.rows[0].id;
        
        // Try to create duplicate (should fail)
        await client.query(`
          INSERT INTO users (email, phone) 
          VALUES ($1, $2)
        `, ['transaction@example.com', '+1555000002']);
        
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
      } finally {
        client.release();
      }

      // Verify no user was created due to rollback
      const userCheck = await dbService.query(
        'SELECT * FROM users WHERE email = $1',
        ['transaction@example.com']
      );
      expect(userCheck.rows).toHaveLength(0);
    });

    it('should handle successful transaction commit', async () => {
      const client = await dbService.getClient();
      let userId: string;
      
      try {
        await client.query('BEGIN');
        
        // Create user
        const userResult = await client.query(`
          INSERT INTO users (email, phone, phone_verified, email_verified) 
          VALUES ($1, $2, $3, $4) 
          RETURNING id
        `, ['success@example.com', '+1555000003', true, true]);
        
        userId = userResult.rows[0].id;
        
        // Create session
        await client.query(`
          INSERT INTO user_sessions (user_id, jwt_token, refresh_token, expires_at)
          VALUES ($1, $2, $3, $4)
        `, [userId, 'success-token', 'success-refresh', new Date(Date.now() + 86400000)]);
        
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      // Verify both records were created
      const userCheck = await dbService.query(
        'SELECT * FROM users WHERE email = $1',
        ['success@example.com']
      );
      expect(userCheck.rows).toHaveLength(1);

      const sessionCheck = await dbService.query(
        'SELECT * FROM user_sessions WHERE user_id = $1',
        [userId]
      );
      expect(sessionCheck.rows).toHaveLength(1);
    });
  });
});