import { Router, Request, Response, NextFunction } from 'express';
import { 
  validate, 
  sanitizeInput, 
  rateLimitValidation, 
  constraintViolationHandler,
  authSchemas 
} from '../middleware/enhanced-validation.middleware';
import { ErrorHandlingService } from '../services/error-handling.service';
import { ErrorHandlerMiddleware } from './error-handler.middleware';

const router = Router();

/**
 * Enhanced authentication routes with comprehensive error handling
 */

// Apply global middleware
router.use(sanitizeInput);
router.use(constraintViolationHandler);

/**
 * Start phone number signup
 */
router.post('/signup/phone/start',
  rateLimitValidation(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  validate(authSchemas.phoneSignupStart),
  ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
    try {
      const { phone } = req.body;

      // Check if phone already exists
      const existingUser = await checkPhoneExists(phone);
      if (existingUser) {
        return ErrorHandlingService.handleConstraintError(
          {
            code: '23505',
            detail: 'Key (phone)=(+1234567890) already exists.',
            constraint: 'users_phone_key'
          },
          req,
          res
        );
      }

      // Generate and send OTP
      const otpResult = await generateAndSendOTP(phone);
      
      res.status(200).json({
        success: true,
        data: {
          message: 'Verification code sent successfully',
          expiresIn: 300, // 5 minutes
          attemptsRemaining: 3
        }
      });

    } catch (error: any) {
      ErrorHandlingService.handleSystemError(error, req, res);
    }
  })
);

/**
 * Verify phone number OTP
 */
router.post('/signup/phone/verify',
  rateLimitValidation(3, 5 * 60 * 1000), // 3 attempts per 5 minutes
  validate(authSchemas.phoneVerify),
  ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
    try {
      const { phone, otp } = req.body;

      // Verify OTP
      const verificationResult = await verifyPhoneOTP(phone, otp);
      
      if (!verificationResult.valid) {
        return ErrorHandlingService.handleAuthError(
          {
            message: verificationResult.error || 'Invalid verification code',
            code: 'INVALID_OTP'
          },
          req,
          res
        );
      }

      // Store verification state
      await storePhoneVerification(phone);

      res.status(200).json({
        success: true,
        data: {
          message: 'Phone number verified successfully',
          nextStep: 'email_verification'
        }
      });

    } catch (error: any) {
      ErrorHandlingService.handleSystemError(error, req, res);
    }
  })
);

/**
 * Start email verification
 */
router.post('/signup/email/start',
  rateLimitValidation(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  validate(authSchemas.emailSignupStart),
  ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      // Check if email already exists
      const existingUser = await checkEmailExists(email);
      if (existingUser) {
        return ErrorHandlingService.handleConstraintError(
          {
            code: '23505',
            detail: 'Key (email)=(user@example.com) already exists.',
            constraint: 'users_email_key'
          },
          req,
          res
        );
      }

      // Generate and send verification code
      const codeResult = await generateAndSendEmailCode(email);
      
      res.status(200).json({
        success: true,
        data: {
          message: 'Verification code sent to your email',
          expiresIn: 600, // 10 minutes
          attemptsRemaining: 3
        }
      });

    } catch (error: any) {
      ErrorHandlingService.handleSystemError(error, req, res);
    }
  })
);

/**
 * Verify email code
 */
router.post('/signup/email/verify',
  rateLimitValidation(3, 5 * 60 * 1000), // 3 attempts per 5 minutes
  validate(authSchemas.emailVerify),
  ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body;

      // Verify email code
      const verificationResult = await verifyEmailCode(email, code);
      
      if (!verificationResult.valid) {
        return ErrorHandlingService.handleAuthError(
          {
            message: verificationResult.error || 'Invalid verification code',
            code: 'INVALID_CODE'
          },
          req,
          res
        );
      }

      // Store email verification state
      await storeEmailVerification(email);

      res.status(200).json({
        success: true,
        data: {
          message: 'Email verified successfully',
          nextStep: 'password_creation'
        }
      });

    } catch (error: any) {
      ErrorHandlingService.handleSystemError(error, req, res);
    }
  })
);

/**
 * Complete signup with password
 */
router.post('/signup/complete',
  rateLimitValidation(3, 10 * 60 * 1000), // 3 attempts per 10 minutes
  validate(authSchemas.passwordCreation),
  ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
    try {
      const { password } = req.body;

      // Get verification states from session/database
      const verificationStates = await getVerificationStates(req);
      
      if (!verificationStates.phoneVerified || !verificationStates.emailVerified) {
        return ErrorHandlingService.handleAuthError(
          {
            message: 'Please complete phone and email verification first',
            code: 'VERIFICATION_INCOMPLETE'
          },
          req,
          res
        );
      }

      // Create user account
      const user = await createUserAccount({
        phone: verificationStates.phone,
        email: verificationStates.email,
        password
      });

      // Generate authentication tokens
      const tokens = await generateAuthTokens(user.id);

      // Clear verification states
      await clearVerificationStates(req);

      res.status(201).json({
        success: true,
        data: {
          message: 'Account created successfully',
          user: {
            id: user.id,
            email: user.email,
            phone: user.phone,
            createdAt: user.createdAt
          },
          tokens
        }
      });

    } catch (error: any) {
      // Handle constraint violations (duplicate user creation race condition)
      if (error.code === '23505') {
        return ErrorHandlingService.handleConstraintError(error, req, res);
      }
      
      ErrorHandlingService.handleSystemError(error, req, res);
    }
  })
);

