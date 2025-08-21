import { Router } from 'express';
import { AITemplateController } from './ai-template.controller';
import { AITemplateService } from './ai-template.service';
import { SubscriptionService } from '../billing/subscription.service';
import { authMiddleware } from '../auth/auth.middleware';
import { quotaMiddleware } from '../billing/quota.middleware';

const router = Router();

// Initialize services
const subscriptionService = new SubscriptionService();
const aiTemplateService = new AITemplateService(subscriptionService);
const aiTemplateController = new AITemplateController(aiTemplateService);

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @route POST /api/ai-templates/generate
 * @desc Generate a new email template using AI
 * @access Private
 */
router.post('/generate', 
  quotaMiddleware('template_generation'),
  aiTemplateController.generateTemplate.bind(aiTemplateController)
);

/**
 * @route POST /api/ai-templates/customize
 * @desc Customize an existing AI-generated template
 * @access Private
 */
router.post('/customize',
  aiTemplateController.customizeTemplate.bind(aiTemplateController)
);

/**
 * @route GET /api/ai-templates/usage
 * @desc Get template usage statistics for the current tenant
 * @access Private
 */
router.get('/usage',
  aiTemplateController.getUsageStats.bind(aiTemplateController)
);

/**
 * @route GET /api/ai-templates/quota
 * @desc Check template generation quota for the current tenant
 * @access Private
 */
router.get('/quota',
  aiTemplateController.validateQuota.bind(aiTemplateController)
);

/**
 * @route GET /api/ai-templates/types
 * @desc Get available template types
 * @access Private
 */
router.get('/types',
  aiTemplateController.getTemplateTypes.bind(aiTemplateController)
);

/**
 * @route GET /api/ai-templates/suggestions
 * @desc Get template suggestions based on industry
 * @access Private
 * @query industry - Optional industry filter
 */
router.get('/suggestions',
  aiTemplateController.getTemplateSuggestions.bind(aiTemplateController)
);

/**
 * @route GET /api/ai-templates/connectivity/status
 * @desc Check AI service connectivity status
 * @access Private
 */
router.get('/connectivity/status',
  aiTemplateController.getConnectivityStatus.bind(aiTemplateController)
);

/**
 * @route POST /api/ai-templates/connectivity/check
 * @desc Force a fresh connectivity check
 * @access Private
 */
router.post('/connectivity/check',
  aiTemplateController.checkConnectivity.bind(aiTemplateController)
);

/**
 * @route GET /api/ai-templates/connectivity/validate-keys
 * @desc Validate AI service API keys
 * @access Private
 */
router.get('/connectivity/validate-keys',
  aiTemplateController.validateApiKeys.bind(aiTemplateController)
);

export { router as aiTemplateRoutes };