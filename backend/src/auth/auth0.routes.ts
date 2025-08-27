import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { Auth0Service } from './auth0.service';
import { AuthMiddleware } from './auth.middleware';

const router = Router();
const auth0Service = new Auth0Service();
const authMiddleware = new AuthMiddleware();

// Validation schemas
const completeSignupSchema = Joi.object({
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required()
});

const verifyPhoneSchema = Joi.object({
  otpId: Joi.string().uuid().required(),
  code: Joi.string().length(6).required()
});

/**
 * GET /api/auth/auth0/login
 * Get Auth0 authorization URL for login
 */
router.get('/login', (req: Request, res: Response) => {
  try {
    const state = req.query.state as string;
    const authUrl = auth0Service.getAuthorizationUrl(state);

    res.json({
      success: true,
      data: { authUrl }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH0_URL_GENERATION_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * GET /api/auth/auth0/signup
 * Get Auth0 authorization URL for signup
 */
router.get('/signup', (req: Request, res: Response) => {
  try {
    const state = 'signup'; // Indicate this is a signup flow
    const authUrl = auth0Service.getAuthorizationUrl(state);

    res.json({
      success: true,
      data: { authUrl }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH0_URL_GENERATION_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * GET /api/auth/auth0/callback
 * Handle Auth0 callback after authentication
 */
router.get('/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Handle Auth0 errors
    if (error) {
      const frontendUrl = process.env.AUTH0_ERROR_REDIRECT || 'http://localhost:3000/auth/error';
      return res.redirect(`${frontendUrl}?error=${encodeURIComponent(error as string)}&description=${encodeURIComponent(error_description as string || '')}`);
    }

    if (!code) {
      const frontendUrl = process.env.AUTH0_ERROR_REDIRECT || 'http://localhost:3000/auth/error';
      return res.redirect(`${frontendUrl}?error=missing_code`);
    }

    // Exchange code for user profile
    const auth0Profile = await auth0Service.exchangeCodeForTokens(code as string);

    // Handle the callback and create/login user
    const result = await auth0Service.handleAuth0Callback(auth0Profile);

    if (result.isNewUser && result.requiresPhoneVerification) {
      // New user needs phone verification - redirect to phone verification page
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/auth/phone-verification?userId=${result.user.id}&newUser=true`);
    } else {
      // Existing user or user doesn't need phone verification - redirect with tokens
      // Generate auth tokens for the user
      const authToken = await auth0Service.authService.login({
        email: result.user.email,
        password: '' // Auth0 users don't have passwords
      });

      const frontendUrl = process.env.AUTH0_SUCCESS_REDIRECT || 'http://localhost:3000/auth/success';
      return res.redirect(`${frontendUrl}?token=${authToken.accessToken}&refresh=${authToken.refreshToken}`);
    }

  } catch (error: any) {
    console.error('Auth0 callback error:', error);
    const frontendUrl = process.env.AUTH0_ERROR_REDIRECT || 'http://localhost:3000/auth/error';
    res.redirect(`${frontendUrl}?error=callback_failed&message=${encodeURIComponent(error.message)}`);
  }
});

/**
 * POST /api/auth/auth0/complete-signup
 * Complete Auth0 signup by adding phone number
 */
router.post('/complete-signup', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const { error, value } = completeSignupSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }

    const { phone } = value;
    const userId = (req as any).user.id;

    const result = await auth0Service.completeAuth0Signup(userId, phone);

    res.json({
      success: true,
      data: result,
      message: 'OTP sent to your phone number. Please verify to complete signup.'
    });

  } catch (error: any) {
    let statusCode = 400;
    let errorCode = 'SIGNUP_COMPLETION_FAILED';

    if (error.message.includes('already registered')) {
      statusCode = 409;
      errorCode = 'PHONE_ALREADY_EXISTS';
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: error.message
      }
    });
  }
});

/**
 * POST /api/auth/auth0/verify-phone
 * Verify phone number for Auth0 user
 */
router.post('/verify-phone', async (req: Request, res: Response) => {
  try {
    const { error, value } = verifyPhoneSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }

    const { otpId, code } = value;

    const authResult = await auth0Service.verifyAuth0Phone(otpId, code);

    res.json({
      success: true,
      data: authResult,
      message: 'Phone verified successfully. Signup complete!'
    });

  } catch (error: any) {
    let statusCode = 400;
    let errorCode = 'PHONE_VERIFICATION_FAILED';

    if (error.message.includes('expired')) {
      statusCode = 404;
      errorCode = 'OTP_EXPIRED';
    } else if (error.message.includes('attempts')) {
      statusCode = 429;
      errorCode = 'TOO_MANY_ATTEMPTS';
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: error.message
      }
    });
  }
});

/**
 * GET /api/auth/auth0/profile
 * Get Auth0 profile for authenticated user
 */
router.get('/profile', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await auth0Service.getAuth0Profile(userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'Auth0 profile not found for this user'
        }
      });
    }

    res.json({
      success: true,
      data: { profile }
    });

  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'PROFILE_FETCH_FAILED',
        message: error.message
      }
    });
  }
});

export default router;