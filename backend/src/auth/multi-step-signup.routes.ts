/**
 * Multi-Step Phone Signup Routes
 * 
 * API endpoints for the complete multi-step phone signup flow:
 * - POST /start - Start phone signup
 * - POST /verify-phone - Verify phone OTP
 * - POST /verify-email - Verify email
 * - POST /complete - Complete signup with password
 * - GET /status/:id - Get signup status
 * - DELETE /cancel/:id - Cancel signup
 */

import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { MultiStepSignupService } from './services/multi-step-signup.service';
import { AuthDatabaseError, DatabaseConstraintError } from './models/auth.models';
import { logger } from '../shared/logger';

const router = Router();
const multiStepSignupService = new MultiStepSignupService();

// Validation schemas
const startSignupSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+?[\d\s\-\(\)]{10,}$/)
    .required()
    .messages({
      'string.pattern.base': 'Phone number must be at least 10 digits and can contain +, spaces, dashes, and parentheses',
      'any.required': 'Phone number is required'
    })
});

const verifyPhoneSchema = Joi.object({
  signupStateId: Joi.string().uuid().required(),
  otpCode: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.length': 'OTP must be exactly 6 digits',
      'string.pattern.base': 'OTP must contain only numbers'
    })
});

const verifyEmailSchema = Joi.object({
  signupStateId: Joi.string().uuid().required(),
  email: Joi.string().email().required(),
  verificationCode: Joi.string()
    .length(8)
    .pattern(/^[A-Za-z0-9]{8}$/)
    .required()
    .messages({
      'string.length': 'Verification code must be exactly 8 characters',
      'string.pattern.base': 'Verification code must contain only letters and numbers'
    })
});

const completeSignupSchema = Joi.object({
  signupStateId: Joi.string().uuid().required(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one letter and one number'
    })
});

/**
 * POST /api/auth/signup/phone/start
 * Start the multi-step phone signup process
 */
router.post('/start', async (req: Request, res: Response) => {
  try {
    // Validate input
    const { error, value } = startSignupSchema.validate(req.body);
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

    const result = await multiStepSignupService.startPhoneSignup(value);

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Error starting phone signup:', error);

    // Handle specific constraint violations
    if (error instanceof AuthDatabaseError) {
      const statusCode = error.constraintType === DatabaseConstraintError.DUPLICATE_PHONE ? 409 : 400;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: error.constraintType,
          message: error.message,
          field: error.field
        }
      });
    }

    // Handle other errors
    const statusCode = error.message.includes('already in signup process') ? 409 : 400;
    res.status(statusCode).json({
      success: false,
      error: {
        code: 'SIGNUP_START_FAILED',
        message: error.message
      }
    });
  }
});

/**
 * POST /api/auth/signup/phone/verify-phone
 * Verify phone number with OTP
 */
