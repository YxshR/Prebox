import { SubscriberManagementService } from './subscriber-management.service';
import pool from '../config/database';
import { SubscriptionStatus, SuppressionType, EngagementEventType } from './contact.types';

// Mock the database pool
jest.mock('../config/database');
const mockPool = pool as any;

describe('SubscriberManagementService', () => {
  let service: SubscriberManagementService;
  let mockClient: any;

  beforeEach(() => {
    service = new SubscriberManagementService();
    mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };
    mockPool.connect.mockResolvedValue(mockClient);
    mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleOneClickUnsubscribe', () => {
    it('should successfully unsubscribe with valid token', async () => {
      const email = 'test@example.com';
      const campaignId = 'campaign-123';
      const token = service.generateUnsubscribeToken(email, campaignId);

      // Mock contact lookup
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{
            id: 'contact-123',
            tenant_id: 'tenant-123',
            email: email,
            subscription_status: SubscriptionStatus.SUBSCRIBED
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE contact
        .mockResolvedValueOnce({ rows: [] }) // INSERT suppression
        .mockResolvedValueOnce({ rows: [] }) // INSERT engagement event
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await service.handleOneClickUnsubscribe(token, '127.0.0.1', 'Test Agent');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Successfully unsubscribed from all future emails');
      expect(result.contactId).toBe('contact-123');
    });

    it('should handle invalid token', async () => {
      const result = await service.handleOneClickUnsubscribe('invalid-token');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Invalid or expired unsubscribe token');
    });

    it('should handle already unsubscribed contact', async () => {
      const email = 'test@example.com';
      const token = service.generateUnsubscribeToken(email);

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{
            id: 'contact-123',
            tenant_id: 'tenant-123',
            email: email,
            subscription_status: SubscriptionStatus.UNSUBSCRIBED
          }]
        });

      const result = await service.handleOneClickUnsubscribe(token);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Email address is already unsubscribed');
    });

    it('should handle contact not found', async () => {
      const email = 'notfound@example.com';
      const token = service.generateUnsubscribeToken(email);

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // Contact lookup - empty

      const result = await service.handleOneClickUnsubscribe(token);

      expect(result.success).toBe(false);
      expect(result.message).toBe('Email address not found in our system');
    });
  });

  describe('handleManualUnsubscribe', () => {
    it('should successfully process manual unsubscribe', async () => {
      const request = {
        email: 'test@example.com',
        reason: 'user_request',
        campaignId: 'campaign-123',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Agent'
      };

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{
            id: 'contact-123',
            tenant_id: 'tenant-123',
            email: request.email,
            subscription_status: SubscriptionStatus.SUBSCRIBED
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // UPDATE contact
        .mockResolvedValueOnce({ rows: [] }) // INSERT suppression
        .mockResolvedValueOnce({ rows: [] }) // INSERT engagement event
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await service.handleManualUnsubscribe(request);

      expect(result.success).toBe(true);
      expect(result.contactId).toBe('contact-123');
    });
  });

  describe('getSubscriberPreferences', () => {
    it('should return subscriber preferences', async () => {
      const tenantId = 'tenant-123';
      const contactId = 'contact-123';

      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: contactId,
          email: 'test@example.com',
          subscription_status: SubscriptionStatus.SUBSCRIBED,
          preferences: {
            marketing: true,
            transactional: true,
            newsletters: false,
            promotions: true
          },
          frequency: 'weekly',
          categories: ['tech', 'business'],
          preferences_updated: new Date(),
          updated_at: new Date()
        }]
      });

      const result = await service.getSubscriberPreferences(tenantId, contactId);

      expect(result).toBeDefined();
      expect(result?.contactId).toBe(contactId);
      expect(result?.preferences.marketing).toBe(true);
      expect(result?.frequency).toBe('weekly');
    });

    it('should return null for non-existent contact', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getSubscriberPreferences('tenant-123', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('updateSubscriberPreferences', () => {
    it('should update subscriber preferences', async () => {
      const tenantId = 'tenant-123';
      const contactId = 'contact-123';
      const updates = {
        preferences: {
          marketing: false,
          transactional: true,
          newsletters: true,
          promotions: false
        },
        frequency: 'monthly' as const
      };

      // Mock contact verification
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: contactId }] }) // Contact check
        .mockResolvedValueOnce({ rows: [] }) // INSERT/UPDATE preferences
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      // Mock getSubscriberPreferences call
      mockPool.query.mockResolvedValueOnce({
        rows: [{
          id: contactId,
          email: 'test@example.com',
          subscription_status: SubscriptionStatus.SUBSCRIBED,
          preferences: updates.preferences,
          frequency: updates.frequency,
          categories: [],
          preferences_updated: new Date(),
          updated_at: new Date()
        }]
      });

      const result = await service.updateSubscriberPreferences(tenantId, contactId, updates);

      expect(result.contactId).toBe(contactId);
      expect(result.frequency).toBe('monthly');
    });

    it('should throw error for non-existent contact', async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // Contact check - empty

      await expect(
        service.updateSubscriberPreferences('tenant-123', 'nonexistent', {})
      ).rejects.toThrow('Contact not found');
    });
  });

  describe('deduplicateContacts', () => {
    it('should deduplicate contacts successfully', async () => {
      const tenantId = 'tenant-123';

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [{
            email: 'duplicate@example.com',
            contact_ids: ['contact-1', 'contact-2', 'contact-3'],
            count: 3
          }]
        }) // Find duplicates
        .mockResolvedValueOnce({ rows: [] }) // Update engagement events
        .mockResolvedValueOnce({ rows: [] }) // Merge list memberships
        .mockResolvedValueOnce({ rows: [] }) // Delete duplicate memberships
        .mockResolvedValueOnce({ rows: [] }) // Delete duplicate contacts
        .mockResolvedValueOnce({ rows: [{ count: '100' }] }) // Total contacts
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      const result = await service.deduplicateContacts(tenantId);

      expect(result.duplicatesFound).toBe(1);
      expect(result.duplicatesRemoved).toBe(2);
      expect(result.contactsProcessed).toBe(102);
      expect(result.mergedContacts).toHaveLength(1);
    });
  });

  describe('getContactHistory', () => {
    it('should return contact history', async () => {
      const tenantId = 'tenant-123';
      const contactId = 'contact-123';

      // Mock contact verification
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: contactId }] })
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 'event-1',
            contact_id: contactId,
            campaign_id: 'campaign-1',
            event_type: EngagementEventType.OPENED,
            event_data: { test: 'data' },
            ip_address: '127.0.0.1',
            user_agent: 'Test Agent',
            timestamp: new Date()
          }]
        });

      const result = await service.getContactHistory(tenantId, contactId);

      expect(result.total).toBe(5);
      expect(result.history).toHaveLength(1);
      expect(result.history[0].eventType).toBe(EngagementEventType.OPENED);
    });

    it('should throw error for non-existent contact', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.getContactHistory('tenant-123', 'nonexistent')
      ).rejects.toThrow('Contact not found');
    });
  });

  describe('getContactEngagementAnalytics', () => {
    it('should return engagement analytics', async () => {
      const tenantId = 'tenant-123';
      const contactId = 'contact-123';

      // Mock contact lookup
      mockPool.query
        .mockResolvedValueOnce({
          rows: [{
            id: contactId,
            email: 'test@example.com'
          }]
        })
        .mockResolvedValueOnce({
          rows: [{
            total_sent: '10',
            total_delivered: '9',
            total_opened: '5',
            total_clicked: '2',
            total_bounced: '1',
            total_complaints: '0',
            last_engagement: new Date()
          }]
        })
        .mockResolvedValueOnce({ rows: [] }); // Trend calculation

      const result = await service.getContactEngagementAnalytics(tenantId, contactId);

      expect(result).toBeDefined();
      expect(result?.contactId).toBe(contactId);
      expect(result?.totalSent).toBe(10);
      expect(result?.totalOpened).toBe(5);
      expect(result?.engagementScore).toBeGreaterThan(0);
    });

    it('should return null for non-existent contact', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await service.getContactEngagementAnalytics('tenant-123', 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('generateUnsubscribeToken', () => {
    it('should generate valid token', () => {
      const email = 'test@example.com';
      const campaignId = 'campaign-123';

      const token = service.generateUnsubscribeToken(email, campaignId);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate different tokens for different inputs', () => {
      const token1 = service.generateUnsubscribeToken('test1@example.com');
      const token2 = service.generateUnsubscribeToken('test2@example.com');

      expect(token1).not.toBe(token2);
    });
  });

  describe('token validation', () => {
    it('should validate fresh token', () => {
      const email = 'test@example.com';
      const token = service.generateUnsubscribeToken(email);

      // Access private method for testing
      const decoded = (service as any).decodeUnsubscribeToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.email).toBe(email);
    });

    it('should reject invalid token', () => {
      const decoded = (service as any).decodeUnsubscribeToken('invalid-token');

      expect(decoded).toBeNull();
    });
  });
});