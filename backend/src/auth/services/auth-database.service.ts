/**
 * Authentication Database Service
 * 
 * This service provides CRUD operations for authentication-related data models
 * with proper constraint handling and error management.
 */

import { DatabaseService } from '../../database/database.service';
import { logger } from '../../shared/logger';
import {
  User,
  PhoneVerification,
  EmailVerification,
  Auth0Profile,
  UserSession,
  CreateUserInput,
  CreatePhoneVerificationInput,
  CreateEmailVerificationInput,
  CreateAuth0ProfileInput,
  CreateUserSessionInput,
  UpdateUserInput,
  UpdatePhoneVerificationInput,
  UpdateEmailVerificationInput,
  DatabaseConstraintError,
  AuthDatabaseError
} from '../models/auth.models';
import { v4 as uuidv4 } from 'uuid';

export class AuthDatabaseService {
  private db: DatabaseService;

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  // User CRUD Operations
  async createUser(input: CreateUserInput): Promise<User> {
    try {
      const id = uuidv4();
      const now = new Date();

      const result = await this.db.query(`
        INSERT INTO users (
          id, email, phone, password_hash, auth0_id, 
          phone_verified, email_verified, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        id,
        input.email,
        input.phone || null,
        input.passwordHash || null,
        input.auth0Id || null,
        false,
        false,
        now
      ]);

      return this.mapRowToUser(result.rows[0]);
    } catch (error: any) {
      throw this.handleDatabaseError(error);
    }
  }

  async getUserById(id: string): Promise<User | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM users WHERE id = $1',
        [id]
      );

      return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
    } catch (error: any) {
      logger.error('Error getting user by ID:', error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );

      return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
    } catch (error: any) {
      logger.error('Error getting user by email:', error);
      throw error;
    }
  }

  async getUserByPhone(phone: string): Promise<User | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM users WHERE phone = $1',
        [phone]
      );

      return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
    } catch (error: any) {
      logger.error('Error getting user by phone:', error);
      throw error;
    }
  }

  async getUserByAuth0Id(auth0Id: string): Promise<User | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM users WHERE auth0_id = $1',
        [auth0Id]
      );

      return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
    } catch (error: any) {
      logger.error('Error getting user by Auth0 ID:', error);
      throw error;
    }
  }

  async updateUser(id: string, input: UpdateUserInput): Promise<User> {
    try {
      const setParts: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (input.email !== undefined) {
        setParts.push(`email = $${paramIndex++}`);
        values.push(input.email);
      }
      if (input.phone !== undefined) {
        setParts.push(`phone = $${paramIndex++}`);
        values.push(input.phone);
      }
      if (input.passwordHash !== undefined) {
        setParts.push(`password_hash = $${paramIndex++}`);
        values.push(input.passwordHash);
      }
      if (input.phoneVerified !== undefined) {
        setParts.push(`phone_verified = $${paramIndex++}`);
        values.push(input.phoneVerified);
      }
      if (input.emailVerified !== undefined) {
        setParts.push(`email_verified = $${paramIndex++}`);
        values.push(input.emailVerified);
      }
      if (input.lastLogin !== undefined) {
        setParts.push(`last_login = $${paramIndex++}`);
        values.push(input.lastLogin);
      }

      if (setParts.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(id);
      const result = await this.db.query(`
        UPDATE users 
        SET ${setParts.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      return this.mapRowToUser(result.rows[0]);
    } catch (error: any) {
      throw this.handleDatabaseError(error);
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      const result = await this.db.query(
        'DELETE FROM users WHERE id = $1',
        [id]
      );

      return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
      logger.error('Error deleting user:', error);
      throw error;
    }
  }

  // Phone Verification CRUD Operations
  async createPhoneVerification(input: CreatePhoneVerificationInput): Promise<PhoneVerification> {
    try {
      const id = uuidv4();
      const now = new Date();

      const result = await this.db.query(`
        INSERT INTO phone_verifications (
          id, phone, otp_code, expires_at, attempts, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        id,
        input.phone,
        input.otpCode,
        input.expiresAt,
        0,
        now
      ]);

      return this.mapRowToPhoneVerification(result.rows[0]);
    } catch (error: any) {
      logger.error('Error creating phone verification:', error);
      throw error;
    }
  }

  async getPhoneVerificationByPhone(phone: string): Promise<PhoneVerification | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM phone_verifications WHERE phone = $1 AND verified_at IS NULL ORDER BY created_at DESC LIMIT 1',
        [phone]
      );

      return result.rows.length > 0 ? this.mapRowToPhoneVerification(result.rows[0]) : null;
    } catch (error: any) {
      logger.error('Error getting phone verification:', error);
      throw error;
    }
  }

  async updatePhoneVerification(id: string, input: UpdatePhoneVerificationInput): Promise<PhoneVerification> {
    try {
      const setParts: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (input.verifiedAt !== undefined) {
        setParts.push(`verified_at = $${paramIndex++}`);
        values.push(input.verifiedAt);
      }
      if (input.attempts !== undefined) {
        setParts.push(`attempts = $${paramIndex++}`);
        values.push(input.attempts);
      }

      if (setParts.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(id);
      const result = await this.db.query(`
        UPDATE phone_verifications 
        SET ${setParts.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new Error('Phone verification not found');
      }

      return this.mapRowToPhoneVerification(result.rows[0]);
    } catch (error: any) {
      logger.error('Error updating phone verification:', error);
      throw error;
    }
  }

  // Email Verification CRUD Operations
  async createEmailVerification(input: CreateEmailVerificationInput): Promise<EmailVerification> {
    try {
      const id = uuidv4();
      const now = new Date();

      const result = await this.db.query(`
        INSERT INTO email_verifications (
          id, email, verification_code, expires_at, created_at
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
        id,
        input.email,
        input.verificationCode,
        input.expiresAt,
        now
      ]);

      return this.mapRowToEmailVerification(result.rows[0]);
    } catch (error: any) {
      logger.error('Error creating email verification:', error);
      throw error;
    }
  }

  async getEmailVerificationByEmail(email: string): Promise<EmailVerification | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM email_verifications WHERE email = $1 AND verified_at IS NULL ORDER BY created_at DESC LIMIT 1',
        [email]
      );

      return result.rows.length > 0 ? this.mapRowToEmailVerification(result.rows[0]) : null;
    } catch (error: any) {
      logger.error('Error getting email verification:', error);
      throw error;
    }
  }

  async updateEmailVerification(id: string, input: UpdateEmailVerificationInput): Promise<EmailVerification> {
    try {
      const setParts: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (input.verifiedAt !== undefined) {
        setParts.push(`verified_at = $${paramIndex++}`);
        values.push(input.verifiedAt);
      }

      if (setParts.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(id);
      const result = await this.db.query(`
        UPDATE email_verifications 
        SET ${setParts.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        throw new Error('Email verification not found');
      }

      return this.mapRowToEmailVerification(result.rows[0]);
    } catch (error: any) {
      logger.error('Error updating email verification:', error);
      throw error;
    }
  }

  // Auth0 Profile CRUD Operations
  async createAuth0Profile(input: CreateAuth0ProfileInput): Promise<Auth0Profile> {
    try {
      const id = uuidv4();
      const now = new Date();

      const result = await this.db.query(`
        INSERT INTO auth0_profiles (
          id, user_id, auth0_id, profile_data, created_at
        ) VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [
        id,
        input.userId,
        input.auth0Id,
        JSON.stringify(input.profileData),
        now
      ]);

      return this.mapRowToAuth0Profile(result.rows[0]);
    } catch (error: any) {
      logger.error('Error creating Auth0 profile:', error);
      throw error;
    }
  }

  async getAuth0ProfileByUserId(userId: string): Promise<Auth0Profile | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM auth0_profiles WHERE user_id = $1',
        [userId]
      );

      return result.rows.length > 0 ? this.mapRowToAuth0Profile(result.rows[0]) : null;
    } catch (error: any) {
      logger.error('Error getting Auth0 profile by user ID:', error);
      throw error;
    }
  }

  // User Session CRUD Operations
  async createUserSession(input: CreateUserSessionInput): Promise<UserSession> {
    try {
      const id = uuidv4();
      const now = new Date();

      const result = await this.db.query(`
        INSERT INTO user_sessions (
          id, user_id, jwt_token, refresh_token, expires_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        id,
        input.userId,
        input.jwtToken,
        input.refreshToken,
        input.expiresAt,
        now
      ]);

      return this.mapRowToUserSession(result.rows[0]);
    } catch (error: any) {
      logger.error('Error creating user session:', error);
      throw error;
    }
  }

  async getUserSessionByToken(jwtToken: string): Promise<UserSession | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM user_sessions WHERE jwt_token = $1 AND expires_at > NOW()',
        [jwtToken]
      );

      return result.rows.length > 0 ? this.mapRowToUserSession(result.rows[0]) : null;
    } catch (error: any) {
      logger.error('Error getting user session by token:', error);
      throw error;
    }
  }

  async deleteUserSession(id: string): Promise<boolean> {
    try {
      const result = await this.db.query(
        'DELETE FROM user_sessions WHERE id = $1',
        [id]
      );

      return (result.rowCount ?? 0) > 0;
    } catch (error: any) {
      logger.error('Error deleting user session:', error);
      throw error;
    }
  }

  // Helper methods for mapping database rows to models
  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      phone: row.phone,
      passwordHash: row.password_hash,
      auth0Id: row.auth0_id,
      phoneVerified: row.phone_verified,
      emailVerified: row.email_verified,
      createdAt: new Date(row.created_at),
      lastLogin: row.last_login ? new Date(row.last_login) : undefined
    };
  }

  private mapRowToPhoneVerification(row: any): PhoneVerification {
    return {
      id: row.id,
      phone: row.phone,
      otpCode: row.otp_code,
      expiresAt: new Date(row.expires_at),
      verifiedAt: row.verified_at ? new Date(row.verified_at) : undefined,
      attempts: row.attempts,
      createdAt: new Date(row.created_at)
    };
  }

  private mapRowToEmailVerification(row: any): EmailVerification {
    return {
      id: row.id,
      email: row.email,
      verificationCode: row.verification_code,
      expiresAt: new Date(row.expires_at),
      verifiedAt: row.verified_at ? new Date(row.verified_at) : undefined,
      createdAt: new Date(row.created_at)
    };
  }

  private mapRowToAuth0Profile(row: any): Auth0Profile {
    return {
      id: row.id,
      userId: row.user_id,
      auth0Id: row.auth0_id,
      profileData: JSON.parse(row.profile_data),
      createdAt: new Date(row.created_at)
    };
  }

  private mapRowToUserSession(row: any): UserSession {
    return {
      id: row.id,
      userId: row.user_id,
      jwtToken: row.jwt_token,
      refreshToken: row.refresh_token,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at)
    };
  }

  // Database error handling
  private handleDatabaseError(error: any): Error {
    if (error.code === '23505') { // Unique constraint violation
      if (error.constraint?.includes('email')) {
        return new AuthDatabaseError(
          DatabaseConstraintError.DUPLICATE_EMAIL,
          'email',
          error.detail,
          'Email already exists'
        );
      }
      if (error.constraint?.includes('phone')) {
        return new AuthDatabaseError(
          DatabaseConstraintError.DUPLICATE_PHONE,
          'phone',
          error.detail,
          'Phone number already exists'
        );
      }
      if (error.constraint?.includes('auth0_id')) {
        return new AuthDatabaseError(
          DatabaseConstraintError.DUPLICATE_AUTH0_ID,
          'auth0_id',
          error.detail,
          'Auth0 ID already exists'
        );
      }
    }
    
    if (error.code === '23503') { // Foreign key violation
      return new AuthDatabaseError(
        DatabaseConstraintError.FOREIGN_KEY_VIOLATION,
        'foreign_key',
        error.detail,
        'Referenced record does not exist'
      );
    }
    
    if (error.code === '23502') { // Not null violation
      return new AuthDatabaseError(
        DatabaseConstraintError.NOT_NULL_VIOLATION,
        error.column,
        '',
        `Required field ${error.column} cannot be null`
      );
    }

    logger.error('Unhandled database error:', error);
    return error;
  }
}