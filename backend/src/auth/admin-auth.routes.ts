import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { AdminAuthService } from './admin-auth.service';
import { AdminAuthMiddleware } from './admin-auth.middleware';
import { LoginCredentials } from '../shared/types';

const router = Router();
const adminAuthService = new AdminAuthService();
const adminAuthMiddleware = new AdminAuthMiddleware();

// Validation schemas
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Admin login endpoint
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }

    const credentials: LoginCredentials = value;
    const authToken = await adminAuthService.login(credentials);

    res.json({
      success: true,
      data: authToken
    });
  } catch (error: any) {
    console.error('Admin login error:', error.message);
    res.status(401).json({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: error.message
      }
    });
  }
});

// Admin refresh token endpoint
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'REFRESH_TOKEN_REQUIRED',
          message: 'Refresh token is required'
        }
      });
    }

    const authToken = await adminAuthService.refreshToken(refreshToken);

    res.json({
      success: true,
      data: authToken
    });
  } catch (error: any) {
    res.status(401).json({
      success: false,
      error: {
        code: 'REFRESH_FAILED',
        message: error.message
      }
    });
  }
});

// Admin logout endpoint
router.post('/logout', adminAuthMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    await adminAuthService.logout((req as any).user.id);
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGOUT_FAILED',
        message: error.message
      }
    });
  }
});

// Get current admin user endpoint
router.get('/me', adminAuthMiddleware.authenticate, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: { user: (req as any).user }
  });
});

export default router;