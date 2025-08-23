import api from './api';
import { secureApiClient } from './secureApiClient';
import { InputValidator, SecurityLogger } from './security';

export interface User {
  id: string;
  email: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  tenantId: string;
  role: string;
  subscriptionTier: string;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  createdAt: string;
  lastLoginAt: string;
}

export interface RegisterData {
  email: string;
  password: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  registrationMethod: 'email' | 'phone_google';
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface RegisterResponse {
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
  };
  otpId?: string;
  message: string;
}

export const authApi = {
  // Register new user with security validation
  register: async (data: RegisterData): Promise<RegisterResponse> => {
    // Validate input data
    const emailValidation = InputValidator.validateEmail(data.email);
    if (!emailValidation.isValid) {
      throw new Error(emailValidation.error);
    }

    if (data.phone) {
      const phoneValidation = InputValidator.validatePhone(data.phone);
      if (!phoneValidation.isValid) {
        throw new Error(phoneValidation.error);
      }
    }

    SecurityLogger.log('AUTH_REGISTER_ATTEMPT', 'User registration attempt', {
      email: data.email,
      registrationMethod: data.registrationMethod
    });

    const response = await secureApiClient.post('/auth/register', data);
    
    if (response.success) {
      SecurityLogger.log('AUTH_REGISTER_SUCCESS', 'User registration successful', {
        email: data.email
      });
      return response.data as RegisterResponse;
    } else {
      SecurityLogger.log('AUTH_REGISTER_FAILED', 'User registration failed', {
        email: data.email,
        error: response.error
      });
      throw new Error(response.error?.message || 'Registration failed');
    }
  },

  // Login user with security validation
  login: async (data: LoginData): Promise<AuthResponse> => {
    // Validate input data
    const emailValidation = InputValidator.validateEmail(data.email);
    if (!emailValidation.isValid) {
      throw new Error(emailValidation.error);
    }

    SecurityLogger.log('AUTH_LOGIN_ATTEMPT', 'User login attempt', {
      email: data.email
    });

    const response = await secureApiClient.post('/auth/login', data);
    
    if (response.success) {
      SecurityLogger.log('AUTH_LOGIN_SUCCESS', 'User login successful', {
        email: data.email
      });
      return response.data as AuthResponse;
    } else {
      SecurityLogger.log('AUTH_LOGIN_FAILED', 'User login failed', {
        email: data.email,
        error: response.error
      });
      throw new Error(response.error?.message || 'Login failed');
    }
  },

  // Send OTP for phone verification with security validation
  sendOTP: async (userId: string, phone: string, type: string): Promise<{ otpId: string }> => {
    // Validate phone number
    const phoneValidation = InputValidator.validatePhone(phone);
    if (!phoneValidation.isValid) {
      throw new Error(phoneValidation.error);
    }

    SecurityLogger.log('AUTH_OTP_SEND_ATTEMPT', 'OTP send attempt', {
      userId,
      phone,
      type
    });

    const response = await secureApiClient.post('/auth/send-otp', { userId, phone, type });
    
    if (response.success) {
      SecurityLogger.log('AUTH_OTP_SEND_SUCCESS', 'OTP sent successfully', {
        userId,
        phone
      });
      return response.data as { otpId: string };
    } else {
      SecurityLogger.log('AUTH_OTP_SEND_FAILED', 'OTP send failed', {
        userId,
        phone,
        error: response.error
      });
      throw new Error(response.error?.message || 'Failed to send OTP');
    }
  },

  // Verify OTP with security validation
  verifyOTP: async (otpId: string, code: string): Promise<{ verified: boolean }> => {
    // Validate OTP format
    const otpValidation = InputValidator.validateOTP(code);
    if (!otpValidation.isValid) {
      throw new Error(otpValidation.error);
    }

    SecurityLogger.log('AUTH_OTP_VERIFY_ATTEMPT', 'OTP verification attempt', {
      otpId
    });

    const response = await secureApiClient.post('/auth/verify-otp', { otpId, code });
    
    if (response.success) {
      SecurityLogger.log('AUTH_OTP_VERIFY_SUCCESS', 'OTP verification successful', {
        otpId
      });
      return response.data as { verified: boolean };
    } else {
      SecurityLogger.log('AUTH_OTP_VERIFY_FAILED', 'OTP verification failed', {
        otpId,
        error: response.error
      });
      throw new Error(response.error?.message || 'OTP verification failed');
    }
  },

  // Verify OTP with authentication (returns JWT tokens)
  verifyOTPWithAuth: async (otpId: string, code: string): Promise<AuthResponse> => {
    // Validate OTP format
    const otpValidation = InputValidator.validateOTP(code);
    if (!otpValidation.isValid) {
      throw new Error(otpValidation.error);
    }

    SecurityLogger.log('AUTH_OTP_AUTH_ATTEMPT', 'OTP authentication attempt', {
      otpId
    });

    const response = await secureApiClient.post('/auth/verify-otp-auth', { otpId, code });
    
    if (response.success) {
      SecurityLogger.log('AUTH_OTP_AUTH_SUCCESS', 'OTP authentication successful', {
        otpId
      });
      return response.data as AuthResponse;
    } else {
      SecurityLogger.log('AUTH_OTP_AUTH_FAILED', 'OTP authentication failed', {
        otpId,
        error: response.error
      });
      throw new Error(response.error?.message || 'OTP authentication failed');
    }
  },

  // Resend OTP with rate limiting
  resendOTP: async (otpId: string): Promise<{ otpId: string }> => {
    SecurityLogger.log('AUTH_OTP_RESEND_ATTEMPT', 'OTP resend attempt', {
      otpId
    });

    const response = await secureApiClient.post('/auth/resend-otp', { otpId }, {
      customRateLimit: { maxRequests: 2, windowMs: 120000 } // 2 requests per 2 minutes
    });
    
    if (response.success) {
      SecurityLogger.log('AUTH_OTP_RESEND_SUCCESS', 'OTP resend successful', {
        otpId
      });
      return response.data as { otpId: string };
    } else {
      SecurityLogger.log('AUTH_OTP_RESEND_FAILED', 'OTP resend failed', {
        otpId,
        error: response.error
      });
      throw new Error(response.error?.message || 'Failed to resend OTP');
    }
  },

  // Verify email
  verifyEmail: async (token: string): Promise<{ verified: boolean }> => {
    SecurityLogger.log('AUTH_EMAIL_VERIFY_ATTEMPT', 'Email verification attempt');

    const response = await secureApiClient.get(`/auth/verify-email?token=${token}`);
    
    if (response.success) {
      SecurityLogger.log('AUTH_EMAIL_VERIFY_SUCCESS', 'Email verification successful');
      return response.data as { verified: boolean };
    } else {
      SecurityLogger.log('AUTH_EMAIL_VERIFY_FAILED', 'Email verification failed', {
        error: response.error
      });
      throw new Error(response.error?.message || 'Email verification failed');
    }
  },

  // Resend email verification
  resendEmailVerification: async (): Promise<{ verificationId: string }> => {
    SecurityLogger.log('AUTH_EMAIL_RESEND_ATTEMPT', 'Email verification resend attempt');

    const response = await secureApiClient.post('/auth/resend-email-verification');
    
    if (response.success) {
      SecurityLogger.log('AUTH_EMAIL_RESEND_SUCCESS', 'Email verification resend successful');
      return response.data as { verificationId: string };
    } else {
      SecurityLogger.log('AUTH_EMAIL_RESEND_FAILED', 'Email verification resend failed', {
        error: response.error
      });
      throw new Error(response.error?.message || 'Failed to resend email verification');
    }
  },

  // Get current user
  getCurrentUser: async (): Promise<User> => {
    const response = await secureApiClient.get('/auth/me');
    
    if (response.success) {
      return (response.data as any).user;
    } else {
      throw new Error(response.error?.message || 'Failed to get user data');
    }
  },

  // Google OAuth authentication
  googleAuth: async (code: string): Promise<AuthResponse> => {
    SecurityLogger.log('AUTH_GOOGLE_ATTEMPT', 'Google OAuth authentication attempt');

    const response = await secureApiClient.post('/auth/google/callback', { code });
    
    if (response.success) {
      SecurityLogger.log('AUTH_GOOGLE_SUCCESS', 'Google OAuth authentication successful');
      return response.data as AuthResponse;
    } else {
      SecurityLogger.log('AUTH_GOOGLE_FAILED', 'Google OAuth authentication failed', {
        error: response.error
      });
      throw new Error(response.error?.message || 'Google authentication failed');
    }
  },

  // Send email verification
  sendEmailVerification: async (email: string): Promise<{ verificationId: string }> => {
    const emailValidation = InputValidator.validateEmail(email);
    if (!emailValidation.isValid) {
      throw new Error(emailValidation.error);
    }

    SecurityLogger.log('AUTH_EMAIL_VERIFICATION_SEND_ATTEMPT', 'Email verification send attempt', { email });

    const response = await secureApiClient.post('/auth/send-email-verification', { email });
    
    if (response.success) {
      SecurityLogger.log('AUTH_EMAIL_VERIFICATION_SEND_SUCCESS', 'Email verification sent successfully', { email });
      return response.data as { verificationId: string };
    } else {
      SecurityLogger.log('AUTH_EMAIL_VERIFICATION_SEND_FAILED', 'Email verification send failed', {
        email,
        error: response.error
      });
      throw new Error(response.error?.message || 'Failed to send email verification');
    }
  },

  // Verify email with code
  verifyEmailWithCode: async (verificationId: string, code: string): Promise<{ verified: boolean }> => {
    SecurityLogger.log('AUTH_EMAIL_CODE_VERIFY_ATTEMPT', 'Email code verification attempt', { verificationId });

    const response = await secureApiClient.post('/auth/verify-email-code', { verificationId, code });
    
    if (response.success) {
      SecurityLogger.log('AUTH_EMAIL_CODE_VERIFY_SUCCESS', 'Email code verification successful', { verificationId });
      return response.data as { verified: boolean };
    } else {
      SecurityLogger.log('AUTH_EMAIL_CODE_VERIFY_FAILED', 'Email code verification failed', {
        verificationId,
        error: response.error
      });
      throw new Error(response.error?.message || 'Email verification failed');
    }
  },

  // Authenticate with OTP (for phone login)
  authenticateWithOTP: async (otpId: string, code: string): Promise<AuthResponse> => {
    return authApi.verifyOTPWithAuth(otpId, code);
  },

  // Logout with security logging
  logout: async (): Promise<void> => {
    SecurityLogger.log('AUTH_LOGOUT_ATTEMPT', 'User logout attempt');

    try {
      await secureApiClient.post('/auth/logout');
      SecurityLogger.log('AUTH_LOGOUT_SUCCESS', 'User logout successful');
    } catch (error) {
      SecurityLogger.log('AUTH_LOGOUT_FAILED', 'User logout failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      // Always clear local tokens
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      secureApiClient.clearAuth();
    }
  },
};

// Export individual functions for easier imports
export const register = authApi.register;
export const login = authApi.login;
export const sendOTP = authApi.sendOTP;
export const verifyOTP = authApi.verifyOTP;
export const authenticateWithOTP = authApi.authenticateWithOTP;
export const sendEmailVerification = authApi.sendEmailVerification;
export const verifyEmail = authApi.verifyEmailWithCode;
export const googleAuth = authApi.googleAuth;
export const logout = authApi.logout;