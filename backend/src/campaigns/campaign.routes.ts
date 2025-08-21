import { Router } from 'express';
import { CampaignController } from './campaign.controller';
import { authMiddleware } from '../auth/auth.middleware';
import { validateRequest } from '../shared/validation.middleware';
import Joi from 'joi';

const router = Router();
const campaignController = new CampaignController();

// Validation schemas
const createTemplateSchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  subject: Joi.string().required().min(1).max(998), // RFC 5322 limit
  htmlContent: Joi.string().required().min(1),
  textContent: Joi.string().optional(),
  variables: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      type: Joi.string().valid('text', 'number', 'date', 'boolean').default('text'),
      defaultValue: Joi.string().optional(),
      required: Joi.boolean().default(false)
    })
  ).optional(),
  isAIGenerated: Joi.boolean().default(false)
});

const updateTemplateSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  subject: Joi.string().min(1).max(998).optional(),
  htmlContent: Joi.string().min(1).optional(),
  textContent: Joi.string().optional(),
  variables: Joi.array().items(
    Joi.object({
      name: Joi.string().required(),
      type: Joi.string().valid('text', 'number', 'date', 'boolean').default('text'),
      defaultValue: Joi.string().optional(),
      required: Joi.boolean().default(false)
    })
  ).optional()
});

const createCampaignSchema = Joi.object({
  name: Joi.string().required().min(1).max(255),
  templateId: Joi.string().required(),
  listIds: Joi.array().items(Joi.string()).required().min(1),
  scheduledAt: Joi.date().greater('now').optional(),
  priority: Joi.string().valid('low', 'normal', 'high', 'critical').default('normal')
});

const sendCampaignSchema = Joi.object({
  contacts: Joi.array().items(
    Joi.object({
      email: Joi.string().email().required(),
      firstName: Joi.string().optional(),
      lastName: Joi.string().optional(),
      customFields: Joi.object().optional()
    })
  ).required().min(1).max(10000), // Limit batch size
  variables: Joi.object().optional()
});

const scheduleCampaignSchema = Joi.object({
  scheduledAt: Joi.date().greater('now').required()
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid('draft', 'scheduled', 'sending', 'sent', 'paused', 'failed').required()
});

// Template routes
router.post('/templates', 
  authMiddleware, 
  validateRequest(createTemplateSchema), 
  campaignController.createTemplate
);

router.get('/templates', 
  authMiddleware, 
  campaignController.listTemplates
);

router.get('/templates/:templateId', 
  authMiddleware, 
  campaignController.getTemplate
);

router.put('/templates/:templateId', 
  authMiddleware, 
  validateRequest(updateTemplateSchema), 
  campaignController.updateTemplate
);

// Campaign routes
router.post('/campaigns', 
  authMiddleware, 
  validateRequest(createCampaignSchema), 
  campaignController.createCampaign
);

router.get('/campaigns', 
  authMiddleware, 
  campaignController.listCampaigns
);

router.get('/campaigns/:campaignId', 
  authMiddleware, 
  campaignController.getCampaign
);

router.post('/campaigns/:campaignId/send', 
  authMiddleware, 
  validateRequest(sendCampaignSchema), 
  campaignController.sendCampaign
);

router.post('/campaigns/:campaignId/schedule', 
  authMiddleware, 
  validateRequest(scheduleCampaignSchema), 
  campaignController.scheduleCampaign
);

router.patch('/campaigns/:campaignId/status', 
  authMiddleware, 
  validateRequest(updateStatusSchema), 
  campaignController.updateCampaignStatus
);

// Campaign Analytics and Monitoring
router.get('/campaigns/:campaignId/metrics', 
  authMiddleware, 
  campaignController.getCampaignMetrics
);

router.get('/campaigns/:campaignId/events',
  authMiddleware,
  campaignController.getCampaignEvents
);

router.get('/campaigns/:campaignId/recipients',
  authMiddleware,
  campaignController.getCampaignRecipients
);

// Campaign Actions
router.post('/campaigns/:campaignId/pause',
  authMiddleware,
  campaignController.pauseCampaign
);

router.post('/campaigns/:campaignId/resume',
  authMiddleware,
  campaignController.resumeCampaign
);

router.post('/campaigns/:campaignId/cancel',
  authMiddleware,
  campaignController.cancelCampaign
);

router.post('/campaigns/:campaignId/duplicate',
  authMiddleware,
  campaignController.duplicateCampaign
);

// Bulk Campaign Operations
router.post('/campaigns/bulk/send',
  authMiddleware,
  validateRequest(Joi.object({
    campaignIds: Joi.array().items(Joi.string()).min(1).max(10).required()
  })),
  campaignController.sendMultipleCampaigns
);

router.post('/campaigns/bulk/schedule',
  authMiddleware,
  validateRequest(Joi.object({
    campaignIds: Joi.array().items(Joi.string()).min(1).max(10).required(),
    scheduledAt: Joi.date().greater('now').required()
  })),
  campaignController.scheduleMultipleCampaigns
);

// Queue and Job Management
router.get('/queue/stats', 
  authMiddleware, 
  campaignController.getQueueStats
);

router.get('/jobs/:jobId/status', 
  authMiddleware, 
  campaignController.getJobStatus
);

router.delete('/jobs/:jobId', 
  authMiddleware, 
  campaignController.cancelJob
);

router.post('/jobs/:jobId/retry', 
  authMiddleware, 
  campaignController.retryJob
);

// Template Management API
router.delete('/templates/:templateId',
  authMiddleware,
  campaignController.deleteTemplate
);

router.post('/templates/:templateId/duplicate',
  authMiddleware,
  campaignController.duplicateTemplate
);

router.get('/templates/:templateId/preview',
  authMiddleware,
  validateRequest(Joi.object({
    variables: Joi.object().optional()
  })),
  campaignController.previewTemplate
);

// Campaign Statistics and Reporting
router.get('/stats/overview',
  authMiddleware,
  campaignController.getCampaignOverview
);

router.get('/stats/performance',
  authMiddleware,
  campaignController.getPerformanceStats
);

export { router as campaignRoutes };