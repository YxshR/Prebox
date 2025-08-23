import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { SendGridEmailService } from './services/sendgrid-email.service';
import { AuthMiddleware } from './auth.middleware';

const router = Router();
const emailService = new SendGridEmailService();
const authMiddleware = new AuthMiddleware();

// Validation schemas
const sendCodeSchema = Joi.object({
  email: Joi.string().email().required(),
  userId: Joi.string().uuid().optional()
});

const verifyCodeSchema = Joi.object({
  verificationId: Joi.string().uuid().required(),
  code: Joi.string().length(6).pattern(/^\d+$/).required()
});

const verifyEmailCodeSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).pattern(/^\d+$/).required()
});

const resendCodeSchema = Joi.object({
  email: Joi.string().email().required(),
  userId: Joi.string().uuid().optional()
});

/**
 * Send email verification code
 * POST /api/auth/email/send-code
 */
router.post('/send-code', async (req: Request, res: Response) => {
  try {
    const { error, value } = sendCodeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }

    const { email, userId } = value;

    // Check if email is already verified
    const isVerified = await emailService.isEmailVerified(email);
    if (isVerified) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_VERIFIED',
          message: 'Email address is already verified'
        }
      });
    }

    const verificationId = await emailService.sendVerificationCode(email, userId);

    res.json({
      success: true,
      data: {
        verificationId,
        message: 'Verification code sent to your email'
      }
    });
  } catch (error: any) {
    console.error('Send verification code error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SEND_CODE_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * Verify email verification code using verification ID
 * POST /api/auth/email/verify-code
 */
router.post('/verify-code', async (req: Request, res: Response) => {
  try {
    const { error, value } = verifyCodeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }

    const { verificationId, code } = value;
    const isValid = await emailService.verifyCode(verificationId, code);

    res.json({
      success: true,
      data: {
        verified: isValid,
        message: 'Email verified successfully'
      }
    });
  } catch (error: any) {
    console.error('Verify code error:', error);
    
    let statusCode = 400;
    let errorCode = 'VERIFICATION_FAILED';
    
    if (error.message.includes('Invalid or expired')) {
      statusCode = 400;
      errorCode = 'INVALID_OR_EXPIRED_CODE';
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
 * Verify email verification code using email and code directly
 * POST /api/auth/email/verify
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { error, value } = verifyEmailCodeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }

    const { email, code } = value;
    const isValid = await emailService.verifyEmailByCode(email, code);

    res.json({
      success: true,
      data: {
        verified: isValid,
        message: 'Email verified successfully'
      }
    });
  } catch (error: any) {
    console.error('Verify email by code error:', error);
    
    let statusCode = 400;
    let errorCode = 'VERIFICATION_FAILED';
    
    if (error.message.includes('Invalid or expired')) {
      statusCode = 400;
      errorCode = 'INVALID_OR_EXPIRED_CODE';
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
 * Resend email verification code
 * POST /api/auth/email/resend-code
 */
router.post('/resend-code', async (req: Request, res: Response) => {
  try {
    const { error, value } = resendCodeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
    }

    const { email, userId } = value;

    // Check if email is already verified
    const isVerified = await emailService.isEmailVerified(email);
    if (isVerified) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMAIL_ALREADY_VERIFIED',
          message: 'Email address is already verified'
        }
      });
    }

    const verificationId = await emailService.resendVerificationCode(email, userId);

    res.json({
      success: true,
      data: {
        verificationId,
        message: 'Verification code resent to your email'
      }
    });
  } catch (error: any) {
    console.error('Resend verification code error:', error);
    
    let statusCode = 400;
    let errorCode = 'RESEND_FAILED';
    
    if (error.message.includes('wait before requesting')) {
      statusCode = 429;
      errorCode = 'RATE_LIMITED';
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
 * Get verification status
 * GET /api/auth/email/status/:verificationId
 */
router.get('/status/:verificationId', async (req: Request, res: Response) => {
  try {
    const { verificationId } = req.params;

    if (!verificationId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VERIFICATION_ID_REQUIRED',
          message: 'Verification ID is required'
        }
      });
    }

    const status = await emailService.getVerificationStatus(verificationId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'VERIFICATION_NOT_FOUND',
          message: 'Verification not found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        id: status.id,
        email: status.email,
        isVerified: status.isUsed,
        expiresAt: status.expiresAt,
        createdAt: status.createdAt
      }
    });
  } catch (error: any) {
    console.error('Get verification status error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_CHECK_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * Check if email is verified
 * GET /api/auth/email/check/:email
 */
router.get('/check/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EMAIL_REQUIRED',
          message: 'Email is required'
        }
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Invalid email format'
        }
      });
    }

    const isVerified = await emailService.isEmailVerified(email);

    res.json({
      success: true,
      data: {
        email,
        isVerified
      }
    });
  } catch (error: any) {
    console.error('Check email verification error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CHECK_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * Clean up expired verification codes (admin endpoint)
 * DELETE /api/auth/email/cleanup
 */
router.delete('/cleanup', authMiddleware.authenticate, async (req: Request, res: Response) => {
  try {
    // Check if user has admin privileges (optional - implement based on your auth system)
    const user = (req as any).user;
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Admin privileges required'
        }
      });
    }

    await emailService.cleanupExpiredCodes();

    res.json({
      success: true,
      data: {
        message: 'Expired verification codes cleaned up successfully'
      }
    });
  } catch (error: any) {
    console.error('Cleanup expired codes error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CLEANUP_FAILED',
        message: error.message
      }
    });
  }
});

export default router;