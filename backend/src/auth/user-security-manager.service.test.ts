import { UserSecurityManager, JWTSecrets } from './user-security-manager.service';
import pool from '../config/database';
import * as jwt from 'jsonwebtoken';
import { User, UserRole, SubscriptionTier } from '../shared/types';

// Mock the database pool
jest.mock('../config/database');
const mockPool = pool as jest.Mocked<typeof pool>;

describe('UserSecurityManager', () => {
  let userSecurityManager: UserSecurityManager;
  let mockUser: User;

  beforeEach(() => {
    userSecurityManager = new UserSecurityManager();
    mockUser = {
      id: 'test-user-id',
      email: 'test@example.com',
      phone: '+1234567890',
      firstName: 'Test',
      lastName: 'User',
      tenantId: 'test-tenant-id',
      role: UserRole.USER,
      subscriptionTier: SubscriptionTier.FREE,
      isEmailVerified: true,
      isPhoneVerified: true,
      createdAt: new Date(),
      lastLoginAt: new Date()
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('generateUserJWTSecrets', () => {
    it('should generate and store JWT secrets for a user', async () => {
      // Mock database query
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      const result = await userSecurityManager.generateUserJWTSecrets(mockUser.id);

      expect(result).toHaveProperty('jwtSecret');
      expect(result).toHaveProperty('jwtRefreshSecret');
      expect(typeof result.jwtSecret).toBe('string');
      expect(typeof result.jwtRefreshSecret).toBe('string');
      expect(result.jwtSecret).not.toBe(result.jwtRefreshSecret);

      // Verify database update was called
      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE users SET jwt_secret = $1, jwt_refresh_secret = $2 WHERE id = $3',
        [result.jwtSecret, result.jwtRefreshSecret, mockUser.id]
      );
    });

    it('should generate unique secrets for different users', async () => {
      mockPool.query.mockResolvedValue({ rows: [], rowCount: 1 } as any);

      const secrets1 = await userSecurityManager.generateUserJWTSecrets('user1');
      const secrets2 = await userSecurityManager.generateUserJWTSecrets('user2');

      expect(secrets1.jwtSecret).not.toBe(secrets2.jwtSecret);
      expect(secrets1.jwtRefreshSecret).not.toBe(secrets2.jwtRefreshSecret);
    });
  });

  describe('getUserJWTSecrets', () => {
    it('should retrieve JWT secrets for a user', async () => {
      const mockSecrets = {
        jwt_secret: 'test-jwt-secret',
        jwt_refresh_secret: 'test-refresh-secret'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockSecrets],
        rowCount: 1
      } as any);

      const result = await userSecurityManager.getUserJWTSecrets(mockUser.id);

      expect(result).toEqual({
        jwtSecret: mockSecrets.jwt_secret,
        jwtRefreshSecret: mockSecrets.jwt_refresh_secret
      });

      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT jwt_secret, jwt_refresh_secret FROM users WHERE id = $1',
        [mockUser.id]
      );
    });

    it('should throw error if user not found', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0
      } as any);

      await expect(userSecurityManager.getUserJWTSecrets('nonexistent-user'))
        .rejects.toThrow('User not found');
    });

    it('should throw error if user has no JWT secrets', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ jwt_secret: null, jwt_refresh_secret: null }],
        rowCount: 1
      } as any);

      await expect(userSecurityManager.getUserJWTSecrets(mockUser.id))
        .rejects.toThrow('User JWT secrets not found');
    });
  });

  describe('generateUserAccessToken', () => {
    it('should generate access token using user-specific secret', async () => {
      const mockSecrets = {
        jwt_secret: 'test-jwt-secret',
        jwt_refresh_secret: 'test-refresh-secret'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockSecrets],
        rowCount: 1
      } as any);

      const token = await userSecurityManager.generateUserAccessToken(mockUser);

      expect(typeof token).toBe('string');
      
      // Verify token can be decoded with the correct secret
      const decoded = jwt.verify(token, mockSecrets.jwt_secret) as any;
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.email).toBe(mockUser.email);
      expect(decoded.role).toBe(mockUser.role);
      expect(decoded.tenantId).toBe(mockUser.tenantId);
    });
  });

  describe('generateUserRefreshToken', () => {
    it('should generate refresh token using user-specific secret', async () => {
      const mockSecrets = {
        jwt_secret: 'test-jwt-secret',
        jwt_refresh_secret: 'test-refresh-secret'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockSecrets],
        rowCount: 1
      } as any);

      const token = await userSecurityManager.generateUserRefreshToken(mockUser);

      expect(typeof token).toBe('string');
      
      // Verify token can be decoded with the correct refresh secret
      const decoded = jwt.verify(token, mockSecrets.jwt_refresh_secret) as any;
      expect(decoded.userId).toBe(mockUser.id);
    });
  });

  describe('validateUserAccessToken', () => {
    it('should validate access token with user-specific secret', async () => {
      const mockSecrets = {
        jwt_secret: 'test-jwt-secret',
        jwt_refresh_secret: 'test-refresh-secret'
      };

      // Mock getting secrets
      mockPool.query.mockResolvedValueOnce({
        rows: [mockSecrets],
        rowCount: 1
      } as any);

      // Generate a token first
      const token = jwt.sign(
        {
          userId: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          tenantId: mockUser.tenantId
        },
        mockSecrets.jwt_secret,
        { expiresIn: '15m' }
      );

      // Mock getting secrets again for validation
      mockPool.query.mockResolvedValueOnce({
        rows: [mockSecrets],
        rowCount: 1
      } as any);

      const result = await userSecurityManager.validateUserAccessToken(token, mockUser.id);

      expect(result.userId).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
      expect(result.role).toBe(mockUser.role);
      expect(result.tenantId).toBe(mockUser.tenantId);
    });

    it('should throw error for invalid token', async () => {
      const mockSecrets = {
        jwt_secret: 'test-jwt-secret',
        jwt_refresh_secret: 'test-refresh-secret'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockSecrets],
        rowCount: 1
      } as any);

      await expect(userSecurityManager.validateUserAccessToken('invalid-token', mockUser.id))
        .rejects.toThrow('Invalid access token');
    });

    it('should throw error for token user mismatch', async () => {
      const mockSecrets = {
        jwt_secret: 'test-jwt-secret',
        jwt_refresh_secret: 'test-refresh-secret'
      };

      // Generate token for different user
      const token = jwt.sign(
        {
          userId: 'different-user-id',
          email: 'different@example.com',
          role: UserRole.USER,
          tenantId: 'different-tenant-id'
        },
        mockSecrets.jwt_secret,
        { expiresIn: '15m' }
      );

      mockPool.query.mockResolvedValueOnce({
        rows: [mockSecrets],
        rowCount: 1
      } as any);

      await expect(userSecurityManager.validateUserAccessToken(token, mockUser.id))
        .rejects.toThrow('Invalid access token');
    });
  });

  describe('validateTokenWithUserLookup', () => {
    it('should validate token by first extracting user ID', async () => {
      const mockSecrets = {
        jwt_secret: 'test-jwt-secret',
        jwt_refresh_secret: 'test-refresh-secret'
      };

      // Generate a valid token
      const token = jwt.sign(
        {
          userId: mockUser.id,
          email: mockUser.email,
          role: mockUser.role,
          tenantId: mockUser.tenantId
        },
        mockSecrets.jwt_secret,
        { expiresIn: '15m' }
      );

      // Mock getting secrets for validation
      mockPool.query.mockResolvedValueOnce({
        rows: [mockSecrets],
        rowCount: 1
      } as any);

      const result = await userSecurityManager.validateTokenWithUserLookup(token);

      expect(result.userId).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
    });

    it('should throw error for malformed token', async () => {
      await expect(userSecurityManager.validateTokenWithUserLookup('malformed-token'))
        .rejects.toThrow('Token validation failed');
    });
  });

  describe('rotateUserSecrets', () => {
    it('should generate new secrets for a user', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      const newSecrets = await userSecurityManager.rotateUserSecrets(mockUser.id);

      expect(newSecrets).toHaveProperty('jwtSecret');
      expect(newSecrets).toHaveProperty('jwtRefreshSecret');
      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE users SET jwt_secret = $1, jwt_refresh_secret = $2 WHERE id = $3',
        [newSecrets.jwtSecret, newSecrets.jwtRefreshSecret, mockUser.id]
      );
    });
  });

  describe('ensureUserJWTSecrets', () => {
    it('should return existing secrets if they exist', async () => {
      const mockSecrets = {
        jwt_secret: 'existing-jwt-secret',
        jwt_refresh_secret: 'existing-refresh-secret'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockSecrets],
        rowCount: 1
      } as any);

      const result = await userSecurityManager.ensureUserJWTSecrets(mockUser.id);

      expect(result.jwtSecret).toBe(mockSecrets.jwt_secret);
      expect(result.jwtRefreshSecret).toBe(mockSecrets.jwt_refresh_secret);
    });

    it('should generate new secrets if they do not exist', async () => {
      // First call fails (no secrets)
      mockPool.query.mockRejectedValueOnce(new Error('User JWT secrets not found'));
      
      // Second call succeeds (generating new secrets)
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 1 } as any);

      const result = await userSecurityManager.ensureUserJWTSecrets(mockUser.id);

      expect(result).toHaveProperty('jwtSecret');
      expect(result).toHaveProperty('jwtRefreshSecret');
      expect(mockPool.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('hasValidJWTSecrets', () => {
    it('should return true if user has valid secrets', async () => {
      const mockSecrets = {
        jwt_secret: 'test-jwt-secret',
        jwt_refresh_secret: 'test-refresh-secret'
      };

      mockPool.query.mockResolvedValueOnce({
        rows: [mockSecrets],
        rowCount: 1
      } as any);

      const result = await userSecurityManager.hasValidJWTSecrets(mockUser.id);

      expect(result).toBe(true);
    });

    it('should return false if user has no secrets', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('User not found'));

      const result = await userSecurityManager.hasValidJWTSecrets(mockUser.id);

      expect(result).toBe(false);
    });
  });
});