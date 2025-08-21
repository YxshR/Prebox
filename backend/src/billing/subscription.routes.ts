import { Router } from 'express';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';
import { QuotaMiddleware, createQuotaMiddleware } from './quota.middleware';

// Initialize services
const subscriptionService = new SubscriptionService();
const subscriptionController = new SubscriptionController(subscriptionService);
const quotaMiddleware = createQuotaMiddleware(subscriptionService);

const router = Router();

/**
 * @route GET /api/subscriptions/plans
 * @desc Get all available subscription plans
 * @access Public
 */
router.get('/plans', (req, res) => subscriptionController.getPlans(req, res));

/**
 * @route GET /api/subscriptions/current
 * @desc Get current user's subscription details
 * @access Private
 */
router.get('/current', (req, res) => subscriptionController.getCurrentSubscription(req as any, res));

/**
 * @route GET /api/subscriptions/usage
 * @desc Get current usage statistics
 * @access Private
 */
router.get('/usage', (req, res) => subscriptionController.getUsageStats(req as any, res));

/**
 * @route POST /api/subscriptions/change-tier
 * @desc Upgrade or downgrade subscription tier
 * @access Private
 */
router.post('/change-tier', (req, res) => subscriptionController.changeTier(req as any, res));

/**
 * @route POST /api/subscriptions/recharge
 * @desc Add recharge balance to subscription
 * @access Private
 */
router.post('/recharge', (req, res) => subscriptionController.addRecharge(req as any, res));

/**
 * @route GET /api/subscriptions/check-quota
 * @desc Check quota for specific action
 * @access Private
 */
router.get('/check-quota', (req, res) => subscriptionController.checkQuota(req as any, res));

// Export router and services for use in other modules
export { router as subscriptionRoutes, subscriptionService, quotaMiddleware };
export default router;