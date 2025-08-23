import { SessionManagementService } from '../services/session-management.service';
import { UserSecurityManager } from '../user-security-manager.service';
import pool from '../../config/database';
import redisClient from '../../config/redis';
import { User, UserRole, SubscriptionTier } from '../../shared/types';

// Mock dependencies
jest.mock('../../config/database');
jest.mock('../../config/redis');
jest.mock('../user-security-manager.service');

describe('SessionManagementService', () => {
  let sessionService: SessionManagementService;
  let mockPool: jest.Mocked<typeof pool>;
  let mockRedis: jest.Mocked<typeof redisClient>;
  let mockUserSecurityManager: jest.Mocked<UserSecurityManager>;

  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    phone: '+1234567890',
    firstName: 'Test',
    lastName: 'User',
    tenantId: 'tenant-123',
    role: UserRole.USER,
    subscriptionTier: SubscriptionTier.FREE,
    isEmailVerified: true,
    isPhoneVerified: true,
    createdAt: new Date(),
    lastLoginAt: new Date()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    sessionService = new SessionManagementService();
    mockPool = pool as jest.Mocked<typeof pool>;
    mockRedis = redisClient as jest.Mocked<typeof redisClient>;
    mockUserSecurityManager = new UserSecurityManager() as jest.Mocked<UserSecurityManager>;

    // Mock pool.connect()
    const mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    mockPool.connect.mockResolvedValue(mockClient as any);
  });

  describe('createSession', () => {
    it('should create a new session successfully', async () => {
      const mockClient = await mockPool.connect();
      const mockAccessToken = 'access-token-123';
      const mockRefreshToken = 'refresh-token-123';

      // Mock UserSecurityManager methods
      mockUserSecurityManager.ensureUserJWTSecrets.mockResolvedValue({
        jwtSecret: 'jwt-secret',
        jwtRefreshSecret: 'refresh-secret'
      });
      mockUserSecurityManager.generateUserAccessToken.mockResolvedValue(mockAccessToken);
      mockUserSecurityManager.generateUserRefreshToken.mockResolvedValue(mockRefreshToken);

      // Mock database operations
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // INSERT session
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }) // COUNT sessions
        .mockResolvedValueOnce({ rows: [] }) // UPDATE last_login_at
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      // Mock Redis operations
      mockRedis.setEx.mockResolvedValue('OK');

      const result = await sessionService.createSession({
        user: mockUser,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent'
      });

      expect(result).toEqual({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        expiresIn: 15 * 60,
        user: { ...mockUser, lastLoginAt: expect.any(Date) }
      });

      expect(mockUserSecurityManager.ensureUserJWTSecrets).toHaveBeenCalledWith(mockUser.id);
      expect(mockUserSecurityManager.generateUserAccessToken).toHaveBeenCalledWith(mockUser);
      expect(mockUserSecurityManager.generateUserRefreshToken).toHaveBeenCalledWith(mockUser);
      expect(mockRedis.setEx).toHaveBeenCalledWith(
        expect.stringMatching(/^refresh_token:user-123:/),
        7 * 24 * 60 * 60,
        mockRefreshToken
      );
    });

    it('should handle database errors and rollback transaction', async () => {
      const mockClient = await mockPool.connect();
      
      mockUserSecurityManager.ensureUserJWTSecrets.mockResolvedValue({
        jwtSecret: 'jwt-secret',
        jwtRefreshSecret: 'refresh-secret'
      });
      mockUserSecurityManager.generateUserAccessToken.mockResolvedValue('access-token');
      mockUserSecurityManager.generateUserRefreshToken.mockResolvedValue('refresh-token');

      // Mock database error
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // INSERT fails

      await expect(sessionService.createSession({
        user: mockUser,
        ipAddress: '127.0.0.1'
      })).rejects.toThrow('Failed to create session');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('refreshSession', () => {
    it('should refresh session successfully', async () => {
      const mockClient = await mockPool.connect();
      const mockRefreshToken = 'refresh-token-123';
      const mockNewAccessToken = 'new-access-token';
      const mockNewRefreshToken = 'new-refresh-token';

      // Mock JWT decode
      const jwt = require('jsonwebtoken');
      jest.spyOn(jwt, 'decode').mockReturnValue({ userId: mockUser.id });

      // Mock UserSecurityManager methods
      mockUserSecurityManager.validateUserRefreshToken.mockResolvedValue({ userId: mockUser.id });
      mockUserSecurityManager.generateUserAccessToken.mockResolvedValue(mockNewAccessToken);
      mockUserSecurityManager.generateUserRefreshToken.mockResolvedValue(mockNewRefreshToken);

      // Mock database operations
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ // SELECT session
          rows: [{
            id: 'session-123',
            user_id: mockUser.id,
            refresh_token: mockRefreshToken
          }]
        })
        .mockResolvedValueOnce({ // SELECT user
          rows: [{
            id: mockUser.id,
            email: mockUser.email,
            phone: mockUser.phone,
            first_name: mockUser.firstName,
            last_name: mockUser.lastName,
            tenant_id: mockUser.tenantId,
            role: mockUser.role,
            subscription_tier: mockUser.subscriptionTier,
            is_email_verified: mockUser.isEmailVerified,
            is_phone_verified: mockUser.isPhoneVerified,
            created_at: mockUser.createdAt,
            last_login_at: mockUser.lastLoginAt
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE session
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      // Mock Redis operations
      mockRedis.get.mockResolvedValue(mockRefreshToken);
      mockRedis.del.mockResolvedValue(1);
      mockRedis.setEx.mockResolvedValue('OK');

      const result = await sessionService.refreshSession(mockRefreshToken, '127.0.0.1');

      expect(result).toEqual({
        accessToken: mockNewAccessToken,
        refreshToken: mockNewRefreshToken,
        expiresIn: 15 * 60,
        user: mockUser
      });

      expect(mockUserSecurityManager.validateUserRefreshToken).toHaveBeenCalledWith(
        mockRefreshToken,
        mockUser.id
      );
    });

    it('should reject invalid refresh token', async () => {
      const mockClient = await mockPool.connect();
      const mockRefreshToken = 'invalid-refresh-token';

      // Mock JWT decode
      const jwt = require('jsonwebtoken');
      jest.spyOn(jwt, 'decode').mockReturnValue({ userId: mockUser.id });

      // Mock UserSecurityManager validation failure
      mockUserSecurityManager.validateUserRefreshToken.mockRejectedValue(
        new Error('Invalid refresh token')
      );

      mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN

      await expect(sessionService.refreshSession(mockRefreshToken)).rejects.toThrow('Invalid refresh token');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });
  });

  describe('invalidateSession', () => {
    it('should invalidate specific session', async () => {
      const mockClient = await mockPool.connect();
      const sessionId = 'session-123';

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // UPDATE session
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      mockRedis.del.mockResolvedValue(1);

      await sessionService.invalidateSession(mockUser.id, sessionId);

      expect(mockClient.query).toHaveBeenCalledWith(
        'UPDATE user_sessions SET is_active = false WHERE user_id = $1 AND id = $2',
        [mockUser.id, sessionId]
      );
      expect(mockRedis.del).toHaveBeenCalledWith(`refresh_token:${mockUser.id}:${sessionId}`);
    });

    it('should invalidate all sessions for user', async () => {
      const mockClient = await mockPool.connect();

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // UPDATE sessions
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      mockRedis.keys.mockResolvedValue(['refresh_token:user-123:session-1', 'refresh_token:user-123:session-2']);
      mockRedis.del.mockResolvedValue(2);

      await sessionService.invalidateSession(mockUser.id);

      expect(mockClient.query).toHaveBeenCalledWith(
        'UPDATE user_sessions SET is_active = false WHERE user_id = $1',
        [mockUser.id]
      );
      expect(mockRedis.keys).toHaveBeenCalledWith(`refresh_token:${mockUser.id}:*`);
    });
  });

  describe('getUserSessions', () => {
    it('should return active sessions for user', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          user_id: mockUser.id,
          jwt_token: 'token-1',
          refresh_token: 'refresh-1',
          expires_at: new Date(Date.now() + 86400000),
          created_at: new Date(),
          last_accessed_at: new Date(),
          ip_address: '127.0.0.1',
          user_agent: 'Test Agent',
          is_active: true
        }
      ];

      mockPool.query.mockResolvedValue({ rows: mockSessions });

      const result = await sessionService.getUserSessions(mockUser.id);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'session-1',
        userId: mockUser.id,
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent',
        isActive: true
      });
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should clean up expired sessions', async () => {
      const mockClient = await mockPool.connect();
      const expiredSessions = [
        { user_id: 'user-1', id: 'session-1' },
        { user_id: 'user-2', id: 'session-2' }
      ];

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: expiredSessions }) // SELECT expired sessions
        .mockResolvedValueOnce({ rows: [], rowCount: 2 }) // DELETE expired sessions
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      mockRedis.del.mockResolvedValue(1);

      await sessionService.cleanupExpiredSessions();

      expect(mockRedis.del).toHaveBeenCalledTimes(2);
      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM user_sessions WHERE expires_at <= NOW() OR is_active = false'
      );
    });
  });
});