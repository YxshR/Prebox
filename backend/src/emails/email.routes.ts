import { Router } from 'express';
import { Pool } from 'pg';
import { EmailController } from './email.controller';
import { WebhookHandler } from './webhook/webhook.handler';
import { AuthMiddleware } from '../auth/auth.middleware';
import { createDeliverabilityRoutes } from './deliverability.routes';
// Note: Quota middleware integration would be added here in production
import { validateRequest } from '../shared/validation.middleware';
import Joi from 'joi';

// Validation schemas
const singleEmailSchema = Joi.object({
  to: Joi.string().email().required(),
  subject: Joi.string().min(1).max(998).required(), // RFC 5322 limit
  htmlContent: Joi.string().min(1).required(),
  textContent: Joi.string().optional(),
  replyTo: Joi.string().email().optional(),
  priority: Joi.string().valid('low', 'normal', 'high', 'critical').default('normal'),
  scheduledAt: Joi.string().isoDate().optional(),
  campaignId: Joi.string().optional(),
  metadata: Joi.object().optional(),
  headers: Joi.object().pattern(Joi.string(), Joi.string()).optional()
});

const bulkEmailSchema = Joi.object({
  emails: Joi.array().items(
    Joi.object({
      to: Joi.string().email().required(),
      subject: Joi.string().min(1).max(998).required(),
      htmlContent: Joi.string().min(1).required(),
      textContent: Joi.string().optional(),
      replyTo: Joi.string().email().optional(),
      scheduledAt: Joi.string().isoDate().optional(),
      metadata: Joi.object().optional(),
      headers: Joi.object().pattern(Joi.string(), Joi.string()).optional()
    })
  ).min(1).max(10000).required(), // Limit batch size
  priority: Joi.string().valid('low', 'normal', 'high', 'critical').default('normal'),
  campaignId: Joi.string().optional()
});

const campaignEmailSchema = Joi.object({
  campaignId: Joi.string().required(),
  templateId: Joi.string().required(),
  recipients: Joi.array().items(
    Joi.object({
      email: Joi.string().email().required(),
      firstName: Joi.string().optional(),
      lastName: Joi.string().optional(),
      customFields: Joi.object().optional()
    })
  ).min(1).max(50000).required(),
  variables: Joi.object().optional(),
  scheduledAt: Joi.string().isoDate().optional(),
  priority: Joi.string().valid('low', 'normal', 'high', 'critical').default('normal')
});

export function createEmailRoutes(db: Pool): Router {
  const router = Router();
  const emailController = new EmailController();
  const webhookHandler = new WebhookHandler();

  // Initialize middleware
  const authMiddleware = new AuthMiddleware();

  // =============================================================================
  // EMAIL SENDING API ENDPOINTS
  // =============================================================================

  // Send single email with quota enforcement
  router.post('/send/single',
    authMiddleware.authenticateAny,
    validateRequest(singleEmailSchema),
    emailController.sendSingleEmail.bind(emailController)
  );

  // Send bulk emails with quota enforcement
  router.post('/send/bulk',
    authMiddleware.authenticateAny,
    validateRequest(bulkEmailSchema),
    emailController.sendBatchEmails.bind(emailController)
  );

  // Send campaign emails with quota enforcement
  router.post('/send/campaign',
    authMiddleware.authenticateAny,
    validateRequest(campaignEmailSchema),
    emailController.sendCampaignEmails.bind(emailController)
  );

  // =============================================================================
  // EMAIL JOB MANAGEMENT ENDPOINTS
  // =============================================================================

  // Get email job status
  router.get('/jobs/:jobId/status', 
    authMiddleware.authenticateAny,
    emailController.getJobStatus.bind(emailController)
  );

  // Cancel email job
  router.delete('/jobs/:jobId',
    authMiddleware.authenticateAny,
    emailController.cancelJob.bind(emailController)
  );

  // Retry failed email job
  router.post('/jobs/:jobId/retry',
    authMiddleware.authenticateAny,
    emailController.retryJob.bind(emailController)
  );

  // Get user's email jobs
  router.get('/jobs',
    authMiddleware.authenticateAny,
    emailController.getUserJobs.bind(emailController)
  );

  // =============================================================================
  // QUEUE AND PROVIDER MANAGEMENT
  // =============================================================================

  // Get queue statistics
  router.get('/queue/stats', 
    authMiddleware.authenticateAny,
    emailController.getQueueStats.bind(emailController)
  );

  // Get provider status
  router.get('/providers/status', 
    authMiddleware.authenticateAny,
    emailController.getProviderStatus.bind(emailController)
  );

  // =============================================================================
  // WEBHOOK ENDPOINTS (Public - No Authentication)
  // =============================================================================

  // Amazon SES webhook with HMAC verification
  router.post('/webhooks/ses', 
    webhookHandler.handleSESWebhook.bind(webhookHandler)
  );

  // SendGrid webhook with HMAC verification
  router.post('/webhooks/sendgrid', 
    webhookHandler.handleSendGridWebhook.bind(webhookHandler)
  );

  // Generic webhook endpoint for other providers
  router.post('/webhooks/:provider',
    webhookHandler.handleGenericWebhook.bind(webhookHandler)
  );

  // =============================================================================
  // ADMIN ROUTES (Require Admin Authentication)
  // =============================================================================

  router.use('/admin', authMiddleware.authenticateAny);

  // Queue management
  router.post('/admin/queue/pause', emailController.pauseQueue.bind(emailController));
  router.post('/admin/queue/resume', emailController.resumeQueue.bind(emailController));
  router.post('/admin/queue/clean', emailController.cleanQueue.bind(emailController));
  router.get('/admin/queue/jobs', emailController.getAllJobs.bind(emailController));

  // Provider management
  router.post('/admin/providers/switch', emailController.switchProvider.bind(emailController));
  router.get('/admin/providers/health', emailController.getProviderHealth.bind(emailController));

  // System monitoring
  router.get('/admin/metrics', emailController.getSystemMetrics.bind(emailController));
  router.get('/admin/health', emailController.getSystemHealth.bind(emailController));

  // =============================================================================
  // DELIVERABILITY MONITORING
  // =============================================================================

  router.use('/deliverability', createDeliverabilityRoutes(db));

  return router;
}

export default createEmailRoutes;