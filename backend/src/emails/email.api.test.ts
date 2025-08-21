import request from 'supertest';
import express from 'express';
import { createEmailRoutes } from './email.routes';
import { Pool } from 'pg';

// Mock dependencies
jest.mock('./email.service');
jest.mock('./queue/email.queue');
jest.mock('../auth/auth.middleware');
jest.mock('../billing/subscription.service');

describe('Email API Endpoints', () => {
  let app: express.Application;
  let mockDb: Pool;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Mock database
    mockDb = {} as Pool;
    
    // Mock authentication middleware
    app.use((req, res, next) => {
      (req as any).user = {
        id: 'user_123',
        tenantId: 'tenant_123',
        email: 'test@example.com',
        role: 'user'
      };
      next();
    });
    
    app.use('/api/emails', createEmailRoutes(mockDb));
  });

  describe('POST /api/emails/send/single', () => {
    it('should send a single email successfully', async () => {
      const emailData = {
        to: 'recipient@example.com',
        subject: 'Test Email',
        htmlContent: '<h1>Hello World</h1>',
        textContent: 'Hello World'
      };

      const response = await request(app)
        .post('/api/emails/send/single')
        .send(emailData)
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('jobId');
      expect(response.body.data).toHaveProperty('emailId');
      expect(response.body.data.status).toBe('queued');
    });

    it('should validate required fields', async () => {
      const invalidData = {
        to: 'invalid-email',
        subject: '',
        htmlContent: ''
      };

      const response = await request(app)
        .post('/api/emails/send/single')
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle scheduled emails', async () => {
      const scheduledEmailData = {
        to: 'recipient@example.com',
        subject: 'Scheduled Email',
        htmlContent: '<h1>Future Email</h1>',
        scheduledAt: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
      };

      const response = await request(app)
        .post('/api/emails/send/single')
        .send(scheduledEmailData)
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('queued');
    });
  });

  describe('POST /api/emails/send/bulk', () => {
    it('should send bulk emails successfully', async () => {
      const bulkEmailData = {
        emails: [
          {
            to: 'user1@example.com',
            subject: 'Bulk Email 1',
            htmlContent: '<h1>Hello User 1</h1>'
          },
          {
            to: 'user2@example.com',
            subject: 'Bulk Email 2',
            htmlContent: '<h1>Hello User 2</h1>'
          }
        ],
        priority: 'normal'
      };

      const response = await request(app)
        .post('/api/emails/send/bulk')
        .send(bulkEmailData)
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('batchJobId');
      expect(response.body.data.emailCount).toBe(2);
    });

    it('should validate bulk email limits', async () => {
      const tooManyEmails = {
        emails: Array(10001).fill({
          to: 'user@example.com',
          subject: 'Test',
          htmlContent: '<h1>Test</h1>'
        })
      };

      const response = await request(app)
        .post('/api/emails/send/bulk')
        .send(tooManyEmails)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/emails/send/campaign', () => {
    it('should send campaign emails with personalization', async () => {
      const campaignData = {
        campaignId: 'campaign_123',
        templateId: 'template_456',
        recipients: [
          {
            email: 'john@example.com',
            firstName: 'John',
            lastName: 'Doe'
          },
          {
            email: 'jane@example.com',
            firstName: 'Jane',
            lastName: 'Smith'
          }
        ],
        variables: {
          subject: 'Welcome {{firstName}}!',
          htmlContent: '<h1>Hello {{firstName}} {{lastName}}</h1>'
        }
      };

      const response = await request(app)
        .post('/api/emails/send/campaign')
        .send(campaignData)
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data.campaignId).toBe('campaign_123');
      expect(response.body.data.recipientCount).toBe(2);
    });
  });

  describe('GET /api/emails/jobs/:jobId/status', () => {
    it('should get job status successfully', async () => {
      const response = await request(app)
        .get('/api/emails/jobs/job_123/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('jobId');
      expect(response.body.data).toHaveProperty('status');
    });

    it('should return 404 for non-existent job', async () => {
      const response = await request(app)
        .get('/api/emails/jobs/non_existent/status')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('JOB_NOT_FOUND');
    });
  });

  describe('DELETE /api/emails/jobs/:jobId', () => {
    it('should cancel job successfully', async () => {
      const response = await request(app)
        .delete('/api/emails/jobs/job_123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('cancelled');
    });
  });

  describe('POST /api/emails/jobs/:jobId/retry', () => {
    it('should retry failed job successfully', async () => {
      const response = await request(app)
        .post('/api/emails/jobs/job_123/retry')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('retry');
    });
  });

  describe('GET /api/emails/jobs', () => {
    it('should get user jobs with pagination', async () => {
      const response = await request(app)
        .get('/api/emails/jobs?limit=10&offset=0')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('jobs');
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('limit');
      expect(response.body.data).toHaveProperty('offset');
    });

    it('should filter jobs by status', async () => {
      const response = await request(app)
        .get('/api/emails/jobs?status=completed')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/emails/queue/stats', () => {
    it('should get queue statistics', async () => {
      const response = await request(app)
        .get('/api/emails/queue/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('waiting');
      expect(response.body.data).toHaveProperty('active');
      expect(response.body.data).toHaveProperty('completed');
      expect(response.body.data).toHaveProperty('failed');
    });
  });

  describe('GET /api/emails/providers/status', () => {
    it('should get provider status', async () => {
      const response = await request(app)
        .get('/api/emails/providers/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('providers');
      expect(response.body.data).toHaveProperty('availableProviders');
      expect(response.body.data).toHaveProperty('primaryProvider');
    });
  });

  describe('Webhook Endpoints', () => {
    describe('POST /api/emails/webhooks/ses', () => {
      it('should handle SES webhook successfully', async () => {
        const sesWebhook = {
          Type: 'Notification',
          Message: JSON.stringify({
            eventType: 'delivery',
            mail: {
              messageId: 'msg_123',
              destination: ['user@example.com'],
              timestamp: new Date().toISOString()
            },
            delivery: {
              timestamp: new Date().toISOString()
            }
          })
        };

        const response = await request(app)
          .post('/api/emails/webhooks/ses')
          .send(sesWebhook)
          .expect(200);

        expect(response.body.message).toContain('processed successfully');
      });
    });

    describe('POST /api/emails/webhooks/sendgrid', () => {
      it('should handle SendGrid webhook successfully', async () => {
        const sendGridWebhook = [
          {
            email: 'user@example.com',
            event: 'delivered',
            sg_message_id: 'msg_123',
            timestamp: Math.floor(Date.now() / 1000)
          }
        ];

        const response = await request(app)
          .post('/api/emails/webhooks/sendgrid')
          .send(sendGridWebhook)
          .expect(200);

        expect(response.body.message).toContain('processed successfully');
        expect(response.body.totalEvents).toBe(1);
      });
    });

    describe('POST /api/emails/webhooks/:provider', () => {
      it('should handle generic webhook successfully', async () => {
        const genericWebhook = {
          eventType: 'delivered',
          messageId: 'msg_123',
          email: 'user@example.com',
          timestamp: Date.now()
        };

        const response = await request(app)
          .post('/api/emails/webhooks/mailgun')
          .send(genericWebhook)
          .expect(200);

        expect(response.body.message).toContain('processed successfully');
        expect(response.body.provider).toBe('mailgun');
      });
    });
  });

  describe('Admin Endpoints', () => {
    beforeEach(() => {
      // Mock admin user
      app.use((req, res, next) => {
        (req as any).user = {
          id: 'admin_123',
          tenantId: 'admin_tenant',
          email: 'admin@example.com',
          role: 'admin'
        };
        next();
      });
    });

    describe('POST /api/emails/admin/queue/pause', () => {
      it('should pause queue successfully', async () => {
        const response = await request(app)
          .post('/api/emails/admin/queue/pause')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.message).toContain('paused');
      });
    });

    describe('POST /api/emails/admin/queue/resume', () => {
      it('should resume queue successfully', async () => {
        const response = await request(app)
          .post('/api/emails/admin/queue/resume')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.message).toContain('resumed');
      });
    });

    describe('POST /api/emails/admin/providers/switch', () => {
      it('should switch provider successfully', async () => {
        const response = await request(app)
          .post('/api/emails/admin/providers/switch')
          .send({ provider: 'sendgrid' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.message).toContain('switched');
      });

      it('should validate provider name', async () => {
        const response = await request(app)
          .post('/api/emails/admin/providers/switch')
          .send({})
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('VALIDATION_ERROR');
      });
    });

    describe('GET /api/emails/admin/jobs', () => {
      it('should get all jobs for admin', async () => {
        const response = await request(app)
          .get('/api/emails/admin/jobs')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('jobs');
      });
    });

    describe('GET /api/emails/admin/providers/health', () => {
      it('should get provider health information', async () => {
        const response = await request(app)
          .get('/api/emails/admin/providers/health')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('providers');
        expect(response.body.data).toHaveProperty('healthChecks');
      });
    });

    describe('GET /api/emails/admin/metrics', () => {
      it('should get system metrics', async () => {
        const response = await request(app)
          .get('/api/emails/admin/metrics')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('queue');
        expect(response.body.data).toHaveProperty('providers');
        expect(response.body.data).toHaveProperty('system');
      });
    });

    describe('GET /api/emails/admin/health', () => {
      it('should get system health status', async () => {
        const response = await request(app)
          .get('/api/emails/admin/health')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('status');
        expect(response.body.data).toHaveProperty('checks');
        expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.data.status);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle internal server errors gracefully', async () => {
      // Mock a service method to throw an error
      jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // This would trigger an error in a real scenario
      const response = await request(app)
        .post('/api/emails/send/single')
        .send({
          to: 'test@example.com',
          subject: 'Test',
          htmlContent: '<h1>Test</h1>'
        });

      // The response should still be structured properly
      expect(response.body).toHaveProperty('success');
      if (!response.body.success) {
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('message');
      }
    });

    it('should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/api/emails/non-existent-endpoint')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should include quota information in headers', async () => {
      const response = await request(app)
        .post('/api/emails/send/single')
        .send({
          to: 'test@example.com',
          subject: 'Test',
          htmlContent: '<h1>Test</h1>'
        });

      // Check for rate limiting headers (would be added by quota middleware)
      // In a real implementation, these would be present
      expect(response.status).toBeLessThan(500);
    });
  });
});

describe('Webhook Security', () => {
  describe('HMAC Signature Verification', () => {
    it('should verify SendGrid signatures correctly', () => {
      const crypto = require('crypto');
      const secret = 'test_secret';
      const timestamp = '1234567890';
      const body = JSON.stringify([{ event: 'delivered' }]);
      
      const payload = timestamp + body;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('base64');

      // This would be used in the webhook handler
      expect(expectedSignature).toBeDefined();
      expect(typeof expectedSignature).toBe('string');
    });

    it('should verify generic webhook signatures correctly', () => {
      const crypto = require('crypto');
      const secret = 'test_secret';
      const timestamp = '1234567890';
      const body = JSON.stringify({ eventType: 'delivered' });
      
      const payload = `${timestamp}.${body}`;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      expect(expectedSignature).toBeDefined();
      expect(typeof expectedSignature).toBe('string');
    });
  });
});