/**
 * Test Cleanup Utilities
 * Provides utilities for cleaning up test data
 */

import { DatabaseService } from '../../database/database.service';

export class TestCleanup {
  constructor(private dbService: DatabaseService) {}

  async cleanupAll(): Promise<void> {
    await this.cleanupUserData();
    await this.cleanupVerificationData();
    await this.cleanupSessionData();
    await this.cleanupPricingData();
  }

  async cleanupUserData(): Promise<void> {
    try {
      // Clean up in correct order due to foreign key constraints
      await this.dbService.query('DELETE FROM auth0_profiles WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%test%']);
      await this.dbService.query('DELETE FROM user_sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE $1)', ['%test%']);
      await this.dbService.query('DELETE FROM users WHERE email LIKE $1 OR phone LIKE $2', ['%test%', '%test%']);
      await this.dbService.query('DELETE FROM users WHERE email LIKE $1 OR email LIKE $2', ['%example.com%', '%demo%']);
    } catch (error) {
      console.warn('Error cleaning up user data:', error);
    }
  }

  async cleanupVerificationData(): Promise<void> {
    try {
      await this.dbService.query('DELETE FROM phone_verifications WHERE phone LIKE $1', ['%test%']);
      await this.dbService.query('DELETE FROM phone_verifications WHERE phone LIKE $1', ['+1%']);
      await this.dbService.query('DELETE FROM email_verifications WHERE email LIKE $1', ['%test%']);
      await this.dbService.query('DELETE FROM email_verifications WHERE email LIKE $1', ['%example.com%']);
    } catch (error) {
      console.warn('Error cleaning up verification data:', error);
    }
  }

  async cleanupSessionData(): Promise<void> {
    try {
      await this.dbService.query('DELETE FROM user_sessions WHERE expires_at < NOW()');
      await this.dbService.query('DELETE FROM user_sessions WHERE jwt_token LIKE $1', ['%test%']);
    } catch (error) {
      console.warn('Error cleaning up session data:', error);
    }
  }

  async cleanupPricingData(): Promise<void> {
    try {
      // Only clean up test pricing data, keep default plans
      await this.dbService.query('DELETE FROM pricing_plans WHERE name LIKE $1', ['%test%']);
    } catch (error) {
      console.warn('Error cleaning up pricing data:', error);
    }
  }

  async cleanupExpiredData(): Promise<void> {
    try {
      // Clean up expired verifications
      await this.dbService.query('DELETE FROM phone_verifications WHERE expires_at < NOW()');
      await this.dbService.query('DELETE FROM email_verifications WHERE expires_at < NOW()');
      
      // Clean up expired sessions
      await this.dbService.query('DELETE FROM user_sessions WHERE expires_at < NOW()');
    } catch (error) {
      console.warn('Error cleaning up expired data:', error);
    }
  }

  async cleanupUserByEmail(email: string): Promise<void> {
    try {
      const userResult = await this.dbService.query('SELECT id FROM users WHERE email = $1', [email]);
      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;
        
        // Clean up related data first
        await this.dbService.query('DELETE FROM auth0_profiles WHERE user_id = $1', [userId]);
        await this.dbService.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
        await this.dbService.query('DELETE FROM users WHERE id = $1', [userId]);
      }
      
      // Clean up verification data
      await this.dbService.query('DELETE FROM email_verifications WHERE email = $1', [email]);
    } catch (error) {
      console.warn(`Error cleaning up user by email ${email}:`, error);
    }
  }

  async cleanupUserByPhone(phone: string): Promise<void> {
    try {
      const userResult = await this.dbService.query('SELECT id FROM users WHERE phone = $1', [phone]);
      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;
        
        // Clean up related data first
        await this.dbService.query('DELETE FROM auth0_profiles WHERE user_id = $1', [userId]);
        await this.dbService.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
        await this.dbService.query('DELETE FROM users WHERE id = $1', [userId]);
      }
      
      // Clean up verification data
      await this.dbService.query('DELETE FROM phone_verifications WHERE phone = $1', [phone]);
    } catch (error) {
      console.warn(`Error cleaning up user by phone ${phone}:`, error);
    }
  }

  async cleanupAuth0User(auth0Id: string): Promise<void> {
    try {
      const userResult = await this.dbService.query('SELECT id FROM users WHERE auth0_id = $1', [auth0Id]);
      if (userResult.rows.length > 0) {
        const userId = userResult.rows[0].id;
        
        // Clean up related data first
        await this.dbService.query('DELETE FROM auth0_profiles WHERE user_id = $1', [userId]);
        await this.dbService.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
        await this.dbService.query('DELETE FROM users WHERE id = $1', [userId]);
      }
    } catch (error) {
      console.warn(`Error cleaning up Auth0 user ${auth0Id}:`, error);
    }
  }

  async resetDatabase(): Promise<void> {
    try {
      // Drop all test tables and recreate them
      const tables = [
        'user_sessions',
        'auth0_profiles', 
        'email_verifications',
        'phone_verifications',
        'users',
        'pricing_plans'
      ];

      for (const table of tables) {
        await this.dbService.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
      }

      console.log('Database reset completed');
    } catch (error) {
      console.error('Error resetting database:', error);
      throw error;
    }
  }

  async truncateAllTables(): Promise<void> {
    try {
      // Truncate in correct order due to foreign key constraints
      await this.dbService.query('TRUNCATE TABLE user_sessions CASCADE');
      await this.dbService.query('TRUNCATE TABLE auth0_profiles CASCADE');
      await this.dbService.query('TRUNCATE TABLE email_verifications CASCADE');
      await this.dbService.query('TRUNCATE TABLE phone_verifications CASCADE');
      await this.dbService.query('TRUNCATE TABLE users CASCADE');
      await this.dbService.query('TRUNCATE TABLE pricing_plans CASCADE');
      
      console.log('All tables truncated');
    } catch (error) {
      console.warn('Error truncating tables:', error);
    }
  }

  async getCleanupStats(): Promise<{
    users: number;
    phoneVerifications: number;
    emailVerifications: number;
    sessions: number;
    auth0Profiles: number;
    pricingPlans: number;
  }> {
    try {
      const [users, phoneVerifications, emailVerifications, sessions, auth0Profiles, pricingPlans] = await Promise.all([
        this.dbService.query('SELECT COUNT(*) FROM users'),
        this.dbService.query('SELECT COUNT(*) FROM phone_verifications'),
        this.dbService.query('SELECT COUNT(*) FROM email_verifications'),
        this.dbService.query('SELECT COUNT(*) FROM user_sessions'),
        this.dbService.query('SELECT COUNT(*) FROM auth0_profiles'),
        this.dbService.query('SELECT COUNT(*) FROM pricing_plans')
      ]);

      return {
        users: parseInt(users.rows[0].count),
        phoneVerifications: parseInt(phoneVerifications.rows[0].count),
        emailVerifications: parseInt(emailVerifications.rows[0].count),
        sessions: parseInt(sessions.rows[0].count),
        auth0Profiles: parseInt(auth0Profiles.rows[0].count),
        pricingPlans: parseInt(pricingPlans.rows[0].count)
      };
    } catch (error) {
      console.warn('Error getting cleanup stats:', error);
      return {
        users: 0,
        phoneVerifications: 0,
        emailVerifications: 0,
        sessions: 0,
        auth0Profiles: 0,
        pricingPlans: 0
      };
    }
  }

  async cleanupTestDataOlderThan(hours: number = 24): Promise<void> {
    try {
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      // Clean up old test data
      await this.dbService.query(
        'DELETE FROM user_sessions WHERE created_at < $1 AND jwt_token LIKE $2',
        [cutoffTime, '%test%']
      );
      
      await this.dbService.query(
        'DELETE FROM phone_verifications WHERE created_at < $1',
        [cutoffTime]
      );
      
      await this.dbService.query(
        'DELETE FROM email_verifications WHERE created_at < $1',
        [cutoffTime]
      );
      
      await this.dbService.query(
        'DELETE FROM users WHERE created_at < $1 AND (email LIKE $2 OR email LIKE $3)',
        [cutoffTime, '%test%', '%example.com%']
      );
      
      console.log(`Cleaned up test data older than ${hours} hours`);
    } catch (error) {
      console.warn(`Error cleaning up old test data:`, error);
    }
  }
}