import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAuth0 } from '@auth0/auth0-react';
import { Auth0SignupFlow } from '../Auth0SignupFlow';
import { Auth0Callback } from '../Auth0Callback';
import { PhoneVerificationForAuth0 } from '../PhoneVerificationForAuth0';

// Mock Auth0
jest.mock('@auth0/auth0-react');
const mockUseAuth0 = useAuth0 as jest.MockedFunction<typeof useAuth0>;

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock auth API
jest.mock('@/lib/auth', () => ({
  authApi: {
    sendOTP: jest.fn(),
    verifyOTP: jest.fn(),
    resendOTP: jest.fn(),
  },
}));

describe('Auth0 Components', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Auth0SignupFlow', () => {
    const mockProps = {
      onComplete: jest.fn(),
      onCancel: jest.fn(),
    };

    it('renders Auth0 signup step initially', () => {
      mockUseAuth0.mockReturnValue({
        loginWithRedirect: jest.fn(),
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        getAccessTokenSilently: jest.fn(),
        handleRedirectCallback: jest.fn(),
        logout: jest.fn(),
        getIdTokenClaims: jest.fn(),
        getAccessTokenWithPopup: jest.fn(),
        loginWithPopup: jest.fn(),
      });

      render(<Auth0SignupFlow {...mockProps} />);

      expect(screen.getByText('Create Your Account')).toBeInTheDocument();
      expect(screen.getByText('Sign Up with Auth0')).toBeInTheDocument();
    });

    it('shows loading state when Auth0 is loading', () => {
      mockUseAuth0.mockReturnValue({
        loginWithRedirect: jest.fn(),
        user: null,
        isAuthenticated: false,
        isLoading: true,
        error: null,
        getAccessTokenSilently: jest.fn(),
        handleRedirectCallback: jest.fn(),
        logout: jest.fn(),
        getIdTokenClaims: jest.fn(),
        getAccessTokenWithPopup: jest.fn(),
        loginWithPopup: jest.fn(),
      });

      render(<Auth0SignupFlow {...mockProps} />);

      expect(screen.getByText('Authenticating...')).toBeInTheDocument();
    });

    it('calls loginWithRedirect when signup button is clicked', async () => {
      const mockLoginWithRedirect = jest.fn();
      mockUseAuth0.mockReturnValue({
        loginWithRedirect: mockLoginWithRedirect,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        getAccessTokenSilently: jest.fn(),
        handleRedirectCallback: jest.fn(),
        logout: jest.fn(),
        getIdTokenClaims: jest.fn(),
        getAccessTokenWithPopup: jest.fn(),
        loginWithPopup: jest.fn(),
      });

      render(<Auth0SignupFlow {...mockProps} />);

      const signupButton = screen.getByText('Sign Up with Auth0');
      fireEvent.click(signupButton);

      await waitFor(() => {
        expect(mockLoginWithRedirect).toHaveBeenCalledWith({
          authorizationParams: {
            screen_hint: 'signup',
            prompt: 'login'
          }
        });
      });
    });

    it('shows phone verification step when user is authenticated but phone not verified', () => {
      const mockUser = {
        sub: 'auth0|123',
        email: 'test@example.com',
        phone_verified: false,
      };

      mockUseAuth0.mockReturnValue({
        loginWithRedirect: jest.fn(),
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        getAccessTokenSilently: jest.fn(),
        handleRedirectCallback: jest.fn(),
        logout: jest.fn(),
        getIdTokenClaims: jest.fn(),
        getAccessTokenWithPopup: jest.fn(),
        loginWithPopup: jest.fn(),
      });

      render(<Auth0SignupFlow {...mockProps} />);

      expect(screen.getByText('Add Your Phone Number')).toBeInTheDocument();
    });

    it('completes signup when user is authenticated and phone is verified', () => {
      const mockUser = {
        sub: 'auth0|123',
        email: 'test@example.com',
        phone_verified: true,
        phone_number: '+1234567890',
      };

      mockUseAuth0.mockReturnValue({
        loginWithRedirect: jest.fn(),
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        getAccessTokenSilently: jest.fn(),
        handleRedirectCallback: jest.fn(),
        logout: jest.fn(),
        getIdTokenClaims: jest.fn(),
        getAccessTokenWithPopup: jest.fn(),
        loginWithPopup: jest.fn(),
      });

      render(<Auth0SignupFlow {...mockProps} />);

      expect(mockProps.onComplete).toHaveBeenCalledWith({
        auth0User: mockUser,
        phone: '+1234567890',
      });
    });

    it('displays Auth0 errors', () => {
      const mockError = { message: 'Authentication failed' };
      mockUseAuth0.mockReturnValue({
        loginWithRedirect: jest.fn(),
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: mockError,
        getAccessTokenSilently: jest.fn(),
        handleRedirectCallback: jest.fn(),
        logout: jest.fn(),
        getIdTokenClaims: jest.fn(),
        getAccessTokenWithPopup: jest.fn(),
        loginWithPopup: jest.fn(),
      });

      render(<Auth0SignupFlow {...mockProps} />);

      expect(screen.getByText('Authentication failed: Authentication failed')).toBeInTheDocument();
    });
  });

  describe('Auth0Callback', () => {
    const mockProps = {
      onSuccess: jest.fn(),
      onError: jest.fn(),
      redirectTo: '/dashboard',
    };

    it('shows loading state initially', () => {
      mockUseAuth0.mockReturnValue({
        loginWithRedirect: jest.fn(),
        user: null,
        isAuthenticated: false,
        isLoading: true,
        error: null,
        getAccessTokenSilently: jest.fn(),
        handleRedirectCallback: jest.fn(),
        logout: jest.fn(),
        getIdTokenClaims: jest.fn(),
        getAccessTokenWithPopup: jest.fn(),
        loginWithPopup: jest.fn(),
      });

      render(<Auth0Callback {...mockProps} />);

      expect(screen.getByText('Authenticating...')).toBeInTheDocument();
    });

    it('shows error state when Auth0 has error', () => {
      const mockError = { message: 'Authentication failed' };
      mockUseAuth0.mockReturnValue({
        loginWithRedirect: jest.fn(),
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: mockError,
        getAccessTokenSilently: jest.fn(),
        handleRedirectCallback: jest.fn(),
        logout: jest.fn(),
        getIdTokenClaims: jest.fn(),
        getAccessTokenWithPopup: jest.fn(),
        loginWithPopup: jest.fn(),
      });

      render(<Auth0Callback {...mockProps} />);

      expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      expect(screen.getByText('Authentication failed')).toBeInTheDocument();
    });

    it('calls onSuccess when authentication is successful', () => {
      const mockUser = { sub: 'auth0|123', email: 'test@example.com' };
      mockUseAuth0.mockReturnValue({
        loginWithRedirect: jest.fn(),
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        getAccessTokenSilently: jest.fn(),
        handleRedirectCallback: jest.fn(),
        logout: jest.fn(),
        getIdTokenClaims: jest.fn(),
        getAccessTokenWithPopup: jest.fn(),
        loginWithPopup: jest.fn(),
      });

      render(<Auth0Callback {...mockProps} />);

      expect(mockProps.onSuccess).toHaveBeenCalledWith(mockUser);
    });
  });

  describe('PhoneVerificationForAuth0', () => {
    const mockProps = {
      onVerified: jest.fn(),
      onBack: jest.fn(),
      onError: jest.fn(),
      onLoading: jest.fn(),
      loading: false,
      error: null,
      auth0User: { sub: 'auth0|123', email: 'test@example.com' },
    };

    beforeEach(() => {
      mockUseAuth0.mockReturnValue({
        loginWithRedirect: jest.fn(),
        user: mockProps.auth0User,
        isAuthenticated: true,
        isLoading: false,
        error: null,
        getAccessTokenSilently: jest.fn().mockResolvedValue('mock-token'),
        handleRedirectCallback: jest.fn(),
        logout: jest.fn(),
        getIdTokenClaims: jest.fn(),
        getAccessTokenWithPopup: jest.fn(),
        loginWithPopup: jest.fn(),
      });
    });

    it('renders phone input form initially', () => {
      render(<PhoneVerificationForAuth0 {...mockProps} />);

      expect(screen.getByText('Add Your Phone Number')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('(555) 123-4567')).toBeInTheDocument();
    });

    it('formats phone number input correctly', () => {
      render(<PhoneVerificationForAuth0 {...mockProps} />);

      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      fireEvent.change(phoneInput, { target: { value: '1234567890' } });

      expect(phoneInput).toHaveValue('(123) 456-7890');
    });

    it('validates phone number before submission', () => {
      render(<PhoneVerificationForAuth0 {...mockProps} />);

      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      const sendButton = screen.getByText('Send Code');

      fireEvent.change(phoneInput, { target: { value: '123' } });
      
      expect(sendButton).toBeDisabled();
    });

    it('enables send button with valid phone number', () => {
      render(<PhoneVerificationForAuth0 {...mockProps} />);

      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      const sendButton = screen.getByText('Send Code');

      fireEvent.change(phoneInput, { target: { value: '1234567890' } });
      
      expect(sendButton).not.toBeDisabled();
    });

    it('shows OTP input after phone submission', async () => {
      const { authApi } = require('@/lib/auth');
      authApi.sendOTP.mockResolvedValue({ otpId: 'mock-otp-id' });

      render(<PhoneVerificationForAuth0 {...mockProps} />);

      const phoneInput = screen.getByPlaceholderText('(555) 123-4567');
      const sendButton = screen.getByText('Send Code');

      fireEvent.change(phoneInput, { target: { value: '1234567890' } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText('Verify Your Phone')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Enter 6-digit code')).toBeInTheDocument();
      });
    });
  });
});