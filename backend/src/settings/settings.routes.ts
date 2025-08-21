import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { AuthMiddleware, AuthenticatedRequest } from '../auth/auth.middleware';
import { SettingsService } from './settings.service';

const router = Router();
const authMiddleware = new AuthMiddleware();
const settingsService = new SettingsService();

// Validation schemas
const updateSettingsSchema = Joi.object({
  emailNotifications: Joi.boolean().optional(),
  webhookUrl: Joi.string().uri().allow('').optional(),
  timezone: Joi.string().optional(),
  language: Joi.string().optional()
});

// Get user settings
router.get('/', 
  authMiddleware.authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const settings = await settingsService.getUserSettings(user.id);

      res.json({
        success: true,
        data: settings
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: {
          code: 'SETTINGS_FETCH_FAILED',
          message: error.message
        }
      });
    }
  }
);

// Update user settings
router.put('/', 
  authMiddleware.authenticate,
  authMiddleware.validateRequest(updateSettingsSchema),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = req.user!;
      const updates = req.body;

      await settingsService.updateUserSettings(user.id, updates);

      res.json({
        success: true,
        message: 'Settings updated successfully'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: {
          code: 'SETTINGS_UPDATE_FAILED',
          message: error.message
        }
      });
    }
  }
);

export default router;