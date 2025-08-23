import { v4 as uuidv4 } from 'uuid';
import pool from '../../config/database';
import redisClient from '../../config/redis';
import { UserSecurityManager } from '../user-security-manager.service';
import { User, AuthToken } from '../../shared/types';
import { logger } from '../../shared/logger';

export interface UserSession {
  id: string;
  userId: string;
  jwtToken: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
  lastAccessedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
}

export interface SessionCreateRequest {
  user: User;
  ipAddress?: string;
  userAgent?: string;
}

export class SessionManagementService {
  private userSecurityManager: UserSecurityManager;
  private readonly JWT_EXPIRES_IN_SECONDS = 15 * 60; // 15 minutes
  private readonly REFRESH_EXPIRES_IN_SECONDS = 7 * 24 * 60 * 60; // 7 days
  private readonly MAX_SESSIONS_PER_USER = 5; // Limit concurrent sessions

  constructor() {
    this.userSecurityManager = new UserSecurityManager();
  }

  /**
   * Create a new session for a user
   */
  async createSession(request: SessionCreateRequest): Promise<AuthToken> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Ensure user has JWT secrets
      await this.userSecurityManager.ensureUserJWTSecrets(request.user.id);

      // Generate tokens
      const accessToken = await this.userSecurityManager.generateUserAccessToken(request.user);
      const refreshToken = await this.userSecurityManager.generateUserRefreshToken(request.user);

      // Create session record
      const sessionId = uuidv4();
      const expiresAt = new Date(Date.now() + this.REFRESH_EXPIRES_IN_SECONDS * 1000);

