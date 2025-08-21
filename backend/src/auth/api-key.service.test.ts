import { ApiKeyService, ApiKeyCreateRequest } from './api-key.service';
import { SubscriptionTier } from '../shared/types';
import pool from '../config/database';

// Mock the database pool
jest.mock('../config/database', () => ({
  connect: jest.fn(),
  query: jest.fn()
}));

// Mock bcrypt
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_key'),
  compare: jest.fn()
}));

describe('ApiKeyService', () => {
  let apiKeyService: ApiKeyService;
  let mockClient: any;

  beforeEach(() => {
    apiKeyService = new ApiKeyService();
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    (pool.connect as jest.Mock).mockResolvedValue(mockClient);
    (pool.query as jest.Mock).mockClear();
    mockClient.query.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateApiKey', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';
    const request: ApiKeyCreateRequest = {
      name: 'Test API Key',
      scopes: ['email:send', 'email:read']
    };

    it('should generate API key for free tier user', async () => {
      // Mock BEGIN transaction
      mockClient.query.mockResolvedValueOnce({});
      
      // Mock user tier check
      mockClient.query.mockResolvedValueOnce({
        rows: [{ subscription_tier: SubscriptionTier.FREE, existing_keys: '0' }]
      });
      
      // Mock API key insertion
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'api-key-123', ...request }]
      });
      
      // Mock rate limit initialization (multiple calls)
      mockClient.query.mockResolvedValue({});
      
      // Mock COMMIT
      mockClient.query.mockResolvedValueOnce({});

      const result = await apiKeyService.generateApiKey(userId, tenantId, request);

      expect(result).toMatchObject({
        userId,
        name: request.name,
        scopes: request.scopes,
        isActive: true
      });
      expect(result.key).toMatch(/^bep_/);
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('should reject API key creation when limit exceeded', async () => {
      // Mock BEGIN transaction
      mockClient.query.mockResolvedValueOnce({});
      
      // Mock user with max keys for free tier
      mockClient.query.mockResolvedValueOnce({
        rows: [{ subscription_tier: SubscriptionTier.FREE, existing_keys: '1' }]
      });

      // Mock ROLLBACK
      mockClient.query.mockResolvedValueOnce({});

      await expect(
        apiKeyService.generateApiKey(userId, tenantId, request)
      ).rejects.toThrow('Maximum API keys limit reached');

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    });

    it('should reject invalid scopes for subscription tier', async () => {
      const invalidRequest = {
        ...request,
        scopes: ['admin:read'] // Not allowed for free tier
      };

      // Mock BEGIN transaction
      mockClient.query.mockResolvedValueOnce({});
      
      // Mock user tier check
      mockClient.query.mockResolvedValueOnce({
        rows: [{ subscription_tier: SubscriptionTier.FREE, existing_keys: '0' }]
      });

      // Mock ROLLBACK
      mockClient.query.mockResolvedValueOnce({});

      await expect(
        apiKeyService.generateApiKey(userId, tenantId, invalidRequest)
      ).rejects.toThrow('Invalid scopes for free tier');
    });

    it('should allow more API keys for premium tier', async () => {
      // Mock BEGIN transaction
      mockClient.query.mockResolvedValueOnce({});
      
      // Mock user tier check
      mockClient.query.mockResolvedValueOnce({
        rows: [{ subscription_tier: SubscriptionTier.PREMIUM, existing_keys: '5' }]
      });
      
      // Mock API key insertion
      mockClient.query.mockResolvedValueOnce({
        rows: [{ id: 'api-key-123', ...request }]
      });
      
      // Mock rate limit initialization (multiple calls)
      mockClient.query.mockResolvedValue({});
      
      // Mock COMMIT
      mockClient.query.mockResolvedValueOnce({});

      const result = await apiKeyService.generateApiKey(userId, tenantId, request);

      expect(result).toBeDefined();
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('listApiKeys', () => {
    it('should return list of API keys without key values', async () => {
      const mockKeys = [
        {
          id: 'key-1',
          name: 'Key 1',
          scopes: '["email:send"]',
          is_active: true,
          last_used_at: new Date(),
          expires_at: null,
          created_at: new Date()
        }
      ];

      (pool.query as jest.Mock).mockResolvedValue({ rows: mockKeys });

      const result = await apiKeyService.listApiKeys('user-123');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'key-1',
        name: 'Key 1',
        scopes: ['email:send'],
        isActive: true
      });
      expect(result[0]).not.toHaveProperty('key');
    });
  });

  describe('revokeApiKey', () => {
    it('should revoke API key successfully', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rowCount: 1 });

      await apiKeyService.revokeApiKey('user-123', 'key-123');

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE api_keys'),
        ['key-123', 'user-123']
      );
    });

    it('should throw error if API key not found', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rowCount: 0 });

      await expect(
        apiKeyService.revokeApiKey('user-123', 'key-123')
      ).rejects.toThrow('API key not found or access denied');
    });
  });

  describe('validateApiKey', () => {
    const bcrypt = require('bcryptjs');

    it('should validate correct API key', async () => {
      const mockApiKeyData = {
        id: 'key-123',
        key_hash: 'hashed_key',
        scopes: '["email:send"]',
        user_id: 'user-123',
        email: 'test@example.com',
        tenant_id: 'tenant-123',
        role: 'user',
        subscription_tier: 'free',
        is_email_verified: true,
        is_phone_verified: false
      };

      (pool.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [mockApiKeyData] })
        .mockResolvedValueOnce({ rowCount: 1 });

      bcrypt.compare.mockResolvedValue(true);

      const result = await apiKeyService.validateApiKey('test-api-key');

      expect(result).toMatchObject({
        user: {
          id: 'user-123',
          email: 'test@example.com',
          tenantId: 'tenant-123'
        },
        apiKeyId: 'key-123',
        scopes: ['email:send']
      });
    });

    it('should throw error for invalid API key', async () => {
      (pool.query as jest.Mock).mockResolvedValue({ rows: [] });

      await expect(
        apiKeyService.validateApiKey('invalid-key')
      ).rejects.toThrow('Invalid API key');
    });
  });

  describe('getApiKeyUsage', () => {
    it('should return usage statistics', async () => {
      const mockUsage = {
        total_requests: '100',
        successful_requests: '95',
        failed_requests: '5',
        avg_response_time: '150.5',
        data_transferred: '1024000',
        unique_endpoints: '10',
        last_used: new Date()
      };

      (pool.query as jest.Mock).mockResolvedValue({ rows: [mockUsage] });

      const result = await apiKeyService.getApiKeyUsage('user-123', 'key-123', 7);

      expect(result).toMatchObject({
        totalRequests: 100,
        successfulRequests: 95,
        failedRequests: 5,
        avgResponseTime: 150.5,
        dataTransferred: 1024000,
        uniqueEndpoints: 10
      });
    });
  });

  describe('updateApiKey', () => {
    it('should update API key name and scopes', async () => {
      mockClient.query
        .mockResolvedValueOnce({
          rows: [{ subscription_tier: SubscriptionTier.PREMIUM }]
        })
        .mockResolvedValueOnce({ rowCount: 1 });

      const updates = {
        name: 'Updated Key Name',
        scopes: ['email:send', 'templates:read']
      };

      await apiKeyService.updateApiKey('user-123', 'key-123', updates);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE api_keys'),
        expect.arrayContaining(['Updated Key Name'])
      );
    });

    it('should reject invalid scopes during update', async () => {
      mockClient.query.mockResolvedValueOnce({
        rows: [{ subscription_tier: SubscriptionTier.FREE }]
      });

      const updates = {
        scopes: ['admin:read'] // Invalid for free tier
      };

      await expect(
        apiKeyService.updateApiKey('user-123', 'key-123', updates)
      ).rejects.toThrow('Invalid scopes for free tier');
    });
  });
});