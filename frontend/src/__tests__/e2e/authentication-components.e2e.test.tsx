/**
 * Frontend Authentication Components E2E Tests
 * Tests all authentication components and flows
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jest } from '@jest/globals';

// Import components to test
import { PhoneSignupFlow } from '../../components/auth/PhoneSignupFlow';
import { Auth0SignupFlow } from '../../components/auth/Auth0SignupFlow';
import { LoginMethodSelector } from '../../components/auth/LoginMethodSelector';
import { PhoneOTPLogin } from '../../components/auth/PhoneOTPLogin';
import { EmailPasswordLogin } from '../../components/auth/EmailPasswordLogin';
import { PricingDisplay } from '../../components/pricing/PricingDisplay';

// Mock API calls
const mockApiClient = {
  post: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
};

jest.mock('../../lib/api-client', () => ({
  apiClient: mockApiClient
}));

// Mock Auth0
const mockAuth0 = {
  loginWithRedirect: jest.fn(),
  logout: jest.fn(),
  getAccessTokenSilently: jest.fn(),
  user: null,
  isAuthenticated: false,
  isLoading: false
};

jest.mock('@auth0/auth0-react', () => ({
  useAuth0: () => mockAuth0,
  Auth0Provider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

// Mock Next.js router
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn()
};

jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/'
}));

describe('Authentication Components E2E Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiClient.post.mockClear();
    mockApiClient.get.mockClear();
  });

  describe('Multi-Step Phone Signup Flow', () => {
    it('should complete full phone signup flow', async () => {
      const user = userEvent.setup();
      
      // Mock API responses
      mockApiClient.post
        .mockResolvedValueOnce({
          data: { success: true, message: 'OTP sent successfully', step: 1 }
        })
        .mockResolvedValueOnce({
          data: { success: true, message: 'Phone verified successfully', step: 2 }
        })
        .mockResolvedValueOnce({
          data: { success: true, message: 'Email verification sent', step: 3 }
        })
        .mockResolvedValueOnce({
          data: { success: true, message: 'Email verified successfully' }
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            message: 'Signup completed successfully',
            user: { id: '1', phone: '+1234567890', email: 'test@example.com' },
            tokens: { accessToken: 'test-token', refreshToken: 'test-refresh' }
          }
        });

      const onComplete = jest.fn();
      render(<PhoneSignupFlow onComplete={onComplete} />);

      // Step 1: Enter phone number
      const phoneInput = screen.getByLabelText(/phone number/i);
      await user.type(phoneInput, '+1234567890');
      
      const sendOtpButton = screen.getByRole('button', { name: /send otp/i });
      await user.click(sendOtpButton);

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/signup/phone/start', {
          phone: '+1234567890'
        });
      });

      // Step 2: Enter OTP
      await waitFor(() => {
        expect(screen.getByText(/enter the otp/i)).toBeInTheDocument();
      });

      const otpInput = screen.getByLabelText(/otp code/i);
      await user.type(otpInput, '123456');
      
      const verifyOtpButton = screen.getByRole('button', { name: /verify otp/i });
      await user.click(verifyOtpButton);

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/signup/phone/verify', {
          phone: '+1234567890',
          otp: '123456'
        });
      });

      // Step 3: Enter email
      await waitFor(() => {
        expect(screen.getByText(/enter your email/i)).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'test@example.com');
      
      const sendEmailButton = screen.getByRole('button', { name: /send verification/i });
      await user.click(sendEmailButton);

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/signup/email/verify', {
          phone: '+1234567890',
          email: 'test@example.com'
        });
      });

      // Step 4: Verify email
      await waitFor(() => {
        expect(screen.getByText(/check your email/i)).toBeInTheDocument();
      });

      const emailCodeInput = screen.getByLabelText(/verification code/i);
      await user.type(emailCodeInput, '654321');
      
      const verifyEmailButton = screen.getByRole('button', { name: /verify email/i });
      await user.click(verifyEmailButton);

      // Step 5: Create password
      await waitFor(() => {
        expect(screen.getByText(/create password/i)).toBeInTheDocument();
      });

      const passwordInput = screen.getByLabelText(/^password$/i);
      const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
      
      await user.type(passwordInput, 'SecurePass123!');
      await user.type(confirmPasswordInput, 'SecurePass123!');
      
      const completeButton = screen.getByRole('button', { name: /complete signup/i });
      await user.click(completeButton);

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/signup/complete', {
          phone: '+1234567890',
          email: 'test@example.com',
          password: 'SecurePass123!'
        });
      });

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith({
          user: { id: '1', phone: '+1234567890', email: 'test@example.com' },
          tokens: { accessToken: 'test-token', refreshToken: 'test-refresh' }
        });
      });
    });

    it('should handle duplicate phone number error', async () => {
      const user = userEvent.setup();
      
      mockApiClient.post.mockRejectedValueOnce({
        response: {
          data: {
            success: false,
            error: 'Phone number already exists',
            code: 'DUPLICATE_PHONE'
          }
        }
      });

      render(<PhoneSignupFlow onComplete={jest.fn()} />);

      const phoneInput = screen.getByLabelText(/phone number/i);
      await user.type(phoneInput, '+1234567890');
      
      const sendOtpButton = screen.getByRole('button', { name: /send otp/i });
      await user.click(sendOtpButton);

      await waitFor(() => {
        expect(screen.getByText(/phone number already exists/i)).toBeInTheDocument();
      });
    });

    it('should handle invalid OTP error', async () => {
      const user = userEvent.setup();
      
      mockApiClient.post
        .mockResolvedValueOnce({
          data: { success: true, message: 'OTP sent successfully', step: 1 }
        })
        .mockRejectedValueOnce({
          response: {
            data: {
              success: false,
              error: 'Invalid or expired OTP',
              code: 'INVALID_OTP'
            }
          }
        });

      render(<PhoneSignupFlow onComplete={jest.fn()} />);

      // Enter phone and get to OTP step
      const phoneInput = screen.getByLabelText(/phone number/i);
      await user.type(phoneInput, '+1234567890');
      await user.click(screen.getByRole('button', { name: /send otp/i }));

      await waitFor(() => {
        expect(screen.getByLabelText(/otp code/i)).toBeInTheDocument();
      });

      // Enter wrong OTP
      const otpInput = screen.getByLabelText(/otp code/i);
      await user.type(otpInput, '000000');
      await user.click(screen.getByRole('button', { name: /verify otp/i }));

      await waitFor(() => {
        expect(screen.getByText(/invalid or expired otp/i)).toBeInTheDocument();
      });
    });

    it('should show progress indicator', async () => {
      render(<PhoneSignupFlow onComplete={jest.fn()} />);

      // Should show step 1 initially
      expect(screen.getByText(/step 1 of 4/i)).toBeInTheDocument();
      
      // Progress bar should be visible
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuenow', '25'); // 1/4 = 25%
    });
  });

  describe('Auth0 Signup Flow', () => {
    it('should handle Auth0 authentication and phone verification', async () => {
      const user = userEvent.setup();
      
      mockAuth0.loginWithRedirect.mockResolvedValue(undefined);
      mockApiClient.post
        .mockResolvedValueOnce({
          data: { success: true, message: 'Auth0 profile created, phone verification required', step: 2 }
        })
        .mockResolvedValueOnce({
          data: { success: true, message: 'Phone verification sent' }
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            message: 'Auth0 signup completed successfully',
            user: { id: '1', email: 'auth0@example.com', auth0Id: 'auth0|test' },
            tokens: { accessToken: 'auth0-token', refreshToken: 'auth0-refresh' }
          }
        });

      const onComplete = jest.fn();
      render(<Auth0SignupFlow onComplete={onComplete} />);

      // Click Auth0 signup button
      const auth0Button = screen.getByRole('button', { name: /continue with auth0/i });
      await user.click(auth0Button);

      expect(mockAuth0.loginWithRedirect).toHaveBeenCalled();

      // Simulate Auth0 callback with user data
      act(() => {
        mockAuth0.user = {
          sub: 'auth0|test',
          email: 'auth0@example.com',
          name: 'Auth0 User'
        };
        mockAuth0.isAuthenticated = true;
      });

      // Should now show phone verification step
      await waitFor(() => {
        expect(screen.getByText(/verify your phone/i)).toBeInTheDocument();
      });

      const phoneInput = screen.getByLabelText(/phone number/i);
      await user.type(phoneInput, '+1987654321');
      
      const sendOtpButton = screen.getByRole('button', { name: /send otp/i });
      await user.click(sendOtpButton);

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/signup/auth0/phone', {
          auth0Id: 'auth0|test',
          phone: '+1987654321'
        });
      });

      // Enter OTP
      await waitFor(() => {
        expect(screen.getByLabelText(/otp code/i)).toBeInTheDocument();
      });

      const otpInput = screen.getByLabelText(/otp code/i);
      await user.type(otpInput, '123456');
      
      const verifyButton = screen.getByRole('button', { name: /verify/i });
      await user.click(verifyButton);

      await waitFor(() => {
        expect(onComplete).toHaveBeenCalledWith({
          user: { id: '1', email: 'auth0@example.com', auth0Id: 'auth0|test' },
          tokens: { accessToken: 'auth0-token', refreshToken: 'auth0-refresh' }
        });
      });
    });

    it('should handle Auth0 authentication errors', async () => {
      const user = userEvent.setup();
      
      mockAuth0.loginWithRedirect.mockRejectedValue(new Error('Auth0 Error'));

      render(<Auth0SignupFlow onComplete={jest.fn()} />);

      const auth0Button = screen.getByRole('button', { name: /continue with auth0/i });
      await user.click(auth0Button);

      await waitFor(() => {
        expect(screen.getByText(/authentication failed/i)).toBeInTheDocument();
      });
    });
  });

  describe('Login Components', () => {
    it('should render login method selector', async () => {
      const user = userEvent.setup();
      const onMethodSelect = jest.fn();

      render(<LoginMethodSelector onMethodSelect={onMethodSelect} />);

      expect(screen.getByText(/choose login method/i)).toBeInTheDocument();
      
      const auth0Button = screen.getByRole('button', { name: /auth0/i });
      const phoneButton = screen.getByRole('button', { name: /phone/i });
      const emailButton = screen.getByRole('button', { name: /email/i });

      expect(auth0Button).toBeInTheDocument();
      expect(phoneButton).toBeInTheDocument();
      expect(emailButton).toBeInTheDocument();

      await user.click(phoneButton);
      expect(onMethodSelect).toHaveBeenCalledWith('phone');
    });

    it('should handle phone OTP login', async () => {
      const user = userEvent.setup();
      
      mockApiClient.post
        .mockResolvedValueOnce({
          data: { success: true, message: 'OTP sent successfully' }
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            message: 'Login successful',
            user: { id: '1', phone: '+1234567890' },
            tokens: { accessToken: 'login-token', refreshToken: 'login-refresh' }
          }
        });

      const onSuccess = jest.fn();
      render(<PhoneOTPLogin onSuccess={onSuccess} />);

      // Enter phone number
      const phoneInput = screen.getByLabelText(/phone number/i);
      await user.type(phoneInput, '+1234567890');
      
      const requestOtpButton = screen.getByRole('button', { name: /send otp/i });
      await user.click(requestOtpButton);

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/login/phone/request', {
          phone: '+1234567890'
        });
      });

      // Enter OTP
      await waitFor(() => {
        expect(screen.getByLabelText(/otp code/i)).toBeInTheDocument();
      });

      const otpInput = screen.getByLabelText(/otp code/i);
      await user.type(otpInput, '123456');
      
      const loginButton = screen.getByRole('button', { name: /login/i });
      await user.click(loginButton);

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/login/phone', {
          phone: '+1234567890',
          otp: '123456'
        });
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith({
          user: { id: '1', phone: '+1234567890' },
          tokens: { accessToken: 'login-token', refreshToken: 'login-refresh' }
        });
      });
    });

    it('should handle email/password login', async () => {
      const user = userEvent.setup();
      
      mockApiClient.post.mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Login successful',
          user: { id: '1', email: 'test@example.com' },
          tokens: { accessToken: 'email-token', refreshToken: 'email-refresh' }
        }
      });

      const onSuccess = jest.fn();
      render(<EmailPasswordLogin onSuccess={onSuccess} />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'TestPass123!');
      
      const loginButton = screen.getByRole('button', { name: /login/i });
      await user.click(loginButton);

      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith('/api/auth/login/email', {
          email: 'test@example.com',
          password: 'TestPass123!'
        });
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith({
          user: { id: '1', email: 'test@example.com' },
          tokens: { accessToken: 'email-token', refreshToken: 'email-refresh' }
        });
      });
    });

    it('should handle login errors', async () => {
      const user = userEvent.setup();
      
      mockApiClient.post.mockRejectedValueOnce({
        response: {
          data: {
            success: false,
            error: 'Invalid credentials',
            code: 'INVALID_CREDENTIALS'
          }
        }
      });

      render(<EmailPasswordLogin onSuccess={jest.fn()} />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      
      await user.type(emailInput, 'wrong@example.com');
      await user.type(passwordInput, 'wrongpass');
      
      const loginButton = screen.getByRole('button', { name: /login/i });
      await user.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });
    });
  });

  describe('Pricing Display Component', () => {
    it('should display pricing plans successfully', async () => {
      mockApiClient.get.mockResolvedValueOnce({
        data: {
          success: true,
          plans: [
            {
              id: '1',
              name: 'Free',
              price: 0,
              features: ['1,000 emails/month', 'Basic templates'],
              limits: { emails_per_month: 1000 }
            },
            {
              id: '2',
              name: 'Pro',
              price: 29.99,
              features: ['10,000 emails/month', 'Advanced templates'],
              limits: { emails_per_month: 10000 }
            }
          ]
        }
      });

      render(<PricingDisplay />);

      await waitFor(() => {
        expect(screen.getByText('Free')).toBeInTheDocument();
        expect(screen.getByText('Pro')).toBeInTheDocument();
        expect(screen.getByText('$0')).toBeInTheDocument();
        expect(screen.getByText('$29.99')).toBeInTheDocument();
      });

      expect(screen.getByText('1,000 emails/month')).toBeInTheDocument();
      expect(screen.getByText('10,000 emails/month')).toBeInTheDocument();
    });

    it('should display fallback pricing when API fails', async () => {
      mockApiClient.get.mockRejectedValueOnce(new Error('API Error'));

      render(<PricingDisplay />);

      await waitFor(() => {
        expect(screen.getByText(/unable to load pricing/i)).toBeInTheDocument();
      });

      // Should show fallback pricing
      expect(screen.getByText(/basic plan/i)).toBeInTheDocument();
    });

    it('should handle loading state', async () => {
      mockApiClient.get.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      );

      render(<PricingDisplay />);

      expect(screen.getByText(/loading pricing/i)).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('should validate phone number format', async () => {
      const user = userEvent.setup();
      
      render(<PhoneSignupFlow onComplete={jest.fn()} />);

      const phoneInput = screen.getByLabelText(/phone number/i);
      await user.type(phoneInput, 'invalid-phone');
      
      const sendOtpButton = screen.getByRole('button', { name: /send otp/i });
      await user.click(sendOtpButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid phone number format/i)).toBeInTheDocument();
      });
    });

    it('should validate email format', async () => {
      const user = userEvent.setup();
      
      render(<EmailPasswordLogin onSuccess={jest.fn()} />);

      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'invalid-email');
      
      const loginButton = screen.getByRole('button', { name: /login/i });
      await user.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
      });
    });

    it('should validate password strength', async () => {
      const user = userEvent.setup();
      
      mockApiClient.post.mockResolvedValueOnce({
        data: { success: true, step: 1 }
      }).mockResolvedValueOnce({
        data: { success: true, step: 2 }
      }).mockResolvedValueOnce({
        data: { success: true, step: 3 }
      }).mockResolvedValueOnce({
        data: { success: true }
      });

      render(<PhoneSignupFlow onComplete={jest.fn()} />);

      // Navigate to password step (simplified)
      const phoneInput = screen.getByLabelText(/phone number/i);
      await user.type(phoneInput, '+1234567890');
      await user.click(screen.getByRole('button', { name: /send otp/i }));

      // Skip to password step for testing
      await waitFor(() => {
        if (screen.queryByLabelText(/^password$/i)) {
          return true;
        }
        // Simulate completing previous steps
        return false;
      });

      const passwordInput = screen.getByLabelText(/^password$/i);
      await user.type(passwordInput, 'weak');

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<PhoneSignupFlow onComplete={jest.fn()} />);

      const phoneInput = screen.getByLabelText(/phone number/i);
      expect(phoneInput).toHaveAttribute('aria-required', 'true');

      const form = screen.getByRole('form');
      expect(form).toHaveAttribute('aria-label');
    });

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup();
      
      render(<LoginMethodSelector onMethodSelect={jest.fn()} />);

      const firstButton = screen.getByRole('button', { name: /auth0/i });
      firstButton.focus();

      await user.keyboard('{Tab}');
      expect(screen.getByRole('button', { name: /phone/i })).toHaveFocus();

      await user.keyboard('{Tab}');
      expect(screen.getByRole('button', { name: /email/i })).toHaveFocus();
    });

    it('should announce errors to screen readers', async () => {
      const user = userEvent.setup();
      
      mockApiClient.post.mockRejectedValueOnce({
        response: {
          data: { success: false, error: 'Invalid phone number' }
        }
      });

      render(<PhoneSignupFlow onComplete={jest.fn()} />);

      const phoneInput = screen.getByLabelText(/phone number/i);
      await user.type(phoneInput, 'invalid');
      await user.click(screen.getByRole('button', { name: /send otp/i }));

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toBeInTheDocument();
        expect(errorMessage).toHaveTextContent(/invalid phone number/i);
      });
    });
  });
});