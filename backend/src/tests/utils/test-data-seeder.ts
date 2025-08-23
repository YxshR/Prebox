/**
 * Test Data Seeder
 * Provides utilities for seeding test data
 */

import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';

export interface TestUser {
  id?: string;
  email?: string;
  phone?: string;
  password?: string;
  auth0Id?: string;
  phoneVerified?: boolean;
  emailVerified?: boolean;
  name?: string;
}

export interface TestPricingPlan {
  id?: string;
  name: string;
  price: number;
  features: string[];
  limits: Record<string, number>;
  active?: boolean;
}

export class TestDataSeeder {
  constructor(private dbService: DatabaseService) {}

  async seedTestData(): Promise<void> {
    await this.createTestTables();
    await this.seedBasicPricingData();
  }

  private async createTestTables(): Promise<void> {
    // Create users table if not exists
    await this.dbService.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(20) UNIQUE,
        password_hash VARCHAR(255),
        auth0_id VARCHAR(255) UNIQUE,
        phone_verified BOOLEAN DEFAULT FALSE,
        email_verified BOOLEAN DEFAULT FALSE,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        last_login TIMESTAMP
      )
    `);

    // Create phone_verifications table
    await this.dbService.query(`
      CREATE TABLE IF NOT EXISTS phone_verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone VARCHAR(20) NOT NULL,
        otp_code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        verified_at TIMESTAMP,
        attempts INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create email_verifications table
    await this.dbService.query(`
      CREATE TABLE IF NOT EXISTS email_verifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        verification_code VARCHAR(6) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        verified_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create auth0_profiles table
    await this.dbService.query(`
      CREATE TABLE IF NOT EXISTS auth0_profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        auth0_id VARCHAR(255) UNIQUE NOT NULL,
        profile_data JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create user_sessions table
    await this.dbService.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        jwt_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create pricing_plans table
    await this.dbService.query(`
      CREATE TABLE IF NOT EXISTS pricing_plans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        features JSONB NOT NULL,
        limits JSONB NOT NULL,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create indexes for better performance
    await this.dbService.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
      CREATE INDEX IF NOT EXISTS idx_users_auth0_id ON users(auth0_id);
      CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON phone_verifications(phone);
      CREATE INDEX IF NOT EXISTS idx_email_verifications_email ON email_verifications(email);
      CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_pricing_plans_active ON pricing_plans(active);
    `);
  }

  async createUser(userData: TestUser = {}): Promise<any> {
    const user = {
      id: userData.id || uuidv4(),
      email: userData.email || `test-${Date.now()}@example.com`,
      phone: userData.phone || `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
      password_hash: userData.password ? await bcrypt.hash(userData.password, 10) : null,
      auth0_id: userData.auth0Id || null,
      phone_verified: userData.phoneVerified || false,
      email_verified: userData.emailVerified || false,
      name: userData.name || 'Test User'
    };

    const result = await this.dbService.query(`
      INSERT INTO users (id, email, phone, password_hash, auth0_id, phone_verified, email_verified, name)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      user.id,
      user.email,
      user.phone,
      user.password_hash,
      user.auth0_id,
      user.phone_verified,
      user.email_verified,
      user.name
    ]);

