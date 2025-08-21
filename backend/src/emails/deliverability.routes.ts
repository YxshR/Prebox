import { Router } from 'express';
import { Pool } from 'pg';
import { DeliverabilityController } from './deliverability.controller';
import { AuthMiddleware } from '../auth/auth.middleware';

export function createDeliverabilityRoutes(db: Pool): Router {
  const router = Router();
  const deliverabilityController = new DeliverabilityController(db);

  // Apply authentication middleware to all routes
  const authMiddleware = new AuthMiddleware();
  router.use(authMiddleware.authenticate);

  /**
   * @route GET /api/deliverability/metrics/:tenantId
   * @desc Get deliverability metrics for a tenant
   * @access Private
   * @param {string} tenantId - Tenant ID
   * @query {number} days - Number of days to analyze (default: 7)
   */
  router.get('/metrics/:tenantId', (req, res) => {
    deliverabilityController.getDeliverabilityMetrics(req, res);
  });

  /**
   * @route GET /api/deliverability/authentication/:domain
   * @desc Validate email authentication for a domain
   * @access Private
   * @param {string} domain - Domain to validate
   */
  router.get('/authentication/:domain', (req, res) => {
    deliverabilityController.validateAuthentication(req, res);
  });

  /**
   * @route POST /api/deliverability/spam-analysis
   * @desc Analyze spam score for email content
   * @access Private
   * @body {object} emailContent - Email content to analyze
   */
  router.post('/spam-analysis', (req, res) => {
    deliverabilityController.analyzeSpamScore(req, res);
  });

  /**
   * @route GET /api/deliverability/reputation/:tenantId
   * @desc Monitor sender reputation for a tenant
   * @access Private
   * @param {string} tenantId - Tenant ID
   */
  router.get('/reputation/:tenantId', (req, res) => {
    deliverabilityController.monitorReputation(req, res);
  });

  /**
   * @route GET /api/deliverability/optimization/:tenantId
   * @desc Get delivery rate optimization recommendations
   * @access Private
   * @param {string} tenantId - Tenant ID
   */
  router.get('/optimization/:tenantId', (req, res) => {
    deliverabilityController.getOptimizationRecommendations(req, res);
  });

  /**
   * @route GET /api/deliverability/alerts/:tenantId
   * @desc Get deliverability alerts for a tenant
   * @access Private
   * @param {string} tenantId - Tenant ID
   * @query {number} limit - Number of alerts to return (default: 50)
   * @query {number} offset - Offset for pagination (default: 0)
   * @query {string} severity - Filter by severity (low, medium, high, critical)
   * @query {boolean} resolved - Filter by resolution status
   */
  router.get('/alerts/:tenantId', (req, res) => {
    deliverabilityController.getDeliverabilityAlerts(req, res);
  });

  /**
   * @route PUT /api/deliverability/alerts/:alertId/resolve
   * @desc Resolve a deliverability alert
   * @access Private
   * @param {string} alertId - Alert ID
   * @body {string} tenantId - Tenant ID
   */
  router.put('/alerts/:alertId/resolve', (req, res) => {
    deliverabilityController.resolveAlert(req, res);
  });

  /**
   * @route GET /api/deliverability/dashboard/:tenantId
   * @desc Get deliverability dashboard summary
   * @access Private
   * @param {string} tenantId - Tenant ID
   * @query {number} days - Number of days to analyze (default: 7)
   */
  router.get('/dashboard/:tenantId', (req, res) => {
    deliverabilityController.getDashboardSummary(req, res);
  });

  /**
   * @route POST /api/deliverability/monitoring/start
   * @desc Start automated deliverability monitoring
   * @access Private (Admin only)
   * @body {number} intervalMinutes - Monitoring interval in minutes (default: 30)
   */
  router.post('/monitoring/start', (req, res) => {
    // TODO: Add admin role check middleware
    deliverabilityController.startMonitoring(req, res);
  });

  /**
   * @route POST /api/deliverability/monitoring/stop
   * @desc Stop automated deliverability monitoring
   * @access Private (Admin only)
   */
  router.post('/monitoring/stop', (req, res) => {
    // TODO: Add admin role check middleware
    deliverabilityController.stopMonitoring(req, res);
  });

  /**
   * @route POST /api/deliverability/check/:tenantId
   * @desc Run manual deliverability check for a tenant
   * @access Private
   * @param {string} tenantId - Tenant ID
   */
  router.post('/check/:tenantId', (req, res) => {
    deliverabilityController.runManualCheck(req, res);
  });

  return router;
}

export default createDeliverabilityRoutes;