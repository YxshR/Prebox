import { Router, Request, Response } from 'express';
import passport from 'passport';
import Joi from 'joi';
import { AuthService } from './auth.service';
import { DemoAuthService } from '../demo/demo-auth.service';
import { PhoneVerificationService } from './phone-verification.service';
import { EmailVerificationService } from './email-verification.service';
import { GoogleOAuthService } from './google-oauth.service';
import { AuthMiddleware } from './auth.middleware';
import { UserRegistration, LoginCredentials } from '../shared/types';

const router = Router();
const isDemoMode = process.env.DEMO_MODE === 'true';
const authService = isDemoMode ? new DemoAuthService() : new AuthService();
const phoneVerificationService = new PhoneVerificationService();
const emailVerificationService = new EmailVerificationService();
const googleOAuthService = isDemoMode ? null : new GoogleOAuthService();
const authMiddleware = new AuthMiddleware();

// Validation schemas
const registrationSchema = Joi.object({
  email: Joi.string().email().optional(),
  password: Joi.string().min(8).optional(),
  phone: Joi.string().when('registrationMethod', {
    is: 'phone_google',
    then: Joi.required(),
    otherwise: Joi.optional()
  }),
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  registrationMethod: Joi.string().valid('email', 'phone_google').required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const otpSchema = Joi.object({
  otpId: Joi.string().uuid().required(),
  code: Joi.string().length(6).required()
});

// Register endpoint
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { error, value } = registrationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }

    const userData: UserRegistration = value;
    
    // Handle phone-only registration
    if (userData.registrationMethod === 'phone_google' && !userData.email) {
      userData.email = `${userData.phone}@temp.perbox.com`;
      userData.password = 'temp-password-123';
    }
    const user = await authService.register(userData);

    // Send email verification only if real email provided
    if (userData.registrationMethod === 'email' || (userData.email && !userData.email.includes('@temp.perbox.com'))) {
      await emailVerificationService.sendVerificationEmail(user.id, user.email);
    }

    // Send phone verification if phone provided
    let otpId: string | undefined;
    if (userData.phone && userData.registrationMethod === 'phone_google') {
      otpId = await phoneVerificationService.sendOTP(user.id, userData.phone, 'registration');
    }

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isEmailVerified: user.isEmailVerified,
          isPhoneVerified: user.isPhoneVerified
        },
        otpId,
        message: 'Registration successful. Please check your email for verification.'
      }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'REGISTRATION_FAILED',
        message: error.message
      }
    });
  }
});

// Login endpoint
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
    
    if (isDemoMode) {
      console.log('🎭 Demo mode login attempt:', credentials.email);
    }
    
    const authToken = await authService.login(credentials);

    res.json({
      success: true,
      data: authToken
    });
  } catch (error: any) {
    console.error('Login error:', error.message);
    res.status(401).json({
      success: false,
      error: {
        code: 'LOGIN_FAILED',
        message: error.message
      }
    });
  }
});

// Refresh token endpoint
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

    const authToken = await authService.refreshToken(refreshToken);

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

// Logout endpoint
router.post('/logout', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    await authService.logout((req as any).user.id);
    
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

// Send OTP endpoint
router.post('/send-otp', async (req: Request, res: Response) => {
  try {
    const { userId, phone, type } = req.body;
    
    if (!userId || !phone || !type) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_PARAMETERS',
          message: 'userId, phone, and type are required'
        }
      });
    }

    const otpId = await phoneVerificationService.sendOTP(userId, phone, type);

    res.json({
      success: true,
      data: { otpId }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'OTP_SEND_FAILED',
        message: error.message
      }
    });
  }
});

// Verify OTP endpoint
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { error, value } = otpSchema.validate(req.body);
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
    const isValid = await phoneVerificationService.verifyOTP(otpId, code);

    res.json({
      success: true,
      data: { verified: isValid }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'OTP_VERIFICATION_FAILED',
        message: error.message
      }
    });
  }
});

// Verify OTP with authentication (returns JWT tokens)
router.post('/verify-otp-auth', async (req: Request, res: Response) => {
  try {
    const { error, value } = otpSchema.validate(req.body);
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
    
    // Verify OTP and get user authentication
    const authResult = await phoneVerificationService.verifyOTPWithAuth(otpId, code);

    res.json({
      success: true,
      data: authResult
    });
  } catch (error: any) {
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

// Resend OTP endpoint
router.post('/resend-otp', async (req: Request, res: Response) => {
  try {
    const { otpId } = req.body;
    
    if (!otpId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'OTP_ID_REQUIRED',
          message: 'OTP ID is required'
        }
      });
    }

    const newOtpId = await phoneVerificationService.resendOTP(otpId);

    res.json({
      success: true,
      data: { otpId: newOtpId }
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'OTP_RESEND_FAILED',
        message: error.message
      }
    });
  }
});

// Verify email endpoint
router.get('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    
    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOKEN_REQUIRED',
          message: 'Verification token is required'
        }
      });
    }

    const isValid = await emailVerificationService.verifyEmail(token);

    res.json({
      success: true,
      data: { verified: isValid },
      message: 'Email verified successfully'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'EMAIL_VERIFICATION_FAILED',
        message: error.message
      }
    });
  }
});

// Resend email verification endpoint
router.post('/resend-email-verification', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    const verificationId = await emailVerificationService.resendVerificationEmail((req as any).user.id);

    res.json({
      success: true,
      data: { verificationId },
      message: 'Verification email sent'
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: {
        code: 'EMAIL_RESEND_FAILED',
        message: error.message
      }
    });
  }
});

// Google OAuth routes (only in non-demo mode)
if (!isDemoMode && googleOAuthService) {
  router.get('/google', passport.authenticate('google', {
    scope: ['profile', 'email']
  }));

  router.get('/google/callback', 
    passport.authenticate('google', { session: false }),
    async (req: Request, res: Response) => {
      try {
        const user = req.user as any;
        const authToken = await authService.login({ email: user.email, password: '' });
        
        // Redirect to frontend with token
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/auth/callback?token=${authToken.accessToken}&refresh=${authToken.refreshToken}`);
      } catch (error: any) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/auth/error?message=${encodeURIComponent(error.message)}`);
      }
    }
  );
} else {
  // Demo mode - provide mock Google OAuth endpoints
  router.get('/google', (req: Request, res: Response) => {
    res.status(501).json({
      success: false,
      error: {
        code: 'DEMO_MODE',
        message: 'Google OAuth is disabled in demo mode. Use email/password login.'
      }
    });
  });

  router.get('/google/callback', (req: Request, res: Response) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/error?message=${encodeURIComponent('Google OAuth is disabled in demo mode')}`);
  });
}

// API key management routes are now in separate router
// Import and use: import apiKeyRoutes from './api-key.routes';

// Get current user endpoint
router.get('/me', authMiddleware.authenticate, (req: Request, res: Response) => {
  res.json({
    success: true,
    data: { user: (req as any).user }
  });
});

export default router;