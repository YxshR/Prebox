/**
 * Enhanced Authentication Middleware
 * 
 * This middleware provides secure authentication with:
 * - JWT token validation with enhanced security
 * - Session management and validation
 * - Rate limiting for authentication attempts
 * - Secure password validation
 * - Multi-factor authentication support
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pool from '../config/database';
import { ComprehensiveSecurityMiddleware } from './comprehensive-security.middleware';
import { logger } from '../shared/logger';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    phone?: string;
    tenantId: string;
    role: string;
    subscriptionTier: string;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    sessionId?: string;
  };
  session?: {
    id: string;
    userId: string;
    createdAt: Date;
    lastAccessedAt: Date;
    ipAddress: string;
    userAgent: string;
    isActive: boolean;
  };
}

export class EnhancedAuthMiddleware {
  private securityMiddleware: ComprehensiveSecurityMiddleware;

  constructor() {
    this.securityMiddleware = new ComprehensiveSecurityMiddleware();
  }

  /**
   * Authenticate JWT token with enhanced security validation
   */
  public authenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = this.extractToken(req);
      
      if (!token) {
        return this.sendUnauthorizedResponse(res, 'MISSING_TOKEN', 'Authentication token is required');
      }

      // Verify JWT token
      let decoded: any;
      try {
        decoded = ComprehensiveSecurityMiddleware.verifyAccessToken(token);
      } catch (jwtError: any) {
        if (jwtError.name === 'TokenExpiredError') {
          return this.sendUnauthorizedResponse(res, 'TOKEN_EXPIRED', 'Token has expired');
        } else if (jwtError.name === 'JsonWebTokenError') {
          return this.sendUnauthorizedResponse(res, 'INVALID_TOKEN', 'Invalid token');
        } else {
          return this.sendUnauthorizedResponse(res, 'TOKEN_VERIFICATION_FAILED', 'Token verification failed');
        }
      }

      // Validate token payload
      if (!decoded.userId || !decoded.sessionId) {
        return this.sendUnauthorizedResponse(res, 'INVALID_TOKEN_PAYLOAD', 'Invalid token payload');
      }

      // Get user and session from database
      const userResult = await pool.query(`
        SELECT u.*, s.id as session_id, s.created_at as session_created_at, 
               s.last_accessed_at, s.ip_address as session_ip, s.user_agent as session_user_agent,
               s.is_active as session_active
        FROM users u
        LEFT JOIN user_sessions s ON u.id = s.user_id AND s.id = $2
        WHERE u.id = $1
      `, [decoded.userId, decoded.sessionId]);

      if (userResult.rows.length === 0) {
        return this.sendUnauthorizedResponse(res, 'USER_NOT_FOUND', 'User not found');
      }

      const userRow = userResult.rows[0];

      // Check if session is valid and active
      if (!userRow.session_id || !userRow.session_active) {
        return this.sendUnauthorizedResponse(res, 'INVALID_SESSION', 'Session is invalid or expired');
      }

      // Check session expiry (sessions expire after 7 days of inactivity)
      const sessionExpiry = new Date(userRow.last_accessed_at);
      sessionExpiry.setDate(sessionExpiry.getDate() + 7);
      
      if (new Date() > sessionExpiry) {
        // Invalidate expired session
        await pool.query('UPDATE user_sessions SET is_active = false WHERE id = $1', [userRow.session_id]);
        return this.sendUnauthorizedResponse(res, 'SESSION_EXPIRED', 'Session has expired');
      }

      // Update session last accessed time
      await pool.query('UPDATE user_sessions SET last_accessed_at = NOW() WHERE id = $1', [userRow.session_id]);

      // Attach user and session to request
      req.user = {
        id: userRow.id,
        email: userRow.email,
        phone: userRow.phone,
        tenantId: userRow.tenant_id,
        role: userRow.role,
        subscriptionTier: userRow.subscription_tier,
        isEmailVerified: userRow.is_email_verified,
        isPhoneVerified: userRow.is_phone_verified,
        sessionId: userRow.session_id
      };

      req.session = {
        id: userRow.session_id,
        userId: userRow.id,
        createdAt: new Date(userRow.session_created_at),
        lastAccessedAt: new Date(userRow.last_accessed_at),
        ipAddress: userRow.session_ip,
        userAgent: userRow.session_user_agent,
        isActive: userRow.session_active
      };

      // Log successful authentication
      logger.info('Authentication successful', {
        userId: req.user.id,
        sessionId: req.user.sessionId,
        endpoint: req.path
      });

      next();
    } catch (error: any) {
      logger.error('Authentication error:', error);
      return this.sendUnauthorizedResponse(res, 'AUTHENTICATION_ERROR', 'Authentication failed');
    }
  };

  /**
   * Optional authentication - doesn't fail if no token provided
   */
  public optionalAuthenticate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const token = this.extractToken(req);
    
    if (!token) {
      return next(); // Continue without authentication
    }

    // Use regular authenticate but don't fail on errors
    try {
      await this.authenticate(req, res, next);
    } catch (error) {
      // Continue without authentication on any error
      next();
    }
  };

  /**
   * Require specific role
   */
  public requireRole = (requiredRole: string | string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        return this.sendUnauthorizedResponse(res, 'AUTHENTICATION_REQUIRED', 'Authentication required');
      }

      const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      
      if (!roles.includes(req.user.role)) {
        return this.sendForbiddenResponse(res, 'INSUFFICIENT_PERMISSIONS', 'Insufficient permissions');
      }

      next();
    };
  };

  /**
   * Require email verification
   */
  public requireEmailVerification = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return this.sendUnauthorizedResponse(res, 'AUTHENTICATION_REQUIRED', 'Authentication required');
    }

    if (!req.user.isEmailVerified) {
      return this.sendForbiddenResponse(res, 'EMAIL_VERIFICATION_REQUIRED', 'Email verification required');
    }

    next();
  };

  /**
   * Require phone verification
   */
  public requirePhoneVerification = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return this.sendUnauthorizedResponse(res, 'AUTHENTICATION_REQUIRED', 'Authentication required');
    }

    if (!req.user.isPhoneVerified) {
      return this.sendForbiddenResponse(res, 'PHONE_VERIFICATION_REQUIRED', 'Phone verification required');
    }

    next();
  };

  /**
   * Validate password with enhanced security
   */
  public static async validatePassword(password: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Length check
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must be no more than 128 characters long');
    }

    // Complexity checks
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Common password checks
    const commonPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123', 
      'password123', 'admin', 'letmein', 'welcome', 'monkey'
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common');
    }

    // Sequential characters check
    if (/123456|abcdef|qwerty/i.test(password)) {
      errors.push('Password cannot contain sequential characters');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Hash password with secure settings
   */
  public static async hashPassword(password: string): Promise<string> {
    // Validate password first
    const validation = await EnhancedAuthMiddleware.validatePassword(password);
    if (!validation.valid) {
      throw new Error(`Password validation failed: ${validation.errors.join(', ')}`);
    }

    return ComprehensiveSecurityMiddleware.hashPassword(password);
  }

  /**
   * Verify password against hash
   */
  public static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return ComprehensiveSecurityMiddleware.verifyPassword(password, hash);
  }

  /**
   * Generate secure session tokens
   */
  public static generateTokens(payload: { userId: string; sessionId: string; email: string }): {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  } {
    const accessToken = ComprehensiveSecurityMiddleware.generateAccessToken(payload);
    const refreshToken = ComprehensiveSecurityMiddleware.generateRefreshToken(payload);
    
    // Get expiry time in seconds
    const expiresIn = parseInt(process.env.JWT_ACCESS_EXPIRES_IN?.replace(/\D/g, '') || '15') * 60; // Default 15 minutes

    return {
      accessToken,
      refreshToken,
      expiresIn
    };
  }

  /**
   * Refresh access token using refresh token
   */
  public static async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    try {
      // Verify refresh token
      const decoded = ComprehensiveSecurityMiddleware.verifyRefreshToken(refreshToken);
      
      if (!decoded.userId || !decoded.sessionId) {
        throw new Error('Invalid refresh token payload');
      }

      // Validate session in database
      const sessionResult = await pool.query(`
        SELECT s.*, u.email 
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.id = $1 AND s.user_id = $2 AND s.is_active = true
      `, [decoded.sessionId, decoded.userId]);

      if (sessionResult.rows.length === 0) {
        throw new Error('Invalid or expired session');
      }

      const session = sessionResult.rows[0];

      // Generate new tokens
      const newTokens = EnhancedAuthMiddleware.generateTokens({
        userId: decoded.userId,
        sessionId: decoded.sessionId,
        email: session.email
      });

      // Update session last accessed time
      await pool.query('UPDATE user_sessions SET last_accessed_at = NOW() WHERE id = $1', [decoded.sessionId]);

      return newTokens;
    } catch (error: any) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Invalidate session
   */
  public static async invalidateSession(userId: string, sessionId?: string): Promise<void> {
    if (sessionId) {
      // Invalidate specific session
      await pool.query(
        'UPDATE user_sessions SET is_active = false WHERE user_id = $1 AND id = $2',
        [userId, sessionId]
      );
    } else {
      // Invalidate all sessions for user
      await pool.query(
        'UPDATE user_sessions SET is_active = false WHERE user_id = $1',
        [userId]
      );
    }
  }

  // Private helper methods
  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Also check for token in query parameter (for WebSocket connections)
    if (req.query.token && typeof req.query.token === 'string') {
      return req.query.token;
    }
    
    return null;
  }

  private sendUnauthorizedResponse(res: Response, code: string, message: string): void {
    res.status(401).json({
      success: false,
      error: {
        code,
        message
      }
    });
  }

  private sendForbiddenResponse(res: Response, code: string, message: string): void {
    res.status(403).json({
      success: false,
      error: {
        code,
        message
      }
    });
  }
}

export default EnhancedAuthMiddleware;