import { Router } from 'express';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { AuthMiddleware } from '../auth/auth.middleware';
import pool from '../config/database';

const router = Router();

// Initialize middleware, service and controller
const authMiddleware = new AuthMiddleware();
const analyticsService = new AnalyticsService(pool);
const analyticsController = new AnalyticsController(analyticsService);

/**
 * Get analytics dashboard data
 * GET /api/analytics/dashboard
 */
router.get(
  '/dashboard',
  authMiddleware.authenticate,
  analyticsController.getDashboardAnalytics.bind(analyticsController)
);

/**
 * Get delivery trends data
 * GET /api/analytics/delivery-trends
 */
router.get(
  '/delivery-trends',
  authMiddleware.authenticate,
  analyticsController.getDeliveryTrends.bind(analyticsController)
);

/**
 * Get engagement metrics
 * GET /api/analytics/engagement
 */
router.get(
  '/engagement',
  authMiddleware.authenticate,
  analyticsController.getEngagementMetrics.bind(analyticsController)
);

/**
 * Get campaign performance data
 * GET /api/analytics/campaigns
 */
router.get(
  '/campaigns',
  authMiddleware.authenticate,
  analyticsController.getCampaignPerformance.bind(analyticsController)
);

/**
 * Get key metrics summary
 * GET /api/analytics/key-metrics
 */
router.get(
  '/key-metrics',
  authMiddleware.authenticate,
  analyticsController.getKeyMetrics.bind(analyticsController)
);

export default router;