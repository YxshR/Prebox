import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { AuthService } from './auth.service';
import { Auth0Service } from './auth0.service';
import { PhoneVerificationService } from './phone-verification.service';
import { SessionManagementService } from './services/session-management.service';
import { AuthMiddleware } from './auth.middleware';
import { LoginCredentials, User } from '../shared/types';
import { logger } from '../shared/logger';
import pool from '../config/database';

const router = Router();
const authService = new AuthService();
const auth0Service = new Auth0Service();
const phoneVerificationService = new PhoneVerificationService();
const sessionManagementService = new SessionManagementService();
const authMiddleware = new AuthMiddleware();

// Validation schemas
const emailPasswordLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const phoneLoginSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+?[\d\s\-\(\)]{10,}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be at least 10 digits and can contain +, spaces, dashes, and parentheses'
    })
});

const phoneOtpVerifySchema = Joi.object({
  otpId: Joi.string().uuid().required(),
  code: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.length': 'OTP must be exactly 6 digits',
      'string.pattern.base': 'OTP must contain only numbers'
    })
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

/**
 * POST /api/auth/login/email
 * Login with email and password
 */
router.post('/email', async (req: Request, res: Response) => {
  try {
    const { error, value } = emailPasswordLoginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
          field: error.details[0].path[0]
        }
      });
    }

    const credentials: LoginCredentials = value;
    const ipAddress = getClientIp(req);
    const userAgent = req.get('User-Agent');

    // Validate credentials
    const user = await validateEmailPasswordCredentials(credentials);

    // Create session
    const authToken = await sessionManagementService.createSession({
      user,
      ipAddress,
      userAgent
    });

    logger.info('Email/password login successful', {
      userId: user.id,
      email: user.email,
      ipAddress
    });

    res.json({
      success: true,
      data: {
        ...authToken,
        loginMethod: 'email_password'
      }
    });

  } catch (error: any) {
    logger.error('Email/password login failed', {
      error: error.message,
      email: req.body.email,
      ipAddress: getClientIp(req)
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * POST /api/auth/login/phone
 * Start phone number login (sends OTP)
 */
router.post('/phone', async (req: Request, res: Response) => {
  try {
    const { error, value } = phoneLoginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
          field: error.details[0].path[0]
        }
      });
    }

    const { phone } = value;
    const ipAddress = getClientIp(req);

    // Check if user exists with this phone number
    const userResult = await pool.query(
      'SELECT * FROM users WHERE phone = $1 AND is_phone_verified = true',
      [phone]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PHONE_NOT_FOUND',
          message: 'No verified account found with this phone number'
        }
      });
    }

    const user = mapRowToUser(userResult.rows[0]);

    // Send OTP for login
    const otpId = await phoneVerificationService.sendOTP(user.id, phone, 'login');

    logger.info('Phone login OTP sent', {
      userId: user.id,
      phone,
      otpId,
      ipAddress
    });

    res.json({
      success: true,
      data: {
        otpId,
        message: 'OTP sent to your phone number'
      }
    });

  } catch (error: any) {
    logger.error('Phone login initiation failed', {
      error: error.message,
      phone: req.body.phone,
      ipAddress: getClientIp(req)
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'PHONE_LOGIN_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * POST /api/auth/login/phone/verify
 * Verify phone OTP and complete login
 */
router.post('/phone/verify', async (req: Request, res: Response) => {
  try {
    const { error, value } = phoneOtpVerifySchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message,
          field: error.details[0].path[0]
        }
      });
    }

    const { otpId, code } = value;
    const ipAddress = getClientIp(req);
    const userAgent = req.get('User-Agent');

    // Verify OTP and get user data
    const otpResult = await pool.query(`
      SELECT ov.*, u.* FROM otp_verifications ov
      JOIN users u ON ov.user_id = u.id
      WHERE ov.id = $1 AND ov.code = $2 AND ov.type = 'login' 
      AND ov.is_used = false AND ov.expires_at > NOW()
    `, [otpId, code]);

    if (otpResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OTP',
          message: 'Invalid or expired OTP'
        }
      });
    }

    const row = otpResult.rows[0];
    const user = mapRowToUser(row);

    // Mark OTP as used
    await pool.query('UPDATE otp_verifications SET is_used = true WHERE id = $1', [otpId]);

    // Create session
    const authToken = await sessionManagementService.createSession({
      user,
      ipAddress,
      userAgent
    });

    logger.info('Phone OTP login successful', {
      userId: user.id,
      phone: user.phone,
      ipAddress
    });

    res.json({
      success: true,
      data: {
        ...authToken,
        loginMethod: 'phone_otp'
      }
    });

  } catch (error: any) {
    logger.error('Phone OTP verification failed', {
      error: error.message,
      otpId: req.body.otpId,
      ipAddress: getClientIp(req)
    });

    let statusCode = 400;
    let errorCode = 'OTP_VERIFICATION_FAILED';

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
 * GET /api/auth/login/auth0
 * Get Auth0 login URL
 */
router.get('/auth0', (req: Request, res: Response) => {
  try {
    const state = req.query.state as string || 'login';
    const authUrl = auth0Service.getAuthorizationUrl(state);
    
    res.json({
      success: true,
      data: { 
        authUrl,
        loginMethod: 'auth0'
      }
    });
  } catch (error: any) {
    logger.error('Auth0 login URL generation failed', { error: error.message });
    
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
 * GET /api/auth/login/auth0/callback
 * Handle Auth0 login callback
 */
router.get('/auth0/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;
    const ipAddress = getClientIp(req);
    const userAgent = req.get('User-Agent');

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
    
    // Check if user exists
    const userResult = await pool.query(
      'SELECT * FROM users WHERE auth0_id = $1 OR email = $2',
      [auth0Profile.sub, auth0Profile.email]
    );

    if (userResult.rows.length === 0) {
      // User doesn't exist - redirect to signup
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/auth/signup?method=auth0&email=${encodeURIComponent(auth0Profile.email)}`);
    }

    const user = mapRowToUser(userResult.rows[0]);

    // Create session
    const authToken = await sessionManagementService.createSession({
      user,
      ipAddress,
      userAgent
    });

    logger.info('Auth0 login successful', {
      userId: user.id,
      email: user.email,
      auth0Id: user.auth0Id,
      ipAddress
    });

    // Redirect to frontend with tokens
    const frontendUrl = process.env.AUTH0_SUCCESS_REDIRECT || 'http://localhost:3000/auth/success';
    res.redirect(`${frontendUrl}?token=${authToken.accessToken}&refresh=${authToken.refreshToken}&method=auth0`);

  } catch (error: any) {
    logger.error('Auth0 login callback failed', { error: error.message });
    
    const frontendUrl = process.env.AUTH0_ERROR_REDIRECT || 'http://localhost:3000/auth/error';
    res.redirect(`${frontendUrl}?error=callback_failed&message=${encodeURIComponent(error.message)}`);
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { error, value } = refreshTokenSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }

    const { refreshToken } = value;
    const ipAddress = getClientIp(req);

    const authToken = await sessionManagementService.refreshSession(refreshToken, ipAddress);

    res.json({
      success: true,
      data: authToken
    });

  } catch (error: any) {
    logger.error('Token refresh failed', {
      error: error.message,
      ipAddress: getClientIp(req)
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'REFRESH_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout and invalidate session
 */
router.post('/logout', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const sessionId = req.headers['x-session-id'] as string;

    await sessionManagementService.invalidateSession(user.id, sessionId);

    logger.info('User logged out', {
      userId: user.id,
      sessionId,
      ipAddress: getClientIp(req)
    });

    res.json({
      success: true,
      data: {
        message: 'Logged out successfully'
      }
    });

  } catch (error: any) {
    logger.error('Logout failed', {
      error: error.message,
      userId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'LOGOUT_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * POST /api/auth/logout-all
 * Logout from all sessions
 */
router.post('/logout-all', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    await sessionManagementService.invalidateSession(user.id);

    logger.info('User logged out from all sessions', {
      userId: user.id,
      ipAddress: getClientIp(req)
    });

    res.json({
      success: true,
      data: {
        message: 'Logged out from all sessions successfully'
      }
    });

  } catch (error: any) {
    logger.error('Logout all failed', {
      error: error.message,
      userId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'LOGOUT_ALL_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * GET /api/auth/sessions
 * Get active sessions for current user
 */
router.get('/sessions', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const sessions = await sessionManagementService.getUserSessions(user.id);

    // Remove sensitive data from response
    const safeSessions = sessions.map(session => ({
      id: session.id,
      createdAt: session.createdAt,
      lastAccessedAt: session.lastAccessedAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      isActive: session.isActive
    }));

    res.json({
      success: true,
      data: {
        sessions: safeSessions,
        total: safeSessions.length
      }
    });

  } catch (error: any) {
    logger.error('Failed to get user sessions', {
      error: error.message,
      userId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'SESSIONS_FETCH_FAILED',
        message: 'Failed to retrieve sessions'
      }
    });
  }
});

// Helper functions
function getClientIp(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         '127.0.0.1';
}

async function validateEmailPasswordCredentials(credentials: LoginCredentials): Promise<User> {
  const result = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [credentials.email]
  );

  if (result.rows.length === 0) {
    throw new Error('Invalid email or password');
  }

  const user = mapRowToUser(result.rows[0]);
  
  // Check if user has Auth0 ID (should use Auth0 login)
  if (user.auth0Id) {
    throw new Error('This account uses Auth0 authentication. Please login through Auth0.');
  }

  // Validate password
  if (!result.rows[0].password_hash) {
    throw new Error('Invalid email or password');
  }
  
  const bcrypt = require('bcryptjs');
  const isPasswordValid = await bcrypt.compare(credentials.password, result.rows[0].password_hash);
  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  return user;
}

function mapRowToUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    firstName: row.first_name,
    lastName: row.last_name,
    tenantId: row.tenant_id,
    role: row.role,
    subscriptionTier: row.subscription_tier,
    isEmailVerified: row.is_email_verified,
    isPhoneVerified: row.is_phone_verified,
    googleId: row.google_id,
    auth0Id: row.auth0_id,
    createdAt: new Date(row.created_at),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : new Date()
  };
}

export default router;