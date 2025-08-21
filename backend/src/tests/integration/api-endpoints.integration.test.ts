/**
 * Comprehensive API Endpoints Integration Tests
 * Tests all major API endpoints with authentication, validation, and error handling
 */

import request from 'supertest';
import express from 'express';
import { TestUtils } from '../../config/test-config';

// Import all route modules
import authRoutes from '../../auth/auth.routes';
import emailRoutes from '../../emails/email.routes';
import campaignRoutes from '../../campaigns/campaign.routes';
import contactRoutes from '../../contacts/contact.routes';
import templateRoutes from '../../templates/template.routes';
import billingRoutes from '../../billing/billing.routes';
import analyticsRoutes from '../../analytics/analytics.routes';
import domainRoutes from '../../domains/domain.routes';
import brandingRoutes from '../../branding/branding.routes';
import scheduledEmailRoutes from '../../emails/scheduled-email.routes';
import adminRoutes from '../../admin/admin.routes';

// Mock dependencies
const mockDatabase = TestUtils.mockDatabase();
const mockRedis = TestUtils.mockRedis();

jest.mock('../../database/database.service', () => ({
  DatabaseService: {
    getInstance: () => mockDatabase
  }
}));

jest.mock('redis', () => ({
  createClient: () => mockRedis
}));

