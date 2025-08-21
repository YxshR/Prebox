/**
 * End-to-End User Workflow Tests
 * Tests complete user journeys from registration to email sending
 */

import request from 'supertest';
import express from 'express';
import { TestUtils } from '../../config/test-config';

// Mock dependencies
const mockDatabase = TestUtils.mockDatabase();
const mockRedis = TestUtils.mockRedis();
const mockEmailProvider = {
  sendEmail: jest.fn(),
  verifyDomain: jest.fn(),
  setupWebhooks: jest.fn()
};

jest.mock('../../database/database.service', () => ({
  DatabaseService: {
    getInstance: () => mockDatabase
  }
}));

jest.mock('../../emails/providers/ses.service', () => ({
  SESService: () => mockEmailProvider
}));

describe('End-to-End User Workflows', () => {
  let app: express.Application;
  let userToken: string;
  let userId: string;
  let tenantId: string;

  beforeAll(async () => {
    // Setup complete Express app
    app = express();
    app.use(express.json());
    
    // Add all routes (simplified for E2E)
    const { setupRoutes } = require('../../index');
    setupRoutes(app);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    userId = 'test-user-id';
    tenantId = 'test-tenant-id';
  });

  describe('Complete User Onboarding Flow', () => {
    it('should complete full user registration and onboarding', async () => {
      // Step 1: User Registration
      const registrationData = {
        email: 'newuser@example.com',
        password: 'SecurePassword123!',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890'
      };

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [] }) // Check email doesn't exist
        .mockResolvedValueOnce({ 
          rows: [{ 
            id: userId, 
            tenantId,
            ...registrationData,
            subscriptionTier: 'FREE',
            emailVerified: false
          }] 
        }); // Create user

      const registrationResponse = await request(app)
        .post('/api/auth/register')
        .send(registrationData)
        .expect(201);

      expect(registrationResponse.body).toHaveProperty('user');
      expect(registrationResponse.body).toHaveProperty('token');
      userToken = registrationResponse.body.token;

      // Step 2: Email Verification
      const verificationToken = 'verification-token-123';
      
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{ id: userId, emailVerified: true }]
      });

      await request(app)
        .post('/api/auth/verify-email')
        .send({ token: verificationToken })
        .expect(200);

      // Step 3: Complete Profile Setup
      const profileData = {
        companyName: 'Test Company',
        industry: 'Technology',
        expectedVolume: 'MEDIUM'
      };

      mockDatabase.query.mockResolvedValueOnce({ rowCount: 1 });

      await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${userToken}`)
        .send(profileData)
        .expect(200);

      // Step 4: Initial Dashboard Access
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ tier: 'FREE', dailyEmails: 0, monthlyEmails: 0 }] }) // Usage
        .mockResolvedValueOnce({ rows: [] }); // Campaigns

      const dashboardResponse = await request(app)
        .get('/api/analytics/dashboard')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(dashboardResponse.body).toHaveProperty('usage');
      expect(dashboardResponse.body).toHaveProperty('campaigns');
    });

    it('should handle phone verification flow', async () => {
      // Step 1: Request phone verification
      mockDatabase.query.mockResolvedValueOnce({ rowCount: 1 }); // Store OTP

      await request(app)
        .post('/api/auth/phone/send-otp')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ phone: '+1234567890' })
        .expect(200);

      // Step 2: Verify OTP
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{ otp: '123456', expiresAt: new Date(Date.now() + 300000) }]
      });

      await request(app)
        .post('/api/auth/phone/verify-otp')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ otp: '123456' })
        .expect(200);
    });
  });

  describe('Email Campaign Creation and Sending Workflow', () => {
    beforeEach(async () => {
      // Setup authenticated user
      mockDatabase.query.mockResolvedValue({
        rows: [TestUtils.generateMockUser({ id: userId, tenantId })]
      });
    });

    it('should complete full email campaign workflow', async () => {
      // Step 1: Create Email Template
      const templateData = {
        name: 'Welcome Email',
        subject: 'Welcome to our platform!',
        htmlContent: '<h1>Welcome {{firstName}}!</h1><p>Thanks for joining us.</p>',
        textContent: 'Welcome {{firstName}}! Thanks for joining us.',
        variables: ['firstName']
      };

      mockDatabase.query.mockResolvedValueOnce({
        rows: [{ id: 'template-1', ...templateData }]
      });

      const templateResponse = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${userToken}`)
        .send(templateData)
        .expect(201);

      const templateId = templateResponse.body.id;

      // Step 2: Import Contacts
      const contactsData = {
        contacts: [
          { email: 'contact1@example.com', firstName: 'Alice', lastName: 'Smith' },
          { email: 'contact2@example.com', firstName: 'Bob', lastName: 'Johnson' }
        ],
        listName: 'Welcome List'
      };

      mockDatabase.query.mockResolvedValueOnce({
        rows: [{ id: 'list-1', contactCount: 2 }]
      });

      const contactsResponse = await request(app)
        .post('/api/contacts/import')
        .set('Authorization', `Bearer ${userToken}`)
        .send(contactsData)
        .expect(200);

      const listId = contactsResponse.body.listId;

      // Step 3: Create Campaign
      const campaignData = {
        name: 'Welcome Campaign',
        templateId,
        listIds: [listId],
        scheduledAt: new Date(Date.now() + 3600000) // 1 hour from now
      };

      mockDatabase.query.mockResolvedValueOnce({
        rows: [{ id: 'campaign-1', ...campaignData, status: 'SCHEDULED' }]
      });

      const campaignResponse = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${userToken}`)
        .send(campaignData)
        .expect(201);

      const campaignId = campaignResponse.body.id;

      // Step 4: Send Campaign (or wait for scheduled time)
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ tier: 'PREMIUM', dailyEmails: 10 }] }) // Quota check
        .mockResolvedValueOnce({ rows: [{ id: 'batch-1' }] }); // Batch creation

      await request(app)
        .post(`/api/campaigns/${campaignId}/send`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      // Step 5: Monitor Campaign Progress
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          id: campaignId,
          status: 'SENDING',
          sent: 1,
          delivered: 0,
          opened: 0,
          clicked: 0
        }]
      });

      const statusResponse = await request(app)
        .get(`/api/campaigns/${campaignId}/status`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(statusResponse.body.status).toBe('SENDING');
      expect(statusResponse.body.sent).toBe(1);
    });

    it('should handle campaign with personalization', async () => {
      // Create template with advanced personalization
      const templateData = {
        name: 'Personalized Offer',
        subject: 'Special offer for {{firstName}} - {{offerType}}',
        htmlContent: `
          <h1>Hi {{firstName}}!</h1>
          <p>We have a special {{offerType}} offer just for you.</p>
          <p>Your location: {{city}}, {{country}}</p>
          <a href="{{offerUrl}}">Claim your offer</a>
        `,
        variables: ['firstName', 'offerType', 'city', 'country', 'offerUrl']
      };

      mockDatabase.query.mockResolvedValueOnce({
        rows: [{ id: 'template-2', ...templateData }]
      });

      const templateResponse = await request(app)
        .post('/api/templates')
        .set('Authorization', `Bearer ${userToken}`)
        .send(templateData)
        .expect(201);

      // Import contacts with custom fields
      const contactsData = {
        contacts: [
          {
            email: 'alice@example.com',
            firstName: 'Alice',
            customFields: {
              offerType: 'Premium',
              city: 'New York',
              country: 'USA',
              offerUrl: 'https://example.com/offer/alice'
            }
          }
        ],
        listName: 'Personalized List'
      };

      mockDatabase.query.mockResolvedValueOnce({
        rows: [{ id: 'list-2', contactCount: 1 }]
      });

      await request(app)
        .post('/api/contacts/import')
        .set('Authorization', `Bearer ${userToken}`)
        .send(contactsData)
        .expect(200);
    });
  });

  describe('Subscription Upgrade Workflow', () => {
    it('should complete subscription upgrade flow', async () => {
      // Step 1: View current subscription
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          tier: 'FREE',
          dailyLimit: 100,
          monthlyLimit: 2000,
          usage: { dailyEmails: 50, monthlyEmails: 500 }
        }]
      });

      const currentSubResponse = await request(app)
        .get('/api/billing/subscription')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(currentSubResponse.body.tier).toBe('FREE');

      // Step 2: Get available plans
      const plansResponse = await request(app)
        .get('/api/billing/plans')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(plansResponse.body).toHaveProperty('plans');
      expect(plansResponse.body.plans.length).toBeGreaterThan(0);

      // Step 3: Initiate upgrade
      const upgradeData = {
        planId: 'premium-monthly',
        paymentMethodId: 'pm_test_card'
      };

      mockDatabase.query.mockResolvedValueOnce({
        rows: [{ id: 'subscription-1', tier: 'PREMIUM', status: 'ACTIVE' }]
      });

      const upgradeResponse = await request(app)
        .post('/api/billing/upgrade')
        .set('Authorization', `Bearer ${userToken}`)
        .send(upgradeData)
        .expect(200);

      expect(upgradeResponse.body.subscription.tier).toBe('PREMIUM');

      // Step 4: Verify new limits
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          tier: 'PREMIUM',
          dailyLimit: 5000,
          monthlyLimit: 100000,
          customDomains: true
        }]
      });

      const newSubResponse = await request(app)
        .get('/api/billing/subscription')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(newSubResponse.body.tier).toBe('PREMIUM');
      expect(newSubResponse.body.dailyLimit).toBe(5000);
    });
  });

  describe('Custom Domain Setup Workflow', () => {
    it('should complete custom domain setup for premium users', async () => {
      // Ensure user has premium subscription
      mockDatabase.query.mockResolvedValue({
        rows: [{ tier: 'PREMIUM' }]
      });

      // Step 1: Add domain
      const domainData = {
        domain: 'mail.example.com',
        purpose: 'SENDING'
      };

      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          id: 'domain-1',
          domain: domainData.domain,
          status: 'PENDING_VERIFICATION',
          dnsRecords: [
            { type: 'TXT', name: '_dmarc', value: 'v=DMARC1; p=quarantine;' },
            { type: 'TXT', name: 'mail._domainkey', value: 'k=rsa; p=MIGfMA0...' }
          ]
        }]
      });

      const domainResponse = await request(app)
        .post('/api/domains')
        .set('Authorization', `Bearer ${userToken}`)
        .send(domainData)
        .expect(201);

      const domainId = domainResponse.body.id;
      expect(domainResponse.body.dnsRecords).toHaveLength(2);

      // Step 2: Verify domain
      mockEmailProvider.verifyDomain.mockResolvedValue({
        spfValid: true,
        dkimValid: true,
        dmarcValid: true
      });

      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          id: domainId,
          status: 'VERIFIED',
          verifiedAt: new Date()
        }]
      });

      const verifyResponse = await request(app)
        .post(`/api/domains/${domainId}/verify`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(verifyResponse.body.status).toBe('VERIFIED');

      // Step 3: Send email from custom domain
      const emailData = {
        to: 'recipient@example.com',
        subject: 'Test from custom domain',
        htmlContent: '<p>This email is sent from our custom domain</p>',
        fromDomain: 'mail.example.com'
      };

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ tier: 'PREMIUM', dailyEmails: 10 }] })
        .mockResolvedValueOnce({ rows: [{ id: 'email-1' }] });

      mockEmailProvider.sendEmail.mockResolvedValue({
        messageId: 'msg-123',
        status: 'queued'
      });

      const emailResponse = await request(app)
        .post('/api/emails/send')
        .set('Authorization', `Bearer ${userToken}`)
        .send(emailData)
        .expect(200);

      expect(emailResponse.body.messageId).toBe('msg-123');
    });
  });

  describe('Scheduled Email Workflow', () => {
    it('should complete scheduled email workflow', async () => {
      // Step 1: Create campaign
      const campaignData = {
        name: 'Scheduled Newsletter',
        templateId: 'template-1',
        listIds: ['list-1']
      };

      mockDatabase.query.mockResolvedValueOnce({
        rows: [{ id: 'campaign-1', ...campaignData }]
      });

      const campaignResponse = await request(app)
        .post('/api/campaigns')
        .set('Authorization', `Bearer ${userToken}`)
        .send(campaignData)
        .expect(201);

      // Step 2: Schedule for future delivery
      const scheduleData = {
        campaignId: campaignResponse.body.id,
        scheduledAt: new Date(Date.now() + 86400000), // 24 hours from now
        userType: 'subscription'
      };

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ tier: 'PREMIUM' }] }) // User check
        .mockResolvedValueOnce({ rows: [{ id: 'schedule-1', status: 'PENDING' }] });

      const scheduleResponse = await request(app)
        .post('/api/scheduled-emails')
        .set('Authorization', `Bearer ${userToken}`)
        .send(scheduleData)
        .expect(201);

      expect(scheduleResponse.body.status).toBe('PENDING');

      // Step 3: Check scheduled emails
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          id: 'schedule-1',
          campaignId: campaignResponse.body.id,
          scheduledAt: scheduleData.scheduledAt,
          status: 'PENDING'
        }]
      });

      const listResponse = await request(app)
        .get('/api/scheduled-emails')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(listResponse.body.scheduledEmails).toHaveLength(1);

      // Step 4: Cancel scheduled email
      mockDatabase.query.mockResolvedValueOnce({ rowCount: 1 });

      await request(app)
        .delete(`/api/scheduled-emails/${scheduleResponse.body.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);
    });
  });

  describe('Analytics and Reporting Workflow', () => {
    it('should provide comprehensive analytics workflow', async () => {
      // Step 1: Send some emails to generate data
      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ tier: 'PREMIUM', dailyEmails: 0 }] })
        .mockResolvedValueOnce({ rows: [{ id: 'email-1' }] });

      await request(app)
        .post('/api/emails/send')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          to: 'test@example.com',
          subject: 'Test Email',
          htmlContent: '<p>Test content</p>'
        })
        .expect(200);

      // Step 2: Simulate email events
      const events = [
        { type: 'SENT', messageId: 'msg-1', timestamp: new Date() },
        { type: 'DELIVERED', messageId: 'msg-1', timestamp: new Date() },
        { type: 'OPENED', messageId: 'msg-1', timestamp: new Date() }
      ];

      for (const event of events) {
        mockDatabase.query.mockResolvedValueOnce({ rowCount: 1 });
        
        await request(app)
          .post('/api/webhooks/email-events')
          .send(event)
          .expect(200);
      }

      // Step 3: View dashboard analytics
      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          totalSent: 1,
          totalDelivered: 1,
          totalOpened: 1,
          totalClicked: 0,
          deliveryRate: 100,
          openRate: 100,
          clickRate: 0
        }]
      });

      const analyticsResponse = await request(app)
        .get('/api/analytics/dashboard')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(analyticsResponse.body.deliveryRate).toBe(100);
      expect(analyticsResponse.body.openRate).toBe(100);

      // Step 4: Generate detailed report
      const reportData = {
        type: 'CAMPAIGN_PERFORMANCE',
        dateRange: {
          start: new Date(Date.now() - 86400000 * 7), // 7 days ago
          end: new Date()
        }
      };

      mockDatabase.query.mockResolvedValueOnce({
        rows: [{
          id: 'report-1',
          type: 'CAMPAIGN_PERFORMANCE',
          data: { campaigns: [], summary: {} },
          generatedAt: new Date()
        }]
      });

      const reportResponse = await request(app)
        .post('/api/analytics/reports')
        .set('Authorization', `Bearer ${userToken}`)
        .send(reportData)
        .expect(200);

      expect(reportResponse.body).toHaveProperty('id');
      expect(reportResponse.body.type).toBe('CAMPAIGN_PERFORMANCE');
    });
  });

  describe('Error Recovery Workflows', () => {
    it('should handle email sending failures gracefully', async () => {
      // Simulate email provider failure
      mockEmailProvider.sendEmail.mockRejectedValue(new Error('Provider unavailable'));

      mockDatabase.query
        .mockResolvedValueOnce({ rows: [{ tier: 'PREMIUM', dailyEmails: 0 }] })
        .mockResolvedValueOnce({ rows: [{ id: 'email-1' }] });

      const response = await request(app)
        .post('/api/emails/send')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          to: 'test@example.com',
          subject: 'Test Email',
          htmlContent: '<p>Test content</p>'
        })
        .expect(202); // Accepted but queued for retry

      expect(response.body.status).toBe('queued_for_retry');
    });

    it('should handle quota exceeded scenarios', async () => {
      // Simulate quota exceeded
      mockDatabase.query.mockResolvedValue({
        rows: [{ tier: 'FREE', dailyEmails: 100 }] // At limit
      });

      const response = await request(app)
        .post('/api/emails/send')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          to: 'test@example.com',
          subject: 'Test Email',
          htmlContent: '<p>Test content</p>'
        })
        .expect(429);

      expect(response.body.error).toBe('Daily email quota exceeded');
      expect(response.body).toHaveProperty('upgradeOptions');
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent email sending', async () => {
      const concurrentRequests = 10;
      const emailPromises = [];

      mockDatabase.query
        .mockResolvedValue({ rows: [{ tier: 'PREMIUM', dailyEmails: 0 }] })
        .mockResolvedValue({ rows: [{ id: 'email-1' }] });

      mockEmailProvider.sendEmail.mockResolvedValue({
        messageId: 'msg-123',
        status: 'queued'
      });

      for (let i = 0; i < concurrentRequests; i++) {
        const promise = request(app)
          .post('/api/emails/send')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            to: `test${i}@example.com`,
            subject: `Test Email ${i}`,
            htmlContent: `<p>Test content ${i}</p>`
          });
        
        emailPromises.push(promise);
      }

      const responses = await Promise.all(emailPromises);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});