    return result.rows[0];
  }

  async createPhoneVerification(phone: string, otp?: string): Promise<any> {
    const verification = {
      phone,
      otp_code: otp || Math.floor(100000 + Math.random() * 900000).toString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
    };

    const result = await this.dbService.query(`
      INSERT INTO phone_verifications (phone, otp_code, expires_at)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [verification.phone, verification.otp_code, verification.expires_at]);

    return result.rows[0];
  }

  async createEmailVerification(email: string, code?: string): Promise<any> {
    const verification = {
      email,
      verification_code: code || Math.floor(100000 + Math.random() * 900000).toString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    const result = await this.dbService.query(`
      INSERT INTO email_verifications (email, verification_code, expires_at)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [verification.email, verification.verification_code, verification.expires_at]);

    return result.rows[0];
  }

  async createAuth0Profile(userId: string, auth0Id: string, profileData: any = {}): Promise<any> {
    const defaultProfile = {
      name: 'Test User',
      email: 'test@example.com',
      picture: 'https://example.com/avatar.jpg',
      ...profileData
    };

    const result = await this.dbService.query(`
      INSERT INTO auth0_profiles (user_id, auth0_id, profile_data)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [userId, auth0Id, JSON.stringify(defaultProfile)]);

    return result.rows[0];
  }

  async createUserSession(userId: string, accessToken: string, refreshToken: string): Promise<any> {
    const session = {
      user_id: userId,
      jwt_token: accessToken,
      refresh_token: refreshToken,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    const result = await this.dbService.query(`
      INSERT INTO user_sessions (user_id, jwt_token, refresh_token, expires_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [session.user_id, session.jwt_token, session.refresh_token, session.expires_at]);

    return result.rows[0];
  }

  async seedBasicPricingData(): Promise<void> {
    const plans: TestPricingPlan[] = [
      {
        name: 'Free',
        price: 0,
        features: ['1,000 emails/month', 'Basic templates', 'Email support'],
        limits: { emails_per_month: 1000, templates: 5, contacts: 500 }
      },
      {
        name: 'Pro',
        price: 29.99,
        features: ['10,000 emails/month', 'Advanced templates', 'Priority support', 'Analytics'],
        limits: { emails_per_month: 10000, templates: 50, contacts: 5000 }
      },
      {
        name: 'Enterprise',
        price: 99.99,
        features: ['Unlimited emails', 'Custom templates', '24/7 support', 'Advanced analytics', 'API access'],
        limits: { emails_per_month: -1, templates: -1, contacts: -1 }
      }
    ];

    for (const plan of plans) {
      await this.createPricingPlan(plan);
    }
  }

  async seedPricingData(): Promise<void> {
    // Clear existing pricing data
    await this.dbService.query('DELETE FROM pricing_plans');
    await this.seedBasicPricingData();
  }

  async createPricingPlan(planData: TestPricingPlan): Promise<any> {
    const plan = {
      id: planData.id || uuidv4(),
      name: planData.name,
      price: planData.price,
      features: JSON.stringify(planData.features),
      limits: JSON.stringify(planData.limits),
      active: planData.active !== undefined ? planData.active : true
    };

    const result = await this.dbService.query(`
      INSERT INTO pricing_plans (id, name, price, features, limits, active)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (name) DO UPDATE SET
        price = EXCLUDED.price,
        features = EXCLUDED.features,
        limits = EXCLUDED.limits,
        active = EXCLUDED.active
      RETURNING *
    `, [plan.id, plan.name, plan.price, plan.features, plan.limits, plan.active]);

    return result.rows[0];
  }

  async createMultipleUsers(count: number, baseData: Partial<TestUser> = {}): Promise<any[]> {
    const users = [];
    for (let i = 0; i < count; i++) {
      const userData = {
        ...baseData,
        email: baseData.email ? `${i}-${baseData.email}` : undefined,
        phone: baseData.phone ? `${baseData.phone}${i}` : undefined
      };
      users.push(await this.createUser(userData));
    }
    return users;
  }

  async seedDemoData(): Promise<{
    users: any[];
    pricingPlans: any[];
  }> {
    // Create demo users
    const users = await Promise.all([
      this.createUser({
        email: 'demo@example.com',
        phone: '+1234567890',
        password: 'DemoPass123!',
        phoneVerified: true,
        emailVerified: true,
        name: 'Demo User'
      }),
      this.createUser({
        email: 'auth0demo@example.com',
        auth0Id: 'auth0|demo123',
        phoneVerified: true,
        emailVerified: true,
        name: 'Auth0 Demo User'
      }),
      this.createUser({
        email: 'phoneuser@example.com',
        phone: '+1987654321',
        phoneVerified: true,
        emailVerified: false,
        name: 'Phone User'
      })
    ]);

    // Create demo pricing plans
    await this.seedBasicPricingData();
    const pricingPlans = await this.dbService.query('SELECT * FROM pricing_plans ORDER BY price');

    return {
      users,
      pricingPlans: pricingPlans.rows
    };
  }

  async getTestUserByEmail(email: string): Promise<any> {
    const result = await this.dbService.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  async getTestUserByPhone(phone: string): Promise<any> {
    const result = await this.dbService.query(
      'SELECT * FROM users WHERE phone = $1',
      [phone]
    );
    return result.rows[0];
  }

  async getLatestPhoneVerification(phone: string): Promise<any> {
    const result = await this.dbService.query(
      'SELECT * FROM phone_verifications WHERE phone = $1 ORDER BY created_at DESC LIMIT 1',
      [phone]
    );
    return result.rows[0];
  }

  async getLatestEmailVerification(email: string): Promise<any> {
    const result = await this.dbService.query(
      'SELECT * FROM email_verifications WHERE email = $1 ORDER BY created_at DESC LIMIT 1',
      [email]
    );
    return result.rows[0];
  }
}