/**
 * Login with email and password
 */
router.post('/login/email',
  rateLimitValidation(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  validate(authSchemas.login),
  ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      // Authenticate user
      const authResult = await authenticateWithEmail(email, password);
      
      if (!authResult.success) {
        return ErrorHandlingService.handleAuthError(
          {
            message: 'Invalid email or password',
            code: 'INVALID_CREDENTIALS'
          },
          req,
          res
        );
      }

      // Generate tokens
      const tokens = await generateAuthTokens(authResult.user.id);

      // Update last login
      await updateLastLogin(authResult.user.id);

      res.status(200).json({
        success: true,
        data: {
          message: 'Login successful',
          user: authResult.user,
          tokens
        }
      });

    } catch (error: any) {
      ErrorHandlingService.handleSystemError(error, req, res);
    }
  })
);

/**
 * Login with phone and OTP
 */
router.post('/login/phone',
  rateLimitValidation(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  validate(authSchemas.login),
  ErrorHandlerMiddleware.asyncHandler(async (req: Request, res: Response) => {
    try {
      const { phone, otp } = req.body;

      // Verify OTP
      const otpResult = await verifyPhoneOTP(phone, otp);
      
      if (!otpResult.valid) {
        return ErrorHandlingService.handleAuthError(
          {
            message: 'Invalid verification code',
            code: 'INVALID_OTP'
          },
          req,
          res
        );
      }

      // Find user by phone
      const user = await findUserByPhone(phone);
      if (!user) {
        return ErrorHandlingService.handleAuthError(
          {
            message: 'No account found with this phone number',
            code: 'USER_NOT_FOUND'
          },
          req,
          res
        );
      }

      // Generate tokens
      const tokens = await generateAuthTokens(user.id);

      // Update last login
      await updateLastLogin(user.id);

      res.status(200).json({
        success: true,
        data: {
          message: 'Login successful',
          user,
          tokens
        }
      });

    } catch (error: any) {
      ErrorHandlingService.handleSystemError(error, req, res);
    }
  })
);

// Placeholder functions - implement these based on your database and services
async function checkPhoneExists(phone: string): Promise<boolean> {
  // Implementation depends on your database
  return false;
}

async function checkEmailExists(email: string): Promise<boolean> {
  // Implementation depends on your database
  return false;
}

async function generateAndSendOTP(phone: string): Promise<any> {
  // Implementation depends on your SMS service
  return { success: true };
}

async function verifyPhoneOTP(phone: string, otp: string): Promise<{ valid: boolean; error?: string }> {
  // Implementation depends on your OTP service
  return { valid: true };
}

async function generateAndSendEmailCode(email: string): Promise<any> {
  // Implementation depends on your email service
  return { success: true };
}

async function verifyEmailCode(email: string, code: string): Promise<{ valid: boolean; error?: string }> {
  // Implementation depends on your email verification service
  return { valid: true };
}

async function storePhoneVerification(phone: string): Promise<void> {
  // Store verification state in session or database
}

async function storeEmailVerification(email: string): Promise<void> {
  // Store verification state in session or database
}

async function getVerificationStates(req: Request): Promise<any> {
  // Get verification states from session or database
  return {
    phoneVerified: true,
    emailVerified: true,
    phone: '+1234567890',
    email: 'user@example.com'
  };
}

async function createUserAccount(userData: any): Promise<any> {
  // Create user in database
  return {
    id: '123',
    email: userData.email,
    phone: userData.phone,
    createdAt: new Date()
  };
}

async function generateAuthTokens(userId: string): Promise<any> {
  // Generate JWT tokens
  return {
    accessToken: 'jwt_access_token',
    refreshToken: 'jwt_refresh_token',
    expiresIn: 3600
  };
}

async function clearVerificationStates(req: Request): Promise<void> {
  // Clear verification states from session or database
}

async function authenticateWithEmail(email: string, password: string): Promise<any> {
  // Authenticate user with email and password
  return {
    success: true,
    user: {
      id: '123',
      email,
      phone: '+1234567890'
    }
  };
}

async function findUserByPhone(phone: string): Promise<any> {
  // Find user by phone number
  return {
    id: '123',
    email: 'user@example.com',
    phone
  };
}

async function updateLastLogin(userId: string): Promise<void> {
  // Update user's last login timestamp
}

export default router;