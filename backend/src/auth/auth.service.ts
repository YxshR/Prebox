import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database';
import redisClient from '../config/redis';
import { UserSecurityManager } from './user-security-manager.service';
import { 
  User, 
  UserRegistration, 
  LoginCredentials, 
  AuthToken, 
  ApiKey,
  SubscriptionTier,
  UserRole 
} from '../shared/types';

export class AuthService {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
  private readonly JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';
  private readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
  private readonly JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
  private userSecurityManager: UserSecurityManager;

  constructor() {
    this.userSecurityManager = new UserSecurityManager();
  }

  async register(userData: UserRegistration): Promise<User> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check if user already exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [userData.email]
      );

      if (existingUser.rows.length > 0) {
        throw new Error('User already exists with this email');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      
      // Generate user ID and tenant ID
      const userId = uuidv4();
      const tenantId = uuidv4();

      // Generate JWT secrets for the new user
      const jwtSecrets = await this.userSecurityManager.generateUserJWTSecrets(userId);

      // Insert user
      const userResult = await client.query(`
        INSERT INTO users (
          id, email, phone, first_name, last_name, password_hash, 
          tenant_id, role, subscription_tier, is_email_verified, 
          is_phone_verified, jwt_secret, jwt_refresh_secret, created_at, last_login_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `, [
        userId,
        userData.email,
        userData.phone || null,
        userData.firstName || null,
        userData.lastName || null,
        hashedPassword,
        tenantId,
        UserRole.USER,
        SubscriptionTier.FREE,
        false,
        false,
        jwtSecrets.jwtSecret,
        jwtSecrets.jwtRefreshSecret,
        new Date(),
        null
      ]);

      // Create tenant record
      await client.query(`
        INSERT INTO tenants (id, name, created_at)
        VALUES ($1, $2, $3)
      `, [tenantId, userData.email, new Date()]);

      // Create default subscription
      await client.query(`
        INSERT INTO subscriptions (
          id, tenant_id, plan_id, status, current_period_start, 
          current_period_end, daily_email_limit, monthly_recipient_limit,
          monthly_email_limit, template_limit, custom_domain_limit,
          recharge_balance, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        uuidv4(),
        tenantId,
        'free',
        'active',
        new Date(),
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        100, // Free tier: 100 emails/day
        300, // Free tier: 300 recipients/month
        2000, // Free tier: 2000 emails/month
        1, // Free tier: 1 AI template/day
        0, // Free tier: no custom domains
        0, // No recharge balance
        new Date()
      ]);

      await client.query('COMMIT');

      const user = this.mapRowToUser(userResult.rows[0]);
      return user;

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async login(credentials: LoginCredentials): Promise<AuthToken> {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [credentials.email]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = this.mapRowToUser(result.rows[0]);
    
    // Handle Auth0 users (they don't have passwords)
    if (user.auth0Id && !credentials.password) {
      // Auth0 user login - skip password validation
    } else if (user.auth0Id && credentials.password) {
      throw new Error('This account uses Auth0 authentication. Please login through Auth0.');
    } else {
      // Regular user - validate password
      if (!result.rows[0].password_hash) {
        throw new Error('Invalid credentials');
      }
      
      const isPasswordValid = await bcrypt.compare(credentials.password, result.rows[0].password_hash);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }
    }

    // Update last login
    await pool.query(
      'UPDATE users SET last_login_at = $1 WHERE id = $2',
      [new Date(), user.id]
    );

    // Ensure user has JWT secrets (for existing users who might not have them)
    await this.userSecurityManager.ensureUserJWTSecrets(user.id);

    // Generate tokens using user-specific secrets
    const accessToken = await this.userSecurityManager.generateUserAccessToken(user);
    const refreshToken = await this.userSecurityManager.generateUserRefreshToken(user);

    // Store refresh token in Redis
    await redisClient.setEx(`refresh_token:${user.id}`, 7 * 24 * 60 * 60, refreshToken);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15 minutes
      user: { ...user, lastLoginAt: new Date() }
    };
  }

  async generateApiKey(userId: string, scopes: string[], name: string): Promise<ApiKey> {
    const apiKeyId = uuidv4();
    const key = `bep_${Buffer.from(uuidv4()).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)}`;

    const result = await pool.query(`
      INSERT INTO api_keys (id, user_id, key_hash, name, scopes, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      apiKeyId,
      userId,
      await bcrypt.hash(key, 10),
      name,
      JSON.stringify(scopes),
      true,
      new Date()
    ]);

    return {
      id: apiKeyId,
      userId,
      key, // Return the plain key only once
      name,
      scopes,
      isActive: true,
      createdAt: new Date(),
    };
  }

  async validateToken(token: string): Promise<User> {
    try {
      // Use UserSecurityManager to validate with user-specific secret
      const decoded = await this.userSecurityManager.validateTokenWithUserLookup(token);
      
      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      return this.mapRowToUser(result.rows[0]);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async validateApiKey(apiKey: string): Promise<User> {
    // Get all API keys and check hash (in production, consider indexing strategy)
    const result = await pool.query(`
      SELECT ak.*, u.* FROM api_keys ak
      JOIN users u ON ak.user_id = u.id
      WHERE ak.is_active = true
    `);

    for (const row of result.rows) {
      const isValid = await bcrypt.compare(apiKey, row.key_hash);
      if (isValid) {
        // Update last used timestamp
        await pool.query(
          'UPDATE api_keys SET last_used_at = $1 WHERE id = $2',
          [new Date(), row.id]
        );

        return this.mapRowToUser(row);
      }
    }

    throw new Error('Invalid API key');
  }

  async refreshToken(refreshToken: string): Promise<AuthToken> {
    try {
      // First decode to get user ID
      const unverifiedDecoded = jwt.decode(refreshToken) as any;
      if (!unverifiedDecoded || !unverifiedDecoded.userId) {
        throw new Error('Invalid refresh token format');
      }

      // Validate with user-specific refresh secret
      const decoded = await this.userSecurityManager.validateUserRefreshToken(refreshToken, unverifiedDecoded.userId);
      
      // Check if refresh token exists in Redis
      const storedToken = await redisClient.get(`refresh_token:${decoded.userId}`);
      if (storedToken !== refreshToken) {
        throw new Error('Invalid refresh token');
      }

      const result = await pool.query(
        'SELECT * FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = this.mapRowToUser(result.rows[0]);
      
      // Generate new tokens using user-specific secrets
      const newAccessToken = await this.userSecurityManager.generateUserAccessToken(user);
      const newRefreshToken = await this.userSecurityManager.generateUserRefreshToken(user);

      // Update refresh token in Redis
      await redisClient.setEx(`refresh_token:${user.id}`, 7 * 24 * 60 * 60, newRefreshToken);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 15 * 60,
        user
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    // Remove refresh token from Redis
    await redisClient.del(`refresh_token:${userId}`);
  }



  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      phone: row.phone,
      firstName: row.first_name,
      lastName: row.last_name,
      tenantId: row.tenant_id,
      role: row.role as UserRole,
      subscriptionTier: row.subscription_tier as SubscriptionTier,
      isEmailVerified: row.is_email_verified,
      isPhoneVerified: row.is_phone_verified,
      googleId: row.google_id,
      auth0Id: row.auth0_id,
      createdAt: new Date(row.created_at),
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : new Date()
    };
  }
}