router.post('/verify-phone', async (req: Request, res: Response) => {
  try {
    // Validate input
    const { error, value } = verifyPhoneSchema.validate(req.body);
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

    const result = await multiStepSignupService.verifyPhone(value);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Error verifying phone:', error);

    let statusCode = 400;
    let errorCode = 'PHONE_VERIFICATION_FAILED';

    if (error.message.includes('not found or expired')) {
      statusCode = 404;
      errorCode = 'SIGNUP_SESSION_NOT_FOUND';
    } else if (error.message.includes('Invalid step')) {
      statusCode = 409;
      errorCode = 'INVALID_SIGNUP_STEP';
    } else if (error.message.includes('Invalid OTP')) {
      statusCode = 400;
      errorCode = 'INVALID_OTP';
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
 * POST /api/auth/signup/phone/verify-email
 * Verify email address
 */
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    // Validate input
    const { error, value } = verifyEmailSchema.validate(req.body);
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

    const result = await multiStepSignupService.verifyEmail(value);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    logger.error('Error verifying email:', error);

    // Handle specific constraint violations
    if (error instanceof AuthDatabaseError) {
      const statusCode = error.constraintType === DatabaseConstraintError.DUPLICATE_EMAIL ? 409 : 400;
      return res.status(statusCode).json({
        success: false,
        error: {
          code: error.constraintType,
          message: error.message,
          field: error.field
        }
      });
    }

    let statusCode = 400;
    let errorCode = 'EMAIL_VERIFICATION_FAILED';

    if (error.message.includes('not found or expired')) {
      statusCode = 404;
      errorCode = 'SIGNUP_SESSION_NOT_FOUND';
    } else if (error.message.includes('Invalid step')) {
      statusCode = 409;
      errorCode = 'INVALID_SIGNUP_STEP';
    } else if (error.message.includes('already in use')) {
      statusCode = 409;
      errorCode = 'EMAIL_IN_USE';
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
 * POST /api/auth/signup/phone/complete
 * Complete signup with password creation
 */
router.post('/complete', async (req: Request, res: Response) => {
  try {
    // Validate input
    const { error, value } = completeSignupSchema.validate(req.body);
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

    const result = await multiStepSignupService.completeSignup(value);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          phone: result.user.phone,
          phoneVerified: result.user.phoneVerified,
          emailVerified: result.user.emailVerified,
          createdAt: result.user.createdAt
        },
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        expiresIn: result.expiresIn,
        message: result.message
      }
    });
  } catch (error: any) {
    logger.error('Error completing signup:', error);

    // Handle specific constraint violations
    if (error instanceof AuthDatabaseError) {
      return res.status(409).json({
        success: false,
        error: {
          code: error.constraintType,
          message: error.message,
          field: error.field
        }
      });
    }

    let statusCode = 400;
    let errorCode = 'SIGNUP_COMPLETION_FAILED';

    if (error.message.includes('not found or expired')) {
      statusCode = 404;
      errorCode = 'SIGNUP_SESSION_NOT_FOUND';
    } else if (error.message.includes('Invalid step')) {
      statusCode = 409;
      errorCode = 'INVALID_SIGNUP_STEP';
    } else if (error.message.includes('must be verified')) {
      statusCode = 409;
      errorCode = 'VERIFICATION_REQUIRED';
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
 * GET /api/auth/signup/phone/status/:signupStateId
 * Get current signup status
 */
router.get('/status/:signupStateId', async (req: Request, res: Response) => {
  try {
    const { signupStateId } = req.params;

    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(signupStateId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SIGNUP_STATE_ID',
          message: 'Invalid signup state ID format'
        }
      });
    }

    const signupState = await multiStepSignupService.getSignupStatus(signupStateId);

    if (!signupState) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SIGNUP_SESSION_NOT_FOUND',
          message: 'Signup session not found or expired'
        }
      });
    }

    // Return safe subset of signup state (no sensitive data)
    res.json({
      success: true,
      data: {
        id: signupState.id,
        currentStep: signupState.currentStep,
        phoneVerified: signupState.phoneVerified,
        emailVerified: signupState.emailVerified,
        createdAt: signupState.createdAt,
        expiresAt: signupState.expiresAt
      }
    });
  } catch (error: any) {
    logger.error('Error getting signup status:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'STATUS_CHECK_FAILED',
        message: 'Failed to check signup status'
      }
    });
  }
});

/**
 * DELETE /api/auth/signup/phone/cancel/:signupStateId
 * Cancel signup process
 */
router.delete('/cancel/:signupStateId', async (req: Request, res: Response) => {
  try {
    const { signupStateId } = req.params;

    // Validate UUID format
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(signupStateId)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SIGNUP_STATE_ID',
          message: 'Invalid signup state ID format'
        }
      });
    }

    const cancelled = await multiStepSignupService.cancelSignup(signupStateId);

    if (!cancelled) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SIGNUP_SESSION_NOT_FOUND',
          message: 'Signup session not found or already cancelled'
        }
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Signup process cancelled successfully'
      }
    });
  } catch (error: any) {
    logger.error('Error cancelling signup:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CANCELLATION_FAILED',
        message: 'Failed to cancel signup process'
      }
    });
  }
});

export default router;