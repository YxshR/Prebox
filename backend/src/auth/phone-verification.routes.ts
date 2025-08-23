import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { EnhancedPhoneVerificationService } from './enhanced-phone-verification.service';
const router = Router();
const phoneVerificationService = new EnhancedPhoneVerificationService();

// Validation schemas
const phoneCheckSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be in valid international format'
    })
});

const startVerificationSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be in valid international format'
    }),
  type: Joi.string()
    .valid('registration', 'login', 'password_reset')
    .default('registration'),
  userId: Joi.string().uuid().optional()
});

const verifyOTPSchema = Joi.object({
  otpId: Joi.string().uuid().required(),
  code: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.length': 'Verification code must be 6 digits',
      'string.pattern.base': 'Verification code must contain only numbers'
    })
});

const resendOTPSchema = Joi.object({
  otpId: Joi.string().uuid().required()
});

/**
 * Check if phone number already exists
 * Requirement 1.2: Check if phone number already exists in database
 */
router.post('/check-phone', async (req: Request, res: Response) => {
  try {

    const { error, value } = phoneCheckSchema.validate(req.body);
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
    const result = await phoneVerificationService.checkPhoneExists(phone);

    res.json({
      success: true,
      data: {
        exists: result.exists,
        isVerified: result.isVerified || false
      }
    });
  } catch (error: any) {
    console.error('Phone check error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'PHONE_CHECK_FAILED',
        message: 'Failed to check phone number availability'
      }
    });
  }
});

/**
 * Start phone verification process
 * Requirement 1.4: Send OTP via SMS and store verification attempt in database
 */
router.post('/start-verification', async (req: Request, res: Response) => {
  try {

    const { error, value } = startVerificationSchema.validate(req.body);
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

    const { phone, type, userId } = value;
    const result = await phoneVerificationService.startVerification(phone, type, userId);

    res.status(201).json({
      success: true,
      data: {
        otpId: result.otpId,
        expiresAt: result.expiresAt,
        attemptsRemaining: result.attemptsRemaining,
        message: 'Verification code sent successfully'
      }
    });
  } catch (error: any) {
    console.error('Start verification error:', error);
    
    let statusCode = 400;
    let errorCode = 'VERIFICATION_START_FAILED';
    
    if (error.message.includes('already registered')) {
      statusCode = 409;
      errorCode = 'PHONE_ALREADY_EXISTS';
    } else if (error.message.includes('Too many')) {
      statusCode = 429;
      errorCode = 'RATE_LIMIT_EXCEEDED';
    } else if (error.message.includes('Failed to send')) {
      statusCode = 503;
      errorCode = 'SMS_DELIVERY_FAILED';
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
 * Verify OTP code
 * Requirement 1.5: Verify OTP and update database
 * Requirement 1.6: Allow retry for incorrect OTP without blocking user
 */
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {

    const { error, value } = verifyOTPSchema.validate(req.body);
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
    const result = await phoneVerificationService.verifyOTP(otpId, code);

    if (result.isValid) {
      res.json({
        success: true,
        data: {
          verified: true,
          message: 'Phone number verified successfully'
        }
      });
    } else {
      // Return appropriate status based on error type
      let statusCode = 400;
      if (result.isExpired) {
        statusCode = 410; // Gone
      } else if (result.isRateLimited) {
        statusCode = 429; // Too Many Requests
      }

      res.status(statusCode).json({
        success: false,
        error: {
          code: result.isExpired ? 'OTP_EXPIRED' : 
                result.isRateLimited ? 'OTP_RATE_LIMITED' : 'OTP_INVALID',
          message: result.errorMessage || 'Invalid verification code',
          canRetry: result.canRetry,
          attemptsRemaining: result.attemptsRemaining
        }
      });
    }
  } catch (error: any) {
    console.error('OTP verification error:', error);
    
    res.status(500).json({
      success: false,
      error: {
        code: 'OTP_VERIFICATION_FAILED',
        message: 'Failed to verify code. Please try again.'
      }
    });
  }
});

/**
 * Resend OTP code
 */
router.post('/resend-otp', async (req: Request, res: Response) => {
  try {

    const { error, value } = resendOTPSchema.validate(req.body);
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

    const { otpId } = value;
    const result = await phoneVerificationService.resendOTP(otpId);

    res.json({
      success: true,
      data: {
        otpId: result.otpId,
        expiresAt: result.expiresAt,
        attemptsRemaining: result.attemptsRemaining,
        message: 'New verification code sent successfully'
      }
    });
  } catch (error: any) {
    console.error('OTP resend error:', error);
    
    let statusCode = 400;
    let errorCode = 'OTP_RESEND_FAILED';
    
    if (error.message.includes('wait')) {
      statusCode = 429;
      errorCode = 'RESEND_COOLDOWN_ACTIVE';
    } else if (error.message.includes('not found')) {
      statusCode = 404;
      errorCode = 'OTP_NOT_FOUND';
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
 */
router.get('/status/:otpId', async (req: Request, res: Response) => {
  try {
    const otpId = req.params.otpId;
    
    if (!otpId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(otpId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_OTP_ID',
          message: 'Invalid OTP ID format'
        }
      });
    }

    const status = await phoneVerificationService.getVerificationStatus(otpId);

    if (!status.exists) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'OTP_NOT_FOUND',
          message: 'Verification not found'
        }
      });
    }

    res.json({
      success: true,
      data: {
        isExpired: status.isExpired,
        isVerified: status.isVerified,
        attemptsRemaining: status.attemptsRemaining,
        expiresAt: status.expiresAt
      }
    });
  } catch (error: any) {
    console.error('Get verification status error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_CHECK_FAILED',
        message: 'Failed to check verification status'
      }
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await phoneVerificationService.getHealthStatus();
    
    const isHealthy = health.database && health.redis;
    const statusCode = isHealthy ? 200 : 503;

    res.status(statusCode).json({
      success: isHealthy,
      data: {
        status: isHealthy ? 'healthy' : 'unhealthy',
        services: {
          database: health.database ? 'up' : 'down',
          redis: health.redis ? 'up' : 'down',
          twilio: health.twilio ? 'up' : 'down'
        },
        metrics: {
          activeVerifications: health.activeVerifications
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Health check error:', error);
    res.status(503).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check failed'
      }
    });
  }
});

export default router;