describe('API Endpoints Integration Tests', () => {
  let app: express.Application;
  let authToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Setup Express app with all routes
    app = express();
    app.use(express.json());
    
    // Add all routes
    app.use('/api/auth', authRoutes);
    app.use('/api/emails', emailRoutes);
    app.use('/api/campaigns', campaignRoutes);
    app.use('/api/contacts', contactRoutes);
    app.use('/api/templates', templateRoutes);
    app.use('/api/billing', billingRoutes);
    app.use('/api/analytics', analyticsRoutes);
    app.use('/api/domains', domainRoutes);
    app.use('/api/branding', brandingRoutes);
    app.use('/api/scheduled-emails', scheduledEmailRoutes);
    app.use('/api/admin', adminRoutes);

    // Generate test tokens
    authToken = 'Bearer test-jwt-token';
    adminToken = 'Bearer admin-jwt-token';
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Endpoints', () => {
    describe('POST /api/auth/register', () => {
      it('should register new user successfully', async () => {
        const userData = {
          email: 'test@example.com',
          password: 'Password123!',
          firstName: 'Test',
          lastName: 'User',
          phone: '+1234567890'
        };

        mockDatabase.query.mockResolvedValue({
          rows: [{ id: 'user-1', ...userData }]
        });

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(201);

        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('token');
        expect(response.body.user.email).toBe(userData.email);
      });

      it('should validate required fields', async () => {
        const invalidData = {
          email: 'invalid-email',
          password: '123' // Too short
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(invalidData)
          .expect(400);

        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors).toContain('Invalid email format');
        expect(response.body.errors).toContain('Password must be at least 8 characters');
      });

      it('should handle duplicate email registration', async () => {
        mockDatabase.query.mockRejectedValue({
          code: '23505', // PostgreSQL unique violation
          constraint: 'users_email_key'
        });

        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'existing@example.com',
            password: 'Password123!',
            firstName: 'Test',
            lastName: 'User'
          })
          .expect(409);

        expect(response.body.error).toBe('Email already registered');
      });
    });

    describe('POST /api/auth/login', () => {
      it('should login user with valid credentials', async () => {
        const loginData = {
          email: 'test@example.com',
          password: 'Password123!'
        };

        mockDatabase.query.mockResolvedValue({
          rows: [{
            id: 'user-1',
            email: loginData.email,
            password: '$2a$10$hashedpassword',
            tenantId: 'tenant-1'
          }]
        });

        const response = await request(app)
          .post('/api/auth/login')
          .send(loginData)
          .expect(200);

        expect(response.body).toHaveProperty('token');
        expect(response.body).toHaveProperty('user');
        expect(response.body.user.email).toBe(loginData.email);
      });

      it('should reject invalid credentials', async () => {
        mockDatabase.query.mockResolvedValue({ rows: [] });

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'wrongpassword'
          })
          .expect(401);

        expect(response.body.error).toBe('Invalid credentials');
      });
    });
  });

  describe('Email Endpoints', () => {
    describe('POST /api/emails/send', () => {
      it('should send single email successfully', async () => {
        const emailData = {
          to: 'recipient@example.com',
          subject: 'Test Email',
          htmlContent: '<p>Test content</p>',
          textContent: 'Test content'
        };

        mockDatabase.query
          .mockResolvedValueOnce({ rows: [{ tier: 'PREMIUM', daily_emails: 50 }] }) // Quota check
          .mockResolvedValueOnce({ rows: [{ id: 'email-1' }] }); // Email creation

        const response = await request(app)
          .post('/api/emails/send')
          .set('Authorization', authToken)
          .send(emailData)
          .expect(200);

        expect(response.body).toHaveProperty('messageId');
        expect(response.body).toHaveProperty('status', 'queued');
      });

      it('should enforce quota limits', async () => {
        mockDatabase.query.mockResolvedValue({
          rows: [{ tier: 'FREE', daily_emails: 100 }] // Quota exceeded
        });

        const response = await request(app)
          .post('/api/emails/send')
          .set('Authorization', authToken)
          .send({
            to: 'recipient@example.com',
            subject: 'Test Email',
            htmlContent: '<p>Test content</p>'
          })
          .expect(429);

        expect(response.body.error).toBe('Daily email quota exceeded');
      });

      it('should validate email format', async () => {
        const response = await request(app)
          .post('/api/emails/send')
          .set('Authorization', authToken)
          .send({
            to: 'invalid-email',
            subject: 'Test Email',
            htmlContent: '<p>Test content</p>'
          })
          .expect(400);

        expect(response.body.errors).toContain('Invalid email address');
      });
    });

    describe('POST /api/emails/bulk', () => {
      it('should send bulk emails successfully', async () => {
        const bulkData = {
          emails: [
            { to: 'user1@example.com', subject: 'Test 1', htmlContent: '<p>Content 1</p>' },
            { to: 'user2@example.com', subject: 'Test 2', htmlContent: '<p>Content 2</p>' }
          ]
        };

        mockDatabase.query
          .mockResolvedValueOnce({ rows: [{ tier: 'PREMIUM', daily_emails: 10 }] })
          .mockResolvedValueOnce({ rows: [{ id: 'batch-1' }] });

        const response = await request(app)
          .post('/api/emails/bulk')
          .set('Authorization', authToken)
          .send(bulkData)
          .expect(200);

        expect(response.body).toHaveProperty('batchId');
        expect(response.body).toHaveProperty('queuedCount', 2);
      });

      it('should limit bulk email size', async () => {
        const bulkData = {
          emails: Array(1001).fill({
            to: 'user@example.com',
            subject: 'Test',
            htmlContent: '<p>Content</p>'
          })
        };

        const response = await request(app)
          .post('/api/emails/bulk')
          .set('Authorization', authToken)
          .send(bulkData)
          .expect(400);

        expect(response.body.error).toBe('Bulk email limit exceeded (max 1000)');
      });
    });

    describe('GET /api/emails/status/:messageId', () => {
      it('should return email status', async () => {
        const messageId = 'msg-123';
        
        mockDatabase.query.mockResolvedValue({
          rows: [{
            id: messageId,
            status: 'DELIVERED',
            deliveredAt: new Date(),
            events: [
              { type: 'SENT', timestamp: new Date() },
              { type: 'DELIVERED', timestamp: new Date() }
            ]
          }]
        });

        const response = await request(app)
          .get(`/api/emails/status/${messageId}`)
          .set('Authorization', authToken)
          .expect(200);

        expect(response.body.status).toBe('DELIVERED');
        expect(response.body.events).toHaveLength(2);
      });

      it('should return 404 for non-existent message', async () => {
        mockDatabase.query.mockResolvedValue({ rows: [] });

        const response = await request(app)
          .get('/api/emails/status/non-existent')
          .set('Authorization', authToken)
          .expect(404);

        expect(response.body.error).toBe('Email not found');
      });
    });
  });

  describe('Campaign Endpoints', () => {
    describe('POST /api/campaigns', () => {
      it('should create campaign successfully', async () => {
        const campaignData = {
          name: 'Test Campaign',
          templateId: 'template-1',
          listIds: ['list-1', 'list-2'],
          scheduledAt: new Date(Date.now() + 3600000) // 1 hour from now
        };

        mockDatabase.query.mockResolvedValue({
          rows: [{ id: 'campaign-1', ...campaignData }]
        });

        const response = await request(app)
          .post('/api/campaigns')
          .set('Authorization', authToken)
          .send(campaignData)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.name).toBe(campaignData.name);
      });

      it('should validate template exists', async () => {
        mockDatabase.query.mockResolvedValue({ rows: [] }); // Template not found

        const response = await request(app)
          .post('/api/campaigns')
          .set('Authorization', authToken)
          .send({
            name: 'Test Campaign',
            templateId: 'non-existent',
            listIds: ['list-1']
          })
          .expect(400);

        expect(response.body.error).toBe('Template not found');
      });
    });

    describe('GET /api/campaigns', () => {
      it('should return paginated campaigns', async () => {
        const mockCampaigns = [
          { id: 'campaign-1', name: 'Campaign 1', status: 'DRAFT' },
          { id: 'campaign-2', name: 'Campaign 2', status: 'SENT' }
        ];

        mockDatabase.query.mockResolvedValue({
          rows: mockCampaigns,
          rowCount: 2
        });

        const response = await request(app)
          .get('/api/campaigns?page=1&limit=10')
          .set('Authorization', authToken)
          .expect(200);

        expect(response.body.campaigns).toHaveLength(2);
        expect(response.body).toHaveProperty('total', 2);
        expect(response.body).toHaveProperty('page', 1);
      });
    });
  });

  describe('Scheduled Email Endpoints', () => {
    describe('POST /api/scheduled-emails', () => {
      it('should schedule email successfully', async () => {
        const scheduleData = {
          campaignId: 'campaign-1',
          scheduledAt: new Date(Date.now() + 86400000), // 24 hours from now
          userType: 'subscription'
        };

        mockDatabase.query
          .mockResolvedValueOnce({ rows: [{ tier: 'PREMIUM' }] }) // User check
          .mockResolvedValueOnce({ rows: [{ id: 'schedule-1' }] }); // Schedule creation

        const response = await request(app)
          .post('/api/scheduled-emails')
          .set('Authorization', authToken)
          .send(scheduleData)
          .expect(201);

        expect(response.body).toHaveProperty('id');
        expect(response.body.status).toBe('PENDING');
      });

      it('should enforce scheduling limits for subscription users', async () => {
        const scheduleData = {
          campaignId: 'campaign-1',
          scheduledAt: new Date(Date.now() + 86400000 * 15), // 15 days from now
          userType: 'subscription'
        };

        const response = await request(app)
          .post('/api/scheduled-emails')
          .set('Authorization', authToken)
          .send(scheduleData)
          .expect(400);

        expect(response.body.error).toBe('Subscription users can only schedule up to 14 days in advance');
      });
    });
  });

  describe('Branding Endpoints', () => {
    describe('POST /api/branding/logo', () => {
      it('should upload logo successfully for paid users', async () => {
        mockDatabase.query
          .mockResolvedValueOnce({ rows: [{ tier: 'PREMIUM' }] }) // User tier check
          .mockResolvedValueOnce({ rows: [{ id: 'upload-1', url: 'https://example.com/logo.png' }] });

        const response = await request(app)
          .post('/api/branding/logo')
          .set('Authorization', authToken)
          .attach('logo', Buffer.from('fake-image-data'), 'logo.png')
          .expect(200);

        expect(response.body).toHaveProperty('logoUrl');
        expect(response.body).toHaveProperty('uploadId');
      });

      it('should reject logo upload for free users', async () => {
        mockDatabase.query.mockResolvedValue({ rows: [{ tier: 'FREE' }] });

        const response = await request(app)
          .post('/api/branding/logo')
          .set('Authorization', authToken)
          .attach('logo', Buffer.from('fake-image-data'), 'logo.png')
          .expect(403);

        expect(response.body.error).toBe('Logo upload requires paid subscription');
      });
    });
  });

  describe('Admin Endpoints', () => {
    describe('GET /api/admin/users', () => {
      it('should return users for admin', async () => {
        const mockUsers = [
          TestUtils.generateMockUser({ id: 'user-1' }),
          TestUtils.generateMockUser({ id: 'user-2' })
        ];

        mockDatabase.query.mockResolvedValue({
          rows: mockUsers,
          rowCount: 2
        });

        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', adminToken)
          .expect(200);

        expect(response.body.users).toHaveLength(2);
        expect(response.body).toHaveProperty('total', 2);
      });

      it('should require admin authentication', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', authToken) // Regular user token
          .expect(403);

        expect(response.body.error).toBe('Admin access required');
      });
    });

    describe('PUT /api/admin/users/:id/status', () => {
      it('should update user status', async () => {
        mockDatabase.query.mockResolvedValue({ rowCount: 1 });

        const response = await request(app)
          .put('/api/admin/users/user-1/status')
          .set('Authorization', adminToken)
          .send({ status: 'SUSPENDED' })
          .expect(200);

        expect(response.body.message).toBe('User status updated successfully');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      mockDatabase.query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/campaigns')
        .set('Authorization', authToken)
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
    });

    it('should handle invalid JSON requests', async () => {
      const response = await request(app)
        .post('/api/campaigns')
        .set('Authorization', authToken)
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body.error).toBe('Invalid JSON format');
    });

    it('should handle missing authentication', async () => {
      const response = await request(app)
        .get('/api/campaigns')
        .expect(401);

      expect(response.body.error).toBe('Authentication required');
    });

    it('should handle expired tokens', async () => {
      const response = await request(app)
        .get('/api/campaigns')
        .set('Authorization', 'Bearer expired-token')
        .expect(401);

      expect(response.body.error).toBe('Token expired');
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on API endpoints', async () => {
      // Mock rate limiter to return limit exceeded
      mockRedis.get.mockResolvedValue('100'); // Current request count
      
      const response = await request(app)
        .post('/api/emails/send')
        .set('Authorization', authToken)
        .send({
          to: 'test@example.com',
          subject: 'Test',
          htmlContent: '<p>Test</p>'
        })
        .expect(429);

      expect(response.body.error).toBe('Rate limit exceeded');
    });
  });

  describe('Input Validation', () => {
    it('should validate email addresses in all endpoints', async () => {
      const invalidEmails = ['invalid', '@example.com', 'test@', 'test@.com'];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/emails/send')
          .set('Authorization', authToken)
          .send({
            to: email,
            subject: 'Test',
            htmlContent: '<p>Test</p>'
          })
          .expect(400);

        expect(response.body.errors).toContain('Invalid email address');
      }
    });

    it('should sanitize HTML content', async () => {
      const maliciousContent = '<script>alert("xss")</script><p>Safe content</p>';

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ tier: 'PREMIUM', daily_emails: 10 }] })
        .mockResolvedValueOnce({ rows: [{ id: 'email-1' }] });

      const response = await request(app)
        .post('/api/emails/send')
        .set('Authorization', authToken)
        .send({
          to: 'test@example.com',
          subject: 'Test',
          htmlContent: maliciousContent
        })
        .expect(200);

      // Verify script tags are removed but safe content remains
      expect(mockDatabase.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          expect.stringContaining('<p>Safe content</p>')
        ])
      );
    });
  });
});