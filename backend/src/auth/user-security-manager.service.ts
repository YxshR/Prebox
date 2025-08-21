import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import pool from '../config/database';
import { User } from '../shared/types';

export interface JWTSecrets {
  jwtSecret: string;
  jwtRefreshSecret: string;
}

export interface UserTokenPayload {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
}

export class UserSecurityManager {
  private readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
  private readonly JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

  /**
   * Generate unique JWT secrets for a user
   * @param userId - The user ID to generate secrets for
   * @returns Promise<JWTSecrets> - The generated JWT secrets
   */
  async generateUserJWTSecrets(userId: string): Promise<JWTSecrets> {
    const jwtSecret = this.generateSecureSecret();
    const jwtRefreshSecret = this.generateSecureSecret();

    // Store secrets in database
    await pool.query(
      'UPDATE users SET jwt_secret = $1, jwt_refresh_secret = $2 WHERE id = $3',
      [jwtSecret, jwtRefreshSecret, userId]
    );

    return {
      jwtSecret,
      jwtRefreshSecret
    };
  }

  /**
   * Get JWT secrets for a specific user
   * @param userId - The user ID to get secrets for
   * @returns Promise<JWTSecrets> - The user's JWT secrets
   */
  async getUserJWTSecrets(userId: string): Promise<JWTSecrets> {
    const result = await pool.query(
      'SELECT jwt_secret, jwt_refresh_secret FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      throw new Error('User not found');
    }

    const row = result.rows[0];
    if (!row.jwt_secret || !row.jwt_refresh_secret) {
      throw new Error('User JWT secrets not found');
    }

    return {
      jwtSecret: row.jwt_secret,
      jwtRefreshSecret: row.jwt_refresh_secret
    };
  }

  /**
   * Generate access token using user-specific JWT secret
   * @param user - The user object
   * @returns Promise<string> - The generated access token
   */
  async generateUserAccessToken(user: User): Promise<string> {
    const secrets = await this.getUserJWTSecrets(user.id);
    
    const payload: UserTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId
    };

    return jwt.sign(payload, secrets.jwtSecret, { 
      expiresIn: this.JWT_EXPIRES_IN 
    } as jwt.SignOptions);
  }

  /**
   * Generate refresh token using user-specific JWT refresh secret
   * @param user - The user object
   * @returns Promise<string> - The generated refresh token
   */
  async generateUserRefreshToken(user: User): Promise<string> {
    const secrets = await this.getUserJWTSecrets(user.id);
    
    return jwt.sign(
      { userId: user.id },
      secrets.jwtRefreshSecret,
      { expiresIn: this.JWT_REFRESH_EXPIRES_IN } as jwt.SignOptions
    );
  }

  /**
   * Validate access token using user-specific JWT secret
   * @param token - The token to validate
   * @param userId - The user ID to validate against
   * @returns Promise<UserTokenPayload> - The decoded token payload
   */
  async validateUserAccessToken(token: string, userId: string): Promise<UserTokenPayload> {
    const secrets = await this.getUserJWTSecrets(userId);
    
    try {
      const decoded = jwt.verify(token, secrets.jwtSecret) as UserTokenPayload;
      
      // Ensure the token belongs to the correct user
      if (decoded.userId !== userId) {
        throw new Error('Token user mismatch');
      }
      
      return decoded;
    } catch (error) {
      throw new Error('Invalid access token');
    }
  }

  /**
   * Validate refresh token using user-specific JWT refresh secret
   * @param token - The refresh token to validate
   * @param userId - The user ID to validate against
   * @returns Promise<{ userId: string }> - The decoded token payload
   */
  async validateUserRefreshToken(token: string, userId: string): Promise<{ userId: string }> {
    const secrets = await this.getUserJWTSecrets(userId);
    
    try {
      const decoded = jwt.verify(token, secrets.jwtRefreshSecret) as { userId: string };
      
      // Ensure the token belongs to the correct user
      if (decoded.userId !== userId) {
        throw new Error('Token user mismatch');
      }
      
      return decoded;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Validate token without knowing the user ID (for middleware)
   * This method tries to decode the token to get the user ID, then validates with user-specific secret
   * @param token - The token to validate
   * @returns Promise<UserTokenPayload> - The decoded and validated token payload
   */
  async validateTokenWithUserLookup(token: string): Promise<UserTokenPayload> {
    try {
      // First, decode without verification to get the user ID
      const unverifiedDecoded = jwt.decode(token) as UserTokenPayload;
      
      if (!unverifiedDecoded || !unverifiedDecoded.userId) {
        throw new Error('Invalid token format');
      }

      // Now validate with the user's specific secret
      return await this.validateUserAccessToken(token, unverifiedDecoded.userId);
    } catch (error) {
      throw new Error('Token validation failed');
    }
  }

  /**
   * Rotate JWT secrets for a user (for security purposes)
   * @param userId - The user ID to rotate secrets for
   * @returns Promise<JWTSecrets> - The new JWT secrets
   */
  async rotateUserSecrets(userId: string): Promise<JWTSecrets> {
    return await this.generateUserJWTSecrets(userId);
  }

  /**
   * Ensure user has JWT secrets (create if missing)
   * @param userId - The user ID to check/create secrets for
   * @returns Promise<JWTSecrets> - The user's JWT secrets
   */
  async ensureUserJWTSecrets(userId: string): Promise<JWTSecrets> {
    try {
      return await this.getUserJWTSecrets(userId);
    } catch (error) {
      // If secrets don't exist, generate them
      return await this.generateUserJWTSecrets(userId);
    }
  }

  /**
   * Generate a cryptographically secure secret
   * @returns string - A base64 encoded secure random string
   */
  private generateSecureSecret(): string {
    return crypto.randomBytes(32).toString('base64');
  }

  /**
   * Validate that JWT secrets exist for a user
   * @param userId - The user ID to check
   * @returns Promise<boolean> - True if secrets exist, false otherwise
   */
  async hasValidJWTSecrets(userId: string): Promise<boolean> {
    try {
      const secrets = await this.getUserJWTSecrets(userId);
      return !!(secrets.jwtSecret && secrets.jwtRefreshSecret);
    } catch (error) {
      return false;
    }
  }
}