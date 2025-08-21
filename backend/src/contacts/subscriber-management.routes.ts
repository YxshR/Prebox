import { Router } from 'express';
import { SubscriberManagementService } from './subscriber-management.service';
import { authMiddleware } from '../auth/auth.middleware';
import { validationMiddleware } from '../shared/validation.middleware';
import { body, param, query } from 'express-validator';

const router = Router();
const subscriberService = new SubscriberManagementService();

/**
 * Public one-click unsubscribe endpoint (no auth required)
 * GET /api/unsubscribe/:token
 */
router.get('/unsubscribe/:token', 
  param('token').isString().notEmpty().withMessage('Valid token is required'),
  validationMiddleware,
  async (req, res) => {
    try {
      const { token } = req.params;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');
      
      const result = await subscriberService.handleOneClickUnsubscribe(token, ipAddress, userAgent);
      
      if (result.success) {
        // Return a simple HTML page for user feedback
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Unsubscribed Successfully</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .success { color: #28a745; }
              .container { max-width: 500px; margin: 0 auto; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1 class="success">✓ Unsubscribed Successfully</h1>
              <p>${result.message}</p>
              <p>You will no longer receive emails from us.</p>
            </div>
          </body>
          </html>
        `);
      } else {
        res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Unsubscribe Error</title>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #dc3545; }
              .container { max-width: 500px; margin: 0 auto; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1 class="error">⚠ Unsubscribe Error</h1>
              <p>${result.message}</p>
            </div>
          </body>
          </html>
        `);
      }
    } catch (error) {
      console.error('Unsubscribe error:', error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Unsubscribe Error</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #dc3545; }
            .container { max-width: 500px; margin: 0 auto; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error">⚠ System Error</h1>
            <p>An error occurred while processing your unsubscribe request. Please try again later.</p>
          </div>
        </body>
        </html>
      `);
    }
  }
);

/**
 * Manual unsubscribe endpoint (authenticated)
 * POST /api/contacts/unsubscribe
 */
router.post('/unsubscribe',
  authMiddleware,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('reason').optional().isString(),
    body('campaignId').optional().isUUID()
  ],
  validationMiddleware,
  async (req, res) => {
    try {
      const { email, reason, campaignId } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');
      
      const result = await subscriberService.handleManualUnsubscribe({
        email,
        reason,
        campaignId,
        ipAddress,
        userAgent
      });
      
      res.json(result);
    } catch (error) {
      console.error('Manual unsubscribe error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process unsubscribe request',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Get subscriber preferences
 * GET /api/contacts/:contactId/preferences
 */
router.get('/:contactId/preferences',
  authMiddleware,
  param('contactId').isUUID().withMessage('Valid contact ID is required'),
  validationMiddleware,
  async (req, res) => {
    try {
      const { contactId } = req.params;
      const tenantId = req.user.tenantId;
      
      const preferences = await subscriberService.getSubscriberPreferences(tenantId, contactId);
      
      if (!preferences) {
        return res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
      }
      
      res.json({
        success: true,
        data: preferences
      });
    } catch (error) {
      console.error('Get preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve subscriber preferences',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Update subscriber preferences
 * PUT /api/contacts/:contactId/preferences
 */
router.put('/:contactId/preferences',
  authMiddleware,
  [
    param('contactId').isUUID().withMessage('Valid contact ID is required'),
    body('preferences').optional().isObject(),
    body('preferences.marketing').optional().isBoolean(),
    body('preferences.transactional').optional().isBoolean(),
    body('preferences.newsletters').optional().isBoolean(),
    body('preferences.promotions').optional().isBoolean(),
    body('frequency').optional().isIn(['daily', 'weekly', 'monthly', 'never']),
    body('categories').optional().isArray()
  ],
  validationMiddleware,
  async (req, res) => {
    try {
      const { contactId } = req.params;
      const tenantId = req.user.tenantId;
      const updates = req.body;
      
      const updatedPreferences = await subscriberService.updateSubscriberPreferences(
        tenantId, 
        contactId, 
        updates
      );
      
      res.json({
        success: true,
        data: updatedPreferences
      });
    } catch (error) {
      console.error('Update preferences error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update subscriber preferences',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Deduplicate contacts for tenant
 * POST /api/contacts/deduplicate
 */
router.post('/deduplicate',
  authMiddleware,
  async (req, res) => {
    try {
      const tenantId = req.user.tenantId;
      
      const result = await subscriberService.deduplicateContacts(tenantId);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Deduplication error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deduplicate contacts',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Get contact history and engagement events
 * GET /api/contacts/:contactId/history
 */
router.get('/:contactId/history',
  authMiddleware,
  [
    param('contactId').isUUID().withMessage('Valid contact ID is required'),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('offset').optional().isInt({ min: 0 }).toInt()
  ],
  validationMiddleware,
  async (req, res) => {
    try {
      const { contactId } = req.params;
      const tenantId = req.user.tenantId;
      const limit = req.query.limit as number || 50;
      const offset = req.query.offset as number || 0;
      
      const result = await subscriberService.getContactHistory(tenantId, contactId, limit, offset);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Get contact history error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve contact history',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Get contact engagement analytics
 * GET /api/contacts/:contactId/analytics
 */
router.get('/:contactId/analytics',
  authMiddleware,
  param('contactId').isUUID().withMessage('Valid contact ID is required'),
  validationMiddleware,
  async (req, res) => {
    try {
      const { contactId } = req.params;
      const tenantId = req.user.tenantId;
      
      const analytics = await subscriberService.getContactEngagementAnalytics(tenantId, contactId);
      
      if (!analytics) {
        return res.status(404).json({
          success: false,
          message: 'Contact not found'
        });
      }
      
      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Get contact analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve contact analytics',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

/**
 * Generate unsubscribe token for email
 * POST /api/contacts/generate-unsubscribe-token
 */
router.post('/generate-unsubscribe-token',
  authMiddleware,
  [
    body('email').isEmail().withMessage('Valid email is required'),
    body('campaignId').optional().isUUID()
  ],
  validationMiddleware,
  async (req, res) => {
    try {
      const { email, campaignId } = req.body;
      
      const token = subscriberService.generateUnsubscribeToken(email, campaignId);
      
      res.json({
        success: true,
        data: {
          token,
          unsubscribeUrl: `${req.protocol}://${req.get('host')}/api/contacts/unsubscribe/${token}`
        }
      });
    } catch (error) {
      console.error('Generate token error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate unsubscribe token',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

export default router;