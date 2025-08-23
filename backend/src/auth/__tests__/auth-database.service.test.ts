/**
 * Unit tests for AuthDatabaseService
 */

import { AuthDatabaseService } from '../services/auth-database.service';
import { DatabaseService } from '../../database/database.service';
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

// Mock the DatabaseService
jest.mock('../../database/database.service');
jest.mock('../../shared/logger');

const mockDatabaseService = {
  query: jest.fn(),
  transaction: jest.fn()
};

// Mock UUID generation
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-1234')
}));

describe('AuthDatabaseService', () => {
  let authDbService: AuthDatabaseService;
  let mockDb: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock DatabaseService.getInstance()
    (DatabaseService.getInstance as jest.Mock).mockReturnValue(mockDatabaseService);
    
    authDbService = new AuthDatabaseService();
    mockDb = mockDatabaseService as any;
  });

  describe('User CRUD Operations', () => {
    describe('createUser', () => {
      it('should create a new user successfully', async () => {
        const input: CreateUserInput = {
          email: 'test@example.com',
          phone: '+1234567890',
          passwordHash: 'hashed-password'
        };

        const mockRow = {
          id: 'mock-uuid-1234',
          email: 'test@example.com',
          phone: '+1234567890',
          password_hash: 'hashed-password',
          auth0_id: null,
          phone_verified: false,
          email_verified: false,
          created_at: new Date(),
          last_login: null
        };

        mockDb.query.mockResolvedValue({ rows: [mockRow] });

        const result = await authDbService.createUser(input);

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO users'),
          expect.arrayContaining([
            'mock-uuid-1234',
            'test@example.com',
            '+1234567890',
            'hashed-password',
            null,
            false,
            false,
            expect.any(Date)
          ])
        );

        expect(result).toEqual({
          id: 'mock-uuid-1234',
          email: 'test@example.com',
          phone: '+1234567890',
          passwordHash: 'hashed-password',
          auth0Id: null,
          phoneVerified: false,
          emailVerified: false,
          createdAt: expect.any(Date),
          lastLogin: undefined
        });
      });

      it('should handle duplicate email constraint violation', async () => {
        const input: CreateUserInput = {
          email: 'existing@example.com'
        };

        const constraintError = {
          code: '23505',
          constraint: 'users_email_unique',
          detail: 'Key (email)=(existing@example.com) already exists.'
        };

        mockDb.query.mockRejectedValue(constraintError);

        await expect(authDbService.createUser(input)).rejects.toThrow(AuthDatabaseError);
        await expect(authDbService.createUser(input)).rejects.toMatchObject({
          constraintType: DatabaseConstraintError.DUPLICATE_EMAIL,
          field: 'email',
          message: 'Email already exists'
        });
      });

      it('should handle duplicate phone constraint violation', async () => {
        const input: CreateUserInput = {
          email: 'test@example.com',
          phone: '+1234567890'
        };

        const constraintError = {
          code: '23505',
          constraint: 'users_phone_unique',
          detail: 'Key (phone)=(+1234567890) already exists.'
        };

        mockDb.query.mockRejectedValue(constraintError);

        await expect(authDbService.createUser(input)).rejects.toThrow(AuthDatabaseError);
        await expect(authDbService.createUser(input)).rejects.toMatchObject({
          constraintType: DatabaseConstraintError.DUPLICATE_PHONE,
          field: 'phone',
          message: 'Phone number already exists'
        });
      });
    });

    describe('getUserByEmail', () => {
      it('should return user when found', async () => {
        const mockRow = {
          id: 'user-1',
          email: 'test@example.com',
          phone: null,
          password_hash: 'hashed-password',
          auth0_id: null,
          phone_verified: false,
          email_verified: true,
          created_at: new Date(),
          last_login: new Date()
        };

        mockDb.query.mockResolvedValue({ rows: [mockRow] });

        const result = await authDbService.getUserByEmail('test@example.com');

        expect(mockDb.query).toHaveBeenCalledWith(
          'SELECT * FROM users WHERE email = $1',
          ['test@example.com']
        );

        expect(result).toEqual({
          id: 'user-1',
          email: 'test@example.com',
          phone: null,
          passwordHash: 'hashed-password',
          auth0Id: null,
          phoneVerified: false,
          emailVerified: true,
          createdAt: expect.any(Date),
          lastLogin: expect.any(Date)
        });
      });

      it('should return null when user not found', async () => {
        mockDb.query.mockResolvedValue({ rows: [] });

        const result = await authDbService.getUserByEmail('nonexistent@example.com');

        expect(result).toBeNull();
      });
    });

    describe('updateUser', () => {
      it('should update user fields successfully', async () => {
        const updateInput: UpdateUserInput = {
          phoneVerified: true,
          emailVerified: true,
          lastLogin: new Date()
        };

        const mockRow = {
          id: 'user-1',
          email: 'test@example.com',
          phone: '+1234567890',
          password_hash: 'hashed-password',
          auth0_id: null,
          phone_verified: true,
          email_verified: true,
          created_at: new Date(),
          last_login: updateInput.lastLogin
        };

        mockDb.query.mockResolvedValue({ rows: [mockRow] });

        const result = await authDbService.updateUser('user-1', updateInput);

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE users SET'),
          expect.arrayContaining([true, true, updateInput.lastLogin, 'user-1'])
        );

        expect(result.phoneVerified).toBe(true);
        expect(result.emailVerified).toBe(true);
      });

      it('should throw error when no fields to update', async () => {
        await expect(authDbService.updateUser('user-1', {})).rejects.toThrow('No fields to update');
      });

      it('should throw error when user not found', async () => {
        mockDb.query.mockResolvedValue({ rows: [] });

        await expect(authDbService.updateUser('nonexistent', { phoneVerified: true }))
          .rejects.toThrow('User not found');
      });
    });
  });

  describe('Phone Verification CRUD Operations', () => {
    describe('createPhoneVerification', () => {
      it('should create phone verification successfully', async () => {
        const input: CreatePhoneVerificationInput = {
          phone: '+1234567890',
          otpCode: '123456',
          expiresAt: new Date(Date.now() + 300000) // 5 minutes
        };

        const mockRow = {
          id: 'mock-uuid-1234',
          phone: '+1234567890',
          otp_code: '123456',
          expires_at: input.expiresAt,
          verified_at: null,
          attempts: 0,
          created_at: new Date()
        };

        mockDb.query.mockResolvedValue({ rows: [mockRow] });

        const result = await authDbService.createPhoneVerification(input);

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO phone_verifications'),
          expect.arrayContaining([
            'mock-uuid-1234',
            '+1234567890',
            '123456',
            input.expiresAt,
            0,
            expect.any(Date)
          ])
        );

        expect(result).toEqual({
          id: 'mock-uuid-1234',
          phone: '+1234567890',
          otpCode: '123456',
          expiresAt: input.expiresAt,
          verifiedAt: undefined,
          attempts: 0,
          createdAt: expect.any(Date)
        });
      });
    });

    describe('getPhoneVerificationByPhone', () => {
      it('should return latest unverified phone verification', async () => {
        const mockRow = {
          id: 'verification-1',
          phone: '+1234567890',
          otp_code: '123456',
          expires_at: new Date(),
          verified_at: null,
          attempts: 1,
          created_at: new Date()
        };

        mockDb.query.mockResolvedValue({ rows: [mockRow] });

        const result = await authDbService.getPhoneVerificationByPhone('+1234567890');

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM phone_verifications WHERE phone = $1 AND verified_at IS NULL'),
          ['+1234567890']
        );

        expect(result).toBeDefined();
        expect(result?.phone).toBe('+1234567890');
      });
    });

    describe('updatePhoneVerification', () => {
      it('should update verification status successfully', async () => {
        const updateInput: UpdatePhoneVerificationInput = {
          verifiedAt: new Date(),
          attempts: 1
        };

        const mockRow = {
          id: 'verification-1',
          phone: '+1234567890',
          otp_code: '123456',
          expires_at: new Date(),
          verified_at: updateInput.verifiedAt,
          attempts: 1,
          created_at: new Date()
        };

        mockDb.query.mockResolvedValue({ rows: [mockRow] });

        const result = await authDbService.updatePhoneVerification('verification-1', updateInput);

        expect(result.verifiedAt).toEqual(updateInput.verifiedAt);
        expect(result.attempts).toBe(1);
      });
    });
  });

  describe('Email Verification CRUD Operations', () => {
    describe('createEmailVerification', () => {
      it('should create email verification successfully', async () => {
        const input: CreateEmailVerificationInput = {
          email: 'test@example.com',
          verificationCode: 'ABC12345',
          expiresAt: new Date(Date.now() + 3600000) // 1 hour
        };

        const mockRow = {
          id: 'mock-uuid-1234',
          email: 'test@example.com',
          verification_code: 'ABC12345',
          expires_at: input.expiresAt,
          verified_at: null,
          created_at: new Date()
        };

        mockDb.query.mockResolvedValue({ rows: [mockRow] });

        const result = await authDbService.createEmailVerification(input);

        expect(result).toEqual({
          id: 'mock-uuid-1234',
          email: 'test@example.com',
          verificationCode: 'ABC12345',
          expiresAt: input.expiresAt,
          verifiedAt: undefined,
          createdAt: expect.any(Date)
        });
      });
    });
  });

  describe('Auth0 Profile CRUD Operations', () => {
    describe('createAuth0Profile', () => {
      it('should create Auth0 profile successfully', async () => {
        const input: CreateAuth0ProfileInput = {
          userId: 'user-1',
          auth0Id: 'auth0|123456',
          profileData: { name: 'John Doe', email: 'john@example.com' }
        };

        const mockRow = {
          id: 'mock-uuid-1234',
          user_id: 'user-1',
          auth0_id: 'auth0|123456',
          profile_data: JSON.stringify(input.profileData),
          created_at: new Date()
        };

        mockDb.query.mockResolvedValue({ rows: [mockRow] });

        const result = await authDbService.createAuth0Profile(input);

        expect(result).toEqual({
          id: 'mock-uuid-1234',
          userId: 'user-1',
          auth0Id: 'auth0|123456',
          profileData: { name: 'John Doe', email: 'john@example.com' },
          createdAt: expect.any(Date)
        });
      });
    });
  });

  describe('User Session CRUD Operations', () => {
    describe('createUserSession', () => {
      it('should create user session successfully', async () => {
        const input: CreateUserSessionInput = {
          userId: 'user-1',
          jwtToken: 'jwt-token-123',
          refreshToken: 'refresh-token-123',
          expiresAt: new Date(Date.now() + 900000) // 15 minutes
        };

        const mockRow = {
          id: 'mock-uuid-1234',
          user_id: 'user-1',
          jwt_token: 'jwt-token-123',
          refresh_token: 'refresh-token-123',
          expires_at: input.expiresAt,
          created_at: new Date()
        };

        mockDb.query.mockResolvedValue({ rows: [mockRow] });

        const result = await authDbService.createUserSession(input);

        expect(result).toEqual({
          id: 'mock-uuid-1234',
          userId: 'user-1',
          jwtToken: 'jwt-token-123',
          refreshToken: 'refresh-token-123',
          expiresAt: input.expiresAt,
          createdAt: expect.any(Date)
        });
      });
    });

    describe('getUserSessionByToken', () => {
      it('should return active session when found', async () => {
        const mockRow = {
          id: 'session-1',
          user_id: 'user-1',
          jwt_token: 'jwt-token-123',
          refresh_token: 'refresh-token-123',
          expires_at: new Date(Date.now() + 900000),
          created_at: new Date()
        };

        mockDb.query.mockResolvedValue({ rows: [mockRow] });

        const result = await authDbService.getUserSessionByToken('jwt-token-123');

        expect(mockDb.query).toHaveBeenCalledWith(
          'SELECT * FROM user_sessions WHERE jwt_token = $1 AND expires_at > NOW()',
          ['jwt-token-123']
        );

        expect(result).toBeDefined();
        expect(result?.jwtToken).toBe('jwt-token-123');
      });

      it('should return null when session not found or expired', async () => {
        mockDb.query.mockResolvedValue({ rows: [] });

        const result = await authDbService.getUserSessionByToken('invalid-token');

        expect(result).toBeNull();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle foreign key violations', async () => {
      const input: CreateAuth0ProfileInput = {
        userId: 'nonexistent-user',
        auth0Id: 'auth0|123456',
        profileData: {}
      };

      const foreignKeyError = {
        code: '23503',
        detail: 'Key (user_id)=(nonexistent-user) is not present in table "users".'
      };

      mockDb.query.mockRejectedValue(foreignKeyError);

      await expect(authDbService.createAuth0Profile(input)).rejects.toThrow(AuthDatabaseError);
      await expect(authDbService.createAuth0Profile(input)).rejects.toMatchObject({
        constraintType: DatabaseConstraintError.FOREIGN_KEY_VIOLATION
      });
    });

    it('should handle not null violations', async () => {
      const notNullError = {
        code: '23502',
        column: 'email'
      };

      mockDb.query.mockRejectedValue(notNullError);

      await expect(authDbService.createUser({ email: '' } as any)).rejects.toThrow(AuthDatabaseError);
      await expect(authDbService.createUser({ email: '' } as any)).rejects.toMatchObject({
        constraintType: DatabaseConstraintError.NOT_NULL_VIOLATION
      });
    });
  });
});