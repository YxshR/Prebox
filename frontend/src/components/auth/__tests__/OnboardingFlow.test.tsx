/**
 * Comprehensive tests for OnboardingFlow component
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OnboardingFlow from '../OnboardingFlow';
import { authApi } from '../../../lib/auth';

// Mock dependencies
jest.mock('../../../lib/auth', () => ({
  authApi: {
    requestOTP: jest.fn(),
    verifyOTPWithAuth: jest.fn(),
    resendOTP: jest.fn(),
  },
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
  },
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    form: ({ children, ...props }: any) => <form {...props}>{children}</form>,
    input: ({ children, ...props }: any) => <input {...props}>{children}</input>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
}));

const mockProps = {
  onComplete: jest.fn(),
  onError: jest.fn(),
};

describe('OnboardingFlow Component', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Phone Number Input Step', () => {
    it('renders phone number input form correctly', () => {
      render(<OnboardingFlow {...mockProps} />);
      
      expect(screen.getByText('Welcome to Perbox')).toBeInTheDocument();
      expect(screen.getByText('Enter your phone number to get started')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter phone number')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send verification code/i })).toBeInTheDocument();
    });

    it('validates phone number format', async () => {
      render(<OnboardingFlow {...mockProps} />);
      
      const phoneInput = screen.getByPlaceholderText('Enter phone number');
      const submitButton = screen.getByRole('button', { name: /send verification code/i });

      // Test invalid phone numbers
      const invalidPhones = ['123', 'abc', '123456789', '+1234'];
      
      for (const phone of invalidPhones) {
        await user.clear(phoneInput);
        await user.type(phoneInput, phone);
        await user.click(submitButton);
        
        expect(screen.getByText(/invalid phone number/i)).toBeInTheDocument();
        expect(authApi.requestOTP).not.toHaveBeenCalled();
      }
    });

    it('formats phone number input correctly', async () => {
      render(<OnboardingFlow {...mockProps} />);
      
      const phoneInput = screen.getByPlaceholderText('Enter phone number');
      
      // Test phone number formatting
      await user.type(phoneInput, '9876543210');
      expect(phoneInput).toHaveValue('+91 98765 43210');
      
      await user.clear(phoneInput);
      await user.type(phoneInput, '+1234567890');
      expect(phoneInput).toHaveValue('+1 234 567 890');
    });

    it('submits valid phone number and proceeds to OTP step', async () => {
      const mockRequestOTP = authApi.requestOTP as jest.Mock;
      mockRequestOTP.mockResolvedValue({
        success: true,
        otpId: 'test-otp-id',
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        attemptsRemaining: 3
      });

      render(<OnboardingFlow {...mockProps} />);
      
      const phoneInput = screen.getByPlaceholderText('Enter phone number');
      const submitButton = screen.getByRole('button', { name: /send verification code/i });

      await user.type(phoneInput, '+919876543210');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockRequestOTP).toHaveBeenCalledWith('+91 98765 43210', 'registration');
      });

      // Should proceed to OTP verification step
      await waitFor(() => {
        expect(screen.getByText('Verify Phone Number')).toBeInTheDocument();
        expect(screen.getByText('+91 98765 43210')).toBeInTheDocument();
      });
    });

    it('handles API errors gracefully', async () => {
      const mockRequestOTP = authApi.requestOTP as jest.Mock;
      mockRequestOTP.mockRejectedValue(new Error('Phone number already registered'));

      render(<OnboardingFlow {...mockProps} />);
      
      const phoneInput = screen.getByPlaceholderText('Enter phone number');
      const submitButton = screen.getByRole('button', { name: /send verification code/i });

      await user.type(phoneInput, '+919876543210');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/phone number already registered/i)).toBeInTheDocument();
      });

      expect(mockProps.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Phone number already registered'
        })
      );
    });

    it('shows loading state during API call', async () => {
      const mockRequestOTP = authApi.requestOTP as jest.Mock;
      mockRequestOTP.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

      render(<OnboardingFlow {...mockProps} />);
      
      const phoneInput = screen.getByPlaceholderText('Enter phone number');
      const submitButton = screen.getByRole('button', { name: /send verification code/i });

      await user.type(phoneInput, '+919876543210');
      await user.click(submitButton);

      expect(screen.getByText(/sending/i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });
  });

  describe('OTP Verification Step', () => {
    beforeEach(async () => {
      const mockRequestOTP = authApi.requestOTP as jest.Mock;
      mockRequestOTP.mockResolvedValue({
        success: true,
        otpId: 'test-otp-id',
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        attemptsRemaining: 3
      });

      render(<OnboardingFlow {...mockProps} />);
      
      const phoneInput = screen.getByPlaceholderText('Enter phone number');
      const submitButton = screen.getByRole('button', { name: /send verification code/i });

      await user.type(phoneInput, '+919876543210');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Verify Phone Number')).toBeInTheDocument();
      });
    });

    it('renders OTP input form correctly', () => {
      expect(screen.getByText('Verify Phone Number')).toBeInTheDocument();
      expect(screen.getByText('+91 98765 43210')).toBeInTheDocument();
      expect(screen.getByText('Enter the 6-digit code sent to your phone')).toBeInTheDocument();
      
      const otpInputs = screen.getAllByRole('textbox');
      expect(otpInputs).toHaveLength(6);
    });

    it('handles OTP input correctly', async () => {
      const otpInputs = screen.getAllByRole('textbox');
      
      // Test single digit input
      await user.type(otpInputs[0], '1');
      expect(otpInputs[0]).toHaveValue('1');
      expect(otpInputs[1]).toHaveFocus();

      // Test backspace navigation
      await user.type(otpInputs[1], '{backspace}');
      expect(otpInputs[0]).toHaveFocus();

      // Test non-numeric input rejection
      await user.type(otpInputs[0], 'a');
      expect(otpInputs[0]).toHaveValue('1'); // Should remain unchanged
    });

    it('auto-submits when all digits are entered', async () => {
      const mockVerifyOTP = authApi.verifyOTPWithAuth as jest.Mock;
      mockVerifyOTP.mockResolvedValue({
        success: true,
        user: { id: 'user-1', phoneNumber: '+919876543210', isPhoneVerified: true },
        accessToken: 'test-token',
        refreshToken: 'test-refresh'
      });

      const otpInputs = screen.getAllByRole('textbox');
      
      // Enter complete OTP
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], (i + 1).toString());
      }

      await waitFor(() => {
        expect(mockVerifyOTP).toHaveBeenCalledWith('test-otp-id', '123456');
      });
    });

    it('shows security indicator when enabled', () => {
      expect(screen.getByText('🔒 Secure authentication enabled')).toBeInTheDocument();
    });

    it('handles OTP verification success', async () => {
      const mockVerifyOTP = authApi.verifyOTPWithAuth as jest.Mock;
      const mockUser = {
        id: 'user-1',
        phoneNumber: '+919876543210',
        isPhoneVerified: true,
        firstName: 'Test',
        lastName: 'User'
      };
      
      mockVerifyOTP.mockResolvedValue({
        success: true,
        user: mockUser,
        accessToken: 'test-token',
        refreshToken: 'test-refresh'
      });

      const otpInputs = screen.getAllByRole('textbox');
      
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], (i + 1).toString());
      }

      await waitFor(() => {
        expect(mockProps.onComplete).toHaveBeenCalledWith({
          user: mockUser,
          tokens: {
            accessToken: 'test-token',
            refreshToken: 'test-refresh'
          }
        });
      });
    });

    it('handles OTP verification failure', async () => {
      const mockVerifyOTP = authApi.verifyOTPWithAuth as jest.Mock;
      mockVerifyOTP.mockRejectedValue(new Error('Invalid verification code'));

      const otpInputs = screen.getAllByRole('textbox');
      
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], '0');
      }

      await waitFor(() => {
        expect(screen.getByText(/invalid verification code/i)).toBeInTheDocument();
      });

      // Should show attempts remaining
      expect(screen.getByText(/2 attempts remaining/i)).toBeInTheDocument();
    });

    it('handles maximum attempts exceeded', async () => {
      const mockVerifyOTP = authApi.verifyOTPWithAuth as jest.Mock;
      mockVerifyOTP.mockRejectedValue(new Error('Maximum attempts exceeded'));

      const otpInputs = screen.getAllByRole('textbox');
      
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], '0');
      }

      await waitFor(() => {
        expect(screen.getByText(/maximum attempts exceeded/i)).toBeInTheDocument();
      });

      // Should disable inputs
      otpInputs.forEach(input => {
        expect(input).toBeDisabled();
      });
    });

    it('handles OTP resend functionality', async () => {
      const mockResendOTP = authApi.resendOTP as jest.Mock;
      mockResendOTP.mockResolvedValue({
        success: true,
        otpId: 'new-otp-id',
        expiresAt: new Date(Date.now() + 600000).toISOString()
      });

      // Wait for countdown to finish (mocked)
      act(() => {
        jest.advanceTimersByTime(60000);
      });

      const resendButton = screen.getByText('Resend Code');
      await user.click(resendButton);

      await waitFor(() => {
        expect(mockResendOTP).toHaveBeenCalledWith('test-otp-id');
      });

      expect(screen.getByText(/code sent successfully/i)).toBeInTheDocument();
    });

    it('shows countdown timer for resend', () => {
      expect(screen.getByText(/resend in \d+s/i)).toBeInTheDocument();
    });

    it('allows editing phone number', async () => {
      const editButton = screen.getByText('Edit');
      await user.click(editButton);

      // Should go back to phone input step
      expect(screen.getByText('Welcome to Perbox')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter phone number')).toBeInTheDocument();
    });
  });

  describe('User Information Step', () => {
    beforeEach(async () => {
      // Mock successful phone verification
      const mockRequestOTP = authApi.requestOTP as jest.Mock;
      mockRequestOTP.mockResolvedValue({
        success: true,
        otpId: 'test-otp-id',
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        attemptsRemaining: 3
      });

      const mockVerifyOTP = authApi.verifyOTPWithAuth as jest.Mock;
      mockVerifyOTP.mockResolvedValue({
        success: true,
        requiresUserInfo: true,
        tempToken: 'temp-token'
      });

      render(<OnboardingFlow {...mockProps} />);
      
      // Complete phone verification
      const phoneInput = screen.getByPlaceholderText('Enter phone number');
      await user.type(phoneInput, '+919876543210');
      await user.click(screen.getByRole('button', { name: /send verification code/i }));

      await waitFor(() => {
        expect(screen.getByText('Verify Phone Number')).toBeInTheDocument();
      });

      const otpInputs = screen.getAllByRole('textbox');
      for (let i = 0; i < 6; i++) {
        await user.type(otpInputs[i], (i + 1).toString());
      }

      await waitFor(() => {
        expect(screen.getByText('Complete Your Profile')).toBeInTheDocument();
      });
    });

    it('renders user information form correctly', () => {
      expect(screen.getByText('Complete Your Profile')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('First Name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Last Name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Email (optional)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /complete registration/i })).toBeInTheDocument();
    });

    it('validates required fields', async () => {
      const submitButton = screen.getByRole('button', { name: /complete registration/i });
      await user.click(submitButton);

      expect(screen.getByText('First name is required')).toBeInTheDocument();
      expect(screen.getByText('Last name is required')).toBeInTheDocument();
    });

    it('validates email format when provided', async () => {
      const emailInput = screen.getByPlaceholderText('Email (optional)');
      await user.type(emailInput, 'invalid-email');

      const submitButton = screen.getByRole('button', { name: /complete registration/i });
      await user.click(submitButton);

      expect(screen.getByText('Please enter a valid email address')).toBeInTheDocument();
    });

    it('sanitizes user input', async () => {
      const firstNameInput = screen.getByPlaceholderText('First Name');
      const lastNameInput = screen.getByPlaceholderText('Last Name');
      const emailInput = screen.getByPlaceholderText('Email (optional)');

      await user.type(firstNameInput, '<script>alert("xss")</script>John');
      await user.type(lastNameInput, 'Doe<img src=x onerror=alert("xss")>');
      await user.type(emailInput, '  TEST@EXAMPLE.COM  ');

      expect(firstNameInput).toHaveValue('alert("xss")John');
      expect(lastNameInput).toHaveValue('Doeimg src=x onerroralert("xss")');
      expect(emailInput).toHaveValue('test@example.com');
    });

    it('completes registration successfully', async () => {
      const mockCompleteRegistration = authApi.verifyOTPWithAuth as jest.Mock;
      const mockUser = {
        id: 'user-1',
        phoneNumber: '+919876543210',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        isPhoneVerified: true
      };

      mockCompleteRegistration.mockResolvedValue({
        success: true,
        user: mockUser,
        accessToken: 'final-token',
        refreshToken: 'final-refresh'
      });

      const firstNameInput = screen.getByPlaceholderText('First Name');
      const lastNameInput = screen.getByPlaceholderText('Last Name');
      const emailInput = screen.getByPlaceholderText('Email (optional)');

      await user.type(firstNameInput, 'John');
      await user.type(lastNameInput, 'Doe');
      await user.type(emailInput, 'john@example.com');

      const submitButton = screen.getByRole('button', { name: /complete registration/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockProps.onComplete).toHaveBeenCalledWith({
          user: mockUser,
          tokens: {
            accessToken: 'final-token',
            refreshToken: 'final-refresh'
          }
        });
      });
    });
  });

  describe('Accessibility and UX', () => {
    it('supports keyboard navigation', async () => {
      render(<OnboardingFlow {...mockProps} />);
      
      const phoneInput = screen.getByPlaceholderText('Enter phone number');
      
      // Tab navigation
      await user.tab();
      expect(phoneInput).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('button', { name: /send verification code/i })).toHaveFocus();
    });

    it('provides proper ARIA labels', () => {
      render(<OnboardingFlow {...mockProps} />);
      
      expect(screen.getByLabelText('Phone number')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send verification code/i })).toHaveAttribute('aria-describedby');
    });

    it('announces status changes to screen readers', async () => {
      render(<OnboardingFlow {...mockProps} />);
      
      const phoneInput = screen.getByPlaceholderText('Enter phone number');
      await user.type(phoneInput, '123');

      expect(screen.getByRole('alert')).toHaveTextContent('Invalid phone number format');
    });

    it('handles reduced motion preferences', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn(),
        })),
      });

      render(<OnboardingFlow {...mockProps} />);
      
      // Animations should be disabled or reduced
      const container = screen.getByTestId('onboarding-container');
      expect(container).toHaveClass('reduce-motion');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('handles network errors gracefully', async () => {
      const mockRequestOTP = authApi.requestOTP as jest.Mock;
      mockRequestOTP.mockRejectedValue(new Error('Network error'));

      render(<OnboardingFlow {...mockProps} />);
      
      const phoneInput = screen.getByPlaceholderText('Enter phone number');
      const submitButton = screen.getByRole('button', { name: /send verification code/i });

      await user.type(phoneInput, '+919876543210');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
        expect(screen.getByText(/try again/i)).toBeInTheDocument();
      });
    });

    it('allows retry after errors', async () => {
      const mockRequestOTP = authApi.requestOTP as jest.Mock;
      mockRequestOTP
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          success: true,
          otpId: 'test-otp-id',
          expiresAt: new Date(Date.now() + 600000).toISOString(),
          attemptsRemaining: 3
        });

      render(<OnboardingFlow {...mockProps} />);
      
      const phoneInput = screen.getByPlaceholderText('Enter phone number');
      const submitButton = screen.getByRole('button', { name: /send verification code/i });

      await user.type(phoneInput, '+919876543210');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Retry
      const retryButton = screen.getByText(/try again/i);
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Verify Phone Number')).toBeInTheDocument();
      });
    });

    it('maintains form state during errors', async () => {
      const mockRequestOTP = authApi.requestOTP as jest.Mock;
      mockRequestOTP.mockRejectedValue(new Error('Server error'));

      render(<OnboardingFlow {...mockProps} />);
      
      const phoneInput = screen.getByPlaceholderText('Enter phone number');
      await user.type(phoneInput, '+919876543210');
      
      const submitButton = screen.getByRole('button', { name: /send verification code/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });

      // Phone number should still be in the input
      expect(phoneInput).toHaveValue('+91 98765 43210');
    });
  });

  describe('Security Features', () => {
    it('implements rate limiting feedback', async () => {
      const mockRequestOTP = authApi.requestOTP as jest.Mock;
      mockRequestOTP.mockRejectedValue(new Error('Rate limit exceeded. Please wait before trying again.'));

      render(<OnboardingFlow {...mockProps} />);
      
      const phoneInput = screen.getByPlaceholderText('Enter phone number');
      const submitButton = screen.getByRole('button', { name: /send verification code/i });

      await user.type(phoneInput, '+919876543210');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/rate limit exceeded/i)).toBeInTheDocument();
      });

      // Button should be disabled temporarily
      expect(submitButton).toBeDisabled();
    });

    it('clears sensitive data on unmount', () => {
      const { unmount } = render(<OnboardingFlow {...mockProps} />);
      
      // Component should clear any stored OTP or temporary tokens
      unmount();
      
      // Verify localStorage/sessionStorage is cleared
      expect(localStorage.getItem('tempOtpId')).toBeNull();
      expect(sessionStorage.getItem('tempToken')).toBeNull();
    });

    it('prevents OTP enumeration through timing attacks', async () => {
      const mockVerifyOTP = authApi.verifyOTPWithAuth as jest.Mock;
      
      // Setup component in OTP verification state
      const mockRequestOTP = authApi.requestOTP as jest.Mock;
      mockRequestOTP.mockResolvedValue({
        success: true,
        otpId: 'test-otp-id',
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        attemptsRemaining: 3
      });

      render(<OnboardingFlow {...mockProps} />);
      
      const phoneInput = screen.getByPlaceholderText('Enter phone number');
      await user.type(phoneInput, '+919876543210');
      await user.click(screen.getByRole('button', { name: /send verification code/i }));

      await waitFor(() => {
        expect(screen.getByText('Verify Phone Number')).toBeInTheDocument();
      });

      // Test multiple wrong OTPs - response time should be consistent
      const wrongCodes = ['000000', '111111', '222222'];
      const responseTimes: number[] = [];

      for (const code of wrongCodes) {
        mockVerifyOTP.mockRejectedValue(new Error('Invalid verification code'));
        
        const otpInputs = screen.getAllByRole('textbox');
        
        const startTime = Date.now();
        
        for (let i = 0; i < 6; i++) {
          await user.clear(otpInputs[i]);
          await user.type(otpInputs[i], code[i]);
        }

        await waitFor(() => {
          expect(screen.getByText(/invalid verification code/i)).toBeInTheDocument();
        });

        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      // Response times should be relatively consistent
      const avgTime = responseTimes.reduce((a, b) => a + b) / responseTimes.length;
      const maxVariance = Math.max(...responseTimes.map(t => Math.abs(t - avgTime)));
      
      expect(maxVariance).toBeLessThan(200); // Within 200ms variance
    });
  });
});