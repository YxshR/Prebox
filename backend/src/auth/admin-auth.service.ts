import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, UserRole, AuthToken, LoginCredentials } from '../shared/types';
import { DatabaseService } from '../database/database.service';

export class AdminAuthService {
  private db: DatabaseService;
  private jwtSecret: string;
  private jwtRefreshSecret: string;

  constructor() {
    this.db = new DatabaseService();
    this.jwtSecret = process.env.JWT_SECRET || 'admin-jwt-secret';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'admin-jwt-refresh-secret';
  }

  async login(credentials: LoginCredentials): Promise<AuthToken> {
    const { email, password } = credentials;

    // Find admin user
    const user = await this.db.query(
      `SELECT u.*, t.name as tenant_name 
       FROM users u 
       LEFT JOIN tenants t ON u.tenant_id = t.id 
       WHERE u.email = $1 AND u.role IN ('admin', 'super_admin')`,
      [email]
    );

    if (!user.rows.length) {
      throw new Error('Invalid admin credentials');
    }

    const adminUser = user.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, adminUser.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid admin credentials');
    }

    // Update last login
    await this.db.query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [adminUser.id]
    );

    // Generate tokens
    const accessToken = this.generateAccessToken(adminUser);
    const refreshToken = this.generateRefreshToken(adminUser);

    // Store refresh token
    await this.db.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) 
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET 
       token = $2, expires_at = $3, created_at = NOW()`,
      [adminUser.id, refreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 3600, // 1 hour
      user: this.mapDbUserToUser(adminUser)
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthToken> {
    try {
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret) as any;
      
      // Verify refresh token exists in database
      const tokenResult = await this.db.query(
        'SELECT * FROM refresh_tokens WHERE user_id = $1 AND token = $2 AND expires_at > NOW()',
        [decoded.userId, refreshToken]
      );

      if (!tokenResult.rows.length) {
        throw new Error('Invalid refresh token');
      }

      // Get user
      const userResult = await this.db.query(
        `SELECT u.*, t.name as tenant_name 
         FROM users u 
         LEFT JOIN tenants t ON u.tenant_id = t.id 
         WHERE u.id = $1 AND u.role IN ('admin', 'super_admin')`,
        [decoded.userId]
      );

      if (!userResult.rows.length) {
        throw new Error('Admin user not found');
      }

      const adminUser = userResult.rows[0];

      // Generate new tokens
      const newAccessToken = this.generateAccessToken(adminUser);
      const newRefreshToken = this.generateRefreshToken(adminUser);

      // Update refresh token
      await this.db.query(
        'UPDATE refresh_tokens SET token = $1, expires_at = $2 WHERE user_id = $3',
        [newRefreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), adminUser.id]
      );

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 3600,
        user: this.mapDbUserToUser(adminUser)
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  async logout(userId: string): Promise<void> {
    await this.db.query(
      'DELETE FROM refresh_tokens WHERE user_id = $1',
      [userId]
    );
  }

  async validateToken(token: string): Promise<User> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as any;
      
      const userResult = await this.db.query(
        `SELECT u.*, t.name as tenant_name 
         FROM users u 
         LEFT JOIN tenants t ON u.tenant_id = t.id 
         WHERE u.id = $1 AND u.role IN ('admin', 'super_admin')`,
        [decoded.userId]
      );

      if (!userResult.rows.length) {
        throw new Error('Admin user not found');
      }

      return this.mapDbUserToUser(userResult.rows[0]);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  private generateAccessToken(user: any): string {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id
      },
      this.jwtSecret,
      { expiresIn: '1h' }
    );
  }

  private generateRefreshToken(user: any): string {
    return jwt.sign(
      {
        userId: user.id,
        type: 'refresh'
      },
      this.jwtRefreshSecret,
      { expiresIn: '7d' }
    );
  }

  private mapDbUserToUser(dbUser: any): User {
    return {
      id: dbUser.id,
      email: dbUser.email,
      phone: dbUser.phone,
      firstName: dbUser.first_name,
      lastName: dbUser.last_name,
      tenantId: dbUser.tenant_id,
      role: dbUser.role as UserRole,
      subscriptionTier: dbUser.subscription_tier,
      isEmailVerified: dbUser.is_email_verified,
      isPhoneVerified: dbUser.is_phone_verified,
      googleId: dbUser.google_id,
      createdAt: dbUser.created_at,
      lastLoginAt: dbUser.last_login_at
    };
  }
}