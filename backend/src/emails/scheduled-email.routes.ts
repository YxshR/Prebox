import { Router } from 'express';
import { ScheduledEmailController } from './scheduled-email.controller';
import { AuthMiddleware } from '../auth/auth.middleware';
import { validateRequest } from '../shared/validation.middleware';
import Joi from 'joi';

const router = Router();
const scheduledEmailController = new ScheduledEmailController();
const authMiddleware = new AuthMiddleware();

// Validation schemas for scheduled email requests
const scheduleEmailSchema = Joi.object({
  tenantId: Joi.string().required(),
  campaignId: Joi.string().optional(),
  emailJob: Joi.object({
    to: Joi.array().items(Joi.string().email()).min(1).max(1000).required(),
    from: Joi.string().email().required(),
    subject: Joi.string().min(1).max(998).required(),
    htmlContent: Joi.string().min(1).required(),
    textContent: Joi.string().optional(),
    replyTo: Joi.string().email().optional(),
    headers: Joi.object().optional(),
    metadata: Joi.object().optional()
  }).required(),
  scheduledAt: Joi.date().iso().required(),
  userType: Joi.string().valid('subscription', 'recharge').required()
});

const validateSchedulingSchema = Joi.object({
  tenantId: Joi.string().required(),
  scheduledAt: Joi.date().iso().required(),
  userType: Joi.string().valid('subscription', 'recharge').required(),
  recipientCount: Joi.number().min(1).max(10000).required()
});

const triggerScheduledEmailsSchema = Joi.object({
  scheduleIds: Joi.array().items(Joi.string()).max(100).optional()
});

// Routes

/**
 * Schedule an email for future delivery
 * POST /api/emails/schedule
 * Requirements: 17.1 - Allow scheduling with proper validation
 */
router.post(
  '/schedule',
  authMiddleware.authenticate,
  validateRequest(scheduleEmailSchema),
  scheduledEmailController.scheduleEmail.bind(scheduledEmailController)
);

/**
 * Cancel a scheduled email
 * DELETE /api/emails/schedule/:scheduleId
 */
router.delete(
  '/schedule/:scheduleId',
  authMiddleware.authenticate,
  scheduledEmailController.cancelScheduledEmail.bind(scheduledEmailController)
);

/**
 * Get scheduled emails for a tenant
 * GET /api/emails/schedule
 */
router.get(
  '/schedule',
  authMiddleware.authenticate,
  scheduledEmailController.getScheduledEmails.bind(scheduledEmailController)
);

/**
 * Get scheduled email statistics
 * GET /api/emails/schedule/stats
 */
router.get(
  '/schedule/stats',
  authMiddleware.authenticate,
  scheduledEmailController.getScheduledEmailStats.bind(scheduledEmailController)
);

/**
 * Validate scheduling request
 * POST /api/emails/schedule/validate
 * Requirements: 17.3, 17.4 - Validate subscription and balance before scheduling
 */
router.post(
  '/schedule/validate',
  authMiddleware.authenticate,
  validateRequest(validateSchedulingSchema),
  scheduledEmailController.validateScheduling.bind(scheduledEmailController)
);

/**
 * Manual trigger for scheduled emails (admin/system use)
 * POST /api/emails/schedule/trigger
 * Requirements: 17.5 - Manual execution function
 */
router.post(
  '/schedule/trigger',
  authMiddleware.authenticate, // Could add admin-only middleware here
  validateRequest(triggerScheduledEmailsSchema),
  scheduledEmailController.triggerScheduledEmails.bind(scheduledEmailController)
);

/**
 * Process scheduled emails (system endpoint for cron jobs)
 * POST /api/emails/schedule/process
 * Requirements: 17.2 - Automatic email sending without user intervention
 */
router.post(
  '/schedule/process',
  // Note: This endpoint should be secured for system use only
  // Consider adding API key authentication or IP whitelist
  scheduledEmailController.processScheduledEmails.bind(scheduledEmailController)
);

export default router;