      await client.query(`
        INSERT INTO user_sessions (
          id, user_id, jwt_token_hash, refresh_token_hash, expires_at, 
          created_at, last_accessed, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        sessionId,
        request.user.id,
        accessToken,
        refreshToken,
        expiresAt,
        new Date(),
        new Date(),
        request.ipAddress,
        request.userAgent
      ]);

      // Store refresh token in Redis for fast lookup
      await redisClient.setEx(
        `refresh_token:${request.user.id}:${sessionId}`, 
        this.REFRESH_EXPIRES_IN_SECONDS, 
        refreshToken
      );

      // Clean up old sessions if user has too many
      await this.cleanupOldSessions(client, request.user.id);

      // Update user's last login timestamp
      await client.query(
        'UPDATE users SET last_login_at = $1 WHERE id = $2',
        [new Date(), request.user.id]
      );

      await client.query('COMMIT');

      logger.info('Session created successfully', {
        userId: request.user.id,
        sessionId,
        ipAddress: request.ipAddress
      });

      return {
        accessToken,
        refreshToken,
        expiresIn: this.JWT_EXPIRES_IN_SECONDS,
        user: { ...request.user, lastLoginAt: new Date() }
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to create session', { error, userId: request.user.id });
      throw new Error('Failed to create session');
    } finally {
      client.release();
    }
  }

  /**
   * Refresh an existing session
   */
  async refreshSession(refreshToken: string, ipAddress?: string): Promise<AuthToken> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // First decode to get user ID
      const unverifiedDecoded = require('jsonwebtoken').decode(refreshToken) as any;
      if (!unverifiedDecoded || !unverifiedDecoded.userId) {
        throw new Error('Invalid refresh token format');
      }

      const userId = unverifiedDecoded.userId;

      // Validate refresh token with user-specific secret
      const decoded = await this.userSecurityManager.validateUserRefreshToken(refreshToken, userId);

      // Check if refresh token exists in database and Redis
      const sessionResult = await client.query(`
        SELECT * FROM user_sessions 
        WHERE user_id = $1 AND refresh_token_hash = $2 AND expires_at > NOW()
      `, [userId, refreshToken]);

      if (sessionResult.rows.length === 0) {
        throw new Error('Invalid or expired refresh token');
      }

      const session = sessionResult.rows[0];
      const redisKey = `refresh_token:${userId}:${session.id}`;
      const storedToken = await redisClient.get(redisKey);
      
      if (storedToken !== refreshToken) {
        throw new Error('Refresh token not found in cache');
      }

      // Get user data
      const userResult = await client.query('SELECT * FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = this.mapRowToUser(userResult.rows[0]);

      // Generate new tokens
      const newAccessToken = await this.userSecurityManager.generateUserAccessToken(user);
      const newRefreshToken = await this.userSecurityManager.generateUserRefreshToken(user);

      // Update session record
      const newExpiresAt = new Date(Date.now() + this.REFRESH_EXPIRES_IN_SECONDS * 1000);
      await client.query(`
        UPDATE user_sessions 
        SET jwt_token_hash = $1, refresh_token_hash = $2, expires_at = $3, last_accessed = $4
        WHERE id = $5
      `, [newAccessToken, newRefreshToken, newExpiresAt, new Date(), session.id]);

      // Update Redis
      await redisClient.del(redisKey);
      await redisClient.setEx(
        `refresh_token:${userId}:${session.id}`, 
        this.REFRESH_EXPIRES_IN_SECONDS, 
        newRefreshToken
      );

      await client.query('COMMIT');

      logger.info('Session refreshed successfully', {
        userId,
        sessionId: session.id,
        ipAddress
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: this.JWT_EXPIRES_IN_SECONDS,
        user
      };

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to refresh session', { error });
      throw new Error('Invalid refresh token');
    } finally {
      client.release();
    }
  }

  /**
   * Invalidate a specific session
   */
  async invalidateSession(userId: string, sessionId?: string): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      let query: string;
      let params: any[];

      if (sessionId) {
        // Delete specific session
        query = 'DELETE FROM user_sessions WHERE user_id = $1 AND id = $2';
        params = [userId, sessionId];
      } else {
        // Delete all sessions for user
        query = 'DELETE FROM user_sessions WHERE user_id = $1';
        params = [userId];
      }

      await client.query(query, params);

      // Remove from Redis
      if (sessionId) {
        await redisClient.del(`refresh_token:${userId}:${sessionId}`);
      } else {
        // Remove all refresh tokens for user
        const pattern = `refresh_token:${userId}:*`;
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      }

      await client.query('COMMIT');

      logger.info('Session(s) invalidated', { userId, sessionId });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to invalidate session', { error, userId, sessionId });
      throw new Error('Failed to invalidate session');
    } finally {
      client.release();
    }
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId: string): Promise<UserSession[]> {
    const result = await pool.query(`
      SELECT * FROM user_sessions 
      WHERE user_id = $1 AND expires_at > NOW()
      ORDER BY last_accessed DESC
    `, [userId]);

    return result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      jwtToken: row.jwt_token_hash,
      refreshToken: row.refresh_token_hash,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      lastAccessedAt: new Date(row.last_accessed),
      ipAddress: row.ip_address,
      userAgent: row.user_agent,
      isActive: true
    }));
  }

  /**
   * Update session access time
   */
  async updateSessionAccess(userId: string, accessToken: string, ipAddress?: string): Promise<void> {
    try {
      await pool.query(`
        UPDATE user_sessions 
        SET last_accessed = $1 
        WHERE user_id = $2 AND jwt_token_hash = $3
      `, [new Date(), userId, accessToken]);
    } catch (error) {
      // Don't throw error for access time updates
      logger.warn('Failed to update session access time', { error, userId });
    }
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get expired sessions to clean up Redis
      const expiredSessions = await client.query(`
        SELECT user_id, id FROM user_sessions 
        WHERE expires_at <= NOW()
      `);

      // Remove from Redis
      for (const session of expiredSessions.rows) {
        await redisClient.del(`refresh_token:${session.user_id}:${session.id}`);
      }

      // Delete expired sessions from database
      const result = await client.query(`
        DELETE FROM user_sessions 
        WHERE expires_at <= NOW()
      `);

      await client.query('COMMIT');

      logger.info('Cleaned up expired sessions', { count: result.rowCount });

    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Failed to cleanup expired sessions', { error });
    } finally {
      client.release();
    }
  }

  /**
   * Clean up old sessions for a user (keep only the most recent ones)
   */
  private async cleanupOldSessions(client: any, userId: string): Promise<void> {
    // Get session count for user
    const countResult = await client.query(`
      SELECT COUNT(*) as count FROM user_sessions 
      WHERE user_id = $1 AND expires_at > NOW()
    `, [userId]);

    const sessionCount = parseInt(countResult.rows[0].count);

    if (sessionCount > this.MAX_SESSIONS_PER_USER) {
      // Get oldest sessions to remove
      const oldSessions = await client.query(`
        SELECT id FROM user_sessions 
        WHERE user_id = $1 AND expires_at > NOW()
        ORDER BY last_accessed ASC 
        LIMIT $2
      `, [userId, sessionCount - this.MAX_SESSIONS_PER_USER]);

      // Delete old sessions
      for (const session of oldSessions.rows) {
        await client.query(
          'DELETE FROM user_sessions WHERE id = $1',
          [session.id]
        );
        
        // Remove from Redis
        await redisClient.del(`refresh_token:${userId}:${session.id}`);
      }

      logger.info('Cleaned up old sessions for user', {
        userId,
        removedCount: oldSessions.rows.length
      });
    }
  }

  /**
   * Map database row to User object
   */
  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      phone: row.phone,
      firstName: row.first_name,
      lastName: row.last_name,
      tenantId: row.tenant_id,
      role: row.role,
      subscriptionTier: row.subscription_tier,
      isEmailVerified: row.is_email_verified,
      isPhoneVerified: row.is_phone_verified,
      googleId: row.google_id,
      auth0Id: row.auth0_id,
      createdAt: new Date(row.created_at),
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : new Date()
    };
  }
}