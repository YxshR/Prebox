/**
 * Multi-Step Signup Service Unit Tests
 * 
 * Tests the multi-step signup service functionality including:
 * - Starting phone signup
 * - Phone verification
 * - Email verification
 * - Signup completion
 * - Error handling
 */

import { MultiStepSignupService } from '../services/multi-step-signup.service';
import { AuthDatabaseService } from '../services/auth-database.service';
import { SignupStateManager, SignupStep } from '../services/signup-state-manager.service';
import { PhoneVerificationService } from '../phone-verification.service';
import { EmailVerificationService } from '../email-verification.service';
import { AuthService } from '../auth.service';
import { AuthDatabaseError, DatabaseConstraintError } from '../models/auth.models';

// Mock dependencies
jest.mock('../services/auth-database.service');
jest.mock('../services/signup-state-manager.service');
jest.mock('../phone-verification.service');
jest.mock('../email-verification.service');
jest.mock('../auth.service');

describe('MultiStepSignupService', () => {
  let service: MultiStepSignupService;
  let mockAuthDb: jest.Mocked<AuthDatabaseService>;
  let mockStateManager: jest.Mocked<SignupStateManager>;
  let mockPhoneVerification: jest.Mocked<PhoneVerificationService>;
  let mockEmailVerification: jest.Mocked<EmailVerificationService>;
  let mockAuthService: jest.Mocked<AuthService>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create service instance (mocks will be injected)
    service = new MultiStepSignupService();

    // Get mock instances
    mockAuthDb = service['authDb'] as jest.Mocked<AuthDatabaseService>;
    mockStateManager = service['stateManager'] as jest.Mocked<SignupStateManager>;
    mockPhoneVerification = service['phoneVerification'] as jest.Mocked<PhoneVerificationService>;
    mockEmailVerification = service['emailVerification'] as jest.Mocked<EmailVerificationService>;
    mockAuthService = service['authService'] as jest.Mocked<AuthService>;
  });

  describe('startPhoneSignup', () => {
    const validPhone = '+1234567890';
    const mockSignupState = {
      id: 'signup-state-id',
      currentStep: SignupStep.PHONE_VERIFICATION,
      phone: validPhone,
      phoneVerified: false,
      emailVerified: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      metadata: {}
    };

    it('should start phone signup successfully', async () => {
      // Setup mocks
      mockAuthDb.getUserByPhone.mockResolvedValue(null);
      mockStateManager.getSignupStateByPhone.mockResolvedValue(null);
      mockStateManager.createSignupState.mockResolvedValue(mockSignupState);
      mockPhoneVerification.sendOTP.mockResolvedValue('otp-id');

      const result = await service.startPhoneSignup({ phone: validPhone });

      expect(result).toEqual({
        signupStateId: 'signup-state-id',
        otpId: 'otp-id',
        message: 'OTP sent to your phone number. Please verify to continue.'
      });

      expect(mockAuthDb.getUserByPhone).toHaveBeenCalledWith(validPhone);
      expect(mockStateManager.getSignupStateByPhone).toHaveBeenCalledWith(validPhone);
      expect(mockStateManager.createSignupState).toHaveBeenCalledWith({
        phone: validPhone,
        metadata: expect.objectContaining({
          startedAt: expect.any(String),
          userAgent: 'multi-step-signup'
        })
      });
      expect(mockPhoneVerification.sendOTP).toHaveBeenCalledWith(
        expect.any(String),
        validPhone,
        'registration'
      );
    });

    it('should reject invalid phone number format', async () => {
      const invalidPhone = 'invalid-phone';

      await expect(service.startPhoneSignup({ phone: invalidPhone }))
        .rejects.toThrow('Invalid phone number format');

      expect(mockAuthDb.getUserByPhone).not.toHaveBeenCalled();
    });

    it('should reject duplicate phone number', async () => {
      const existingUser = {
        id: 'user-id',
        email: 'existing@example.com',
        phone: validPhone,
        phoneVerified: true,
        emailVerified: true,
        createdAt: new Date()
      };

      mockAuthDb.getUserByPhone.mockResolvedValue(existingUser);

      await expect(service.startPhoneSignup({ phone: validPhone }))
        .rejects.toThrow(AuthDatabaseError);

      expect(mockStateManager.getSignupStateByPhone).not.toHaveBeenCalled();
    });

    it('should reject phone already in signup process', async () => {
      mockAuthDb.getUserByPhone.mockResolvedValue(null);
      mockStateManager.getSignupStateByPhone.mockResolvedValue(mockSignupState);

      await expect(service.startPhoneSignup({ phone: validPhone }))
        .rejects.toThrow('Phone number is already in signup process');

      expect(mockStateManager.createSignupState).not.toHaveBeenCalled();
    });
  });

  describe('verifyPhone', () => {
    const signupStateId = 'signup-state-id';
    const otpCode = '123456';
    const mockSignupState = {
      id: signupStateId,
      currentStep: SignupStep.PHONE_VERIFICATION,
      phone: '+1234567890',
      phoneVerified: false,
      emailVerified: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      metadata: {}
    };

    it('should verify phone successfully', async () => {
      const updatedState = {
        ...mockSignupState,
        phoneVerified: true,
        currentStep: SignupStep.EMAIL_VERIFICATION
      };

      mockStateManager.getSignupState.mockResolvedValue(mockSignupState);
      mockStateManager.markPhoneVerified.mockResolvedValue(updatedState);

      const result = await service.verifyPhone({ signupStateId, otpCode });

      expect(result).toEqual({
        signupStateId,
        currentStep: SignupStep.EMAIL_VERIFICATION,
        message: 'Phone number verified successfully. Please provide your email address.'
      });

      expect(mockStateManager.getSignupState).toHaveBeenCalledWith(signupStateId);
      expect(mockStateManager.markPhoneVerified).toHaveBeenCalledWith(signupStateId);
    });

    it('should reject non-existent signup state', async () => {
      mockStateManager.getSignupState.mockResolvedValue(null);

      await expect(service.verifyPhone({ signupStateId, otpCode }))
        .rejects.toThrow('Signup session not found or expired');

      expect(mockStateManager.markPhoneVerified).not.toHaveBeenCalled();
    });

    it('should reject invalid current step', async () => {
      const wrongStepState = {
        ...mockSignupState,
        currentStep: SignupStep.EMAIL_VERIFICATION
      };

      mockStateManager.getSignupState.mockResolvedValue(wrongStepState);

      await expect(service.verifyPhone({ signupStateId, otpCode }))
        .rejects.toThrow('Invalid step');

      expect(mockStateManager.markPhoneVerified).not.toHaveBeenCalled();
    });

    it('should reject invalid OTP format', async () => {
      const invalidOtp = '12345'; // Too short

      await expect(service.verifyPhone({ signupStateId, otpCode: invalidOtp }))
        .rejects.toThrow('Invalid OTP format');

      expect(mockStateManager.getSignupState).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    const signupStateId = 'signup-state-id';
    const email = 'test@example.com';
    const verificationCode = 'ABC12345';
    const mockSignupState = {
      id: signupStateId,
      currentStep: SignupStep.EMAIL_VERIFICATION,
      phone: '+1234567890',
      phoneVerified: true,
      emailVerified: false,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      metadata: {}
    };

    it('should verify email successfully', async () => {
      const updatedState = {
        ...mockSignupState,
        email,
        emailVerified: true,
        currentStep: SignupStep.PASSWORD_CREATION
      };

      mockStateManager.getSignupState.mockResolvedValue(mockSignupState);
      mockAuthDb.getUserByEmail.mockResolvedValue(null);
      mockStateManager.getSignupStateByEmail.mockResolvedValue(null);
      mockStateManager.updateSignupState.mockResolvedValue(mockSignupState);
      mockStateManager.markEmailVerified.mockResolvedValue(updatedState);

      const result = await service.verifyEmail({ signupStateId, email, verificationCode });

      expect(result).toEqual({
        signupStateId,
        currentStep: SignupStep.PASSWORD_CREATION,
        message: 'Email verified successfully. Please create your password.'
      });

      expect(mockAuthDb.getUserByEmail).toHaveBeenCalledWith(email);
      expect(mockStateManager.updateSignupState).toHaveBeenCalledWith(signupStateId, { email });
      expect(mockStateManager.markEmailVerified).toHaveBeenCalledWith(signupStateId);
    });

    it('should reject invalid email format', async () => {
      const invalidEmail = 'invalid-email';

      await expect(service.verifyEmail({ signupStateId, email: invalidEmail, verificationCode }))
        .rejects.toThrow('Invalid email format');

      expect(mockStateManager.getSignupState).not.toHaveBeenCalled();
    });

    it('should reject duplicate email', async () => {
      const existingUser = {
        id: 'user-id',
        email,
        phoneVerified: true,
        emailVerified: true,
        createdAt: new Date()
      };

      mockStateManager.getSignupState.mockResolvedValue(mockSignupState);
      mockAuthDb.getUserByEmail.mockResolvedValue(existingUser);

      await expect(service.verifyEmail({ signupStateId, email, verificationCode }))
        .rejects.toThrow(AuthDatabaseError);

      expect(mockStateManager.updateSignupState).not.toHaveBeenCalled();
    });

    it('should reject email in use by another signup process', async () => {
      const otherSignupState = {
        ...mockSignupState,
        id: 'other-signup-id'
      };

      mockStateManager.getSignupState.mockResolvedValue(mockSignupState);
      mockAuthDb.getUserByEmail.mockResolvedValue(null);
      mockStateManager.getSignupStateByEmail.mockResolvedValue(otherSignupState);

      await expect(service.verifyEmail({ signupStateId, email, verificationCode }))
        .rejects.toThrow('Email address is already in use in another signup process');

      expect(mockStateManager.updateSignupState).not.toHaveBeenCalled();
    });

    it('should reject invalid verification code format', async () => {
      const invalidCode = '123'; // Too short

      await expect(service.verifyEmail({ signupStateId, email, verificationCode: invalidCode }))
        .rejects.toThrow('Invalid verification code format');

      expect(mockStateManager.getSignupState).not.toHaveBeenCalled();
    });
  });

  describe('completeSignup', () => {
    const signupStateId = 'signup-state-id';
    const password = 'TestPass123';
    const phone = '+1234567890';
    const email = 'test@example.com';
    const mockSignupState = {
      id: signupStateId,
      currentStep: SignupStep.PASSWORD_CREATION,
      phone,
      email,
      phoneVerified: true,
      emailVerified: true,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      metadata: {}
    };

    const mockUser = {
      id: 'user-id',
      email,
      phone,
      phoneVerified: true,
      emailVerified: true,
      createdAt: new Date()
    };

    const mockAuthToken = {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: 900,
      user: mockUser
    };

    it('should complete signup successfully', async () => {
      mockStateManager.getSignupState.mockResolvedValue(mockSignupState);
      mockAuthDb.createUser.mockResolvedValue(mockUser);
      mockAuthDb.updateUser.mockResolvedValue(mockUser);
      mockAuthService.login.mockResolvedValue(mockAuthToken);
      mockStateManager.completeSignup.mockResolvedValue({
        ...mockSignupState,
        currentStep: SignupStep.COMPLETED
      });

      const result = await service.completeSignup({ signupStateId, password });

      expect(result).toEqual({
        user: mockUser,
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        message: 'Signup completed successfully. Welcome!'
      });

      expect(mockAuthDb.createUser).toHaveBeenCalledWith({
        email,
        phone,
        passwordHash: expect.any(String)
      });
      expect(mockAuthDb.updateUser).toHaveBeenCalledWith(mockUser.id, {
        phoneVerified: true,
        emailVerified: true,
        lastLogin: expect.any(Date)
      });
      expect(mockAuthService.login).toHaveBeenCalledWith({ email, password });
    });

    it('should reject weak password', async () => {
      const weakPassword = '123'; // Too weak

      await expect(service.completeSignup({ signupStateId, password: weakPassword }))
        .rejects.toThrow('Password must be at least 8 characters long');

      expect(mockStateManager.getSignupState).not.toHaveBeenCalled();
    });

    it('should reject invalid current step', async () => {
      const wrongStepState = {
        ...mockSignupState,
        currentStep: SignupStep.EMAIL_VERIFICATION
      };

      mockStateManager.getSignupState.mockResolvedValue(wrongStepState);

      await expect(service.completeSignup({ signupStateId, password }))
        .rejects.toThrow('Invalid step');

      expect(mockAuthDb.createUser).not.toHaveBeenCalled();
    });

    it('should reject missing required data', async () => {
      const incompleteState = {
        ...mockSignupState,
        email: undefined
      };

      mockStateManager.getSignupState.mockResolvedValue(incompleteState);

      await expect(service.completeSignup({ signupStateId, password }))
        .rejects.toThrow('Missing required signup data');

      expect(mockAuthDb.createUser).not.toHaveBeenCalled();
    });

    it('should reject unverified phone or email', async () => {
      const unverifiedState = {
        ...mockSignupState,
        phoneVerified: false
      };

      mockStateManager.getSignupState.mockResolvedValue(unverifiedState);

      await expect(service.completeSignup({ signupStateId, password }))
        .rejects.toThrow('Phone and email must be verified');

      expect(mockAuthDb.createUser).not.toHaveBeenCalled();
    });
  });

  describe('getSignupStatus', () => {
    it('should return signup status', async () => {
      const signupStateId = 'signup-state-id';
      const mockState = {
        id: signupStateId,
        currentStep: SignupStep.PHONE_VERIFICATION,
        phone: '+1234567890',
        phoneVerified: false,
        emailVerified: false,
        createdAt: new Date(),
        expiresAt: new Date(),
        metadata: {}
      };

      mockStateManager.getSignupState.mockResolvedValue(mockState);

      const result = await service.getSignupStatus(signupStateId);

      expect(result).toBe(mockState);
      expect(mockStateManager.getSignupState).toHaveBeenCalledWith(signupStateId);
    });

    it('should return null for non-existent state', async () => {
      const signupStateId = 'non-existent-id';

      mockStateManager.getSignupState.mockResolvedValue(null);

      const result = await service.getSignupStatus(signupStateId);

      expect(result).toBeNull();
    });
  });

  describe('cancelSignup', () => {
    it('should cancel signup successfully', async () => {
      const signupStateId = 'signup-state-id';

      mockStateManager.deleteSignupState.mockResolvedValue(true);

      const result = await service.cancelSignup(signupStateId);

      expect(result).toBe(true);
      expect(mockStateManager.deleteSignupState).toHaveBeenCalledWith(signupStateId);
    });

    it('should return false for non-existent state', async () => {
      const signupStateId = 'non-existent-id';

      mockStateManager.deleteSignupState.mockResolvedValue(false);

      const result = await service.cancelSignup(signupStateId);

      expect(result).toBe(false);
    });
  });
});