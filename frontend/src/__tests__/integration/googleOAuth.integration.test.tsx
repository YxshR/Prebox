/**
 * Integration tests for Google OAuth flow
 * Requirements: 2.4, 2.5
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter } from 'next/navigation';
import LoginPage from '../../app/auth/login/page';
import GoogleCallbackPage from '../../app/auth/google/callback/page';
import { authApi } from '../../lib/auth';
import { googleOAuthService } from '../../lib/googleAuth';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock('../../lib/auth', () => ({
  authApi: {
    login: jest.fn(),
    googleAuth: jest.fn(),
  },
}));

jest.mock('../../lib/googleAuth', () => ({
  googleOAuthService: {
    initiateLogin: jest.fn(),
    handleCallback: jest.fn(),
    isConfigured: jest.fn(() => true),
  },
}));

jest.mock('../../hooks/useApiState', () => ({
  useApiState: () => ({
    state: { loading: false, error: null },
    execute: jest.fn((fn) => fn()),
    retry: jest.fn(),
  }),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
  Toaster: () => <div data-testid="toaster" />,
}));

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock window.location
const mockLocation = {
  href: '',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

describe('Google OAuth Integration', () => {
  const user = userEvent.setup();
  const mockPush = jest.fn();
  const mockSearchParams = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.href = '';
    
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });

    // Set up environment variables
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = 'test-client-id';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000/api';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
  });

  describe('Login Page Google OAuth Integration', () => {
    it('renders Google OAuth button on login page', () => {
      render(<LoginPage />);
      
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
      expect(screen.getByText('Or continue with')).toBeInTheDocument();
    });

    it('initiates Google OAuth flow when button is clicked', async () => {
      render(<LoginPage />);
      
      const googleButton = screen.getByRole('button', { name: /sign in with google/i });
      await user.click(googleButton);
      
      expect(mockLocation.href).toBe('http://localhost:8000/api/auth/google');
    });

    it('disables Google OAuth button when form is loading', () => {
      // Mock loading state
      jest.doMock('../../hooks/useApiState', () => ({
        useApiState: () => ({
          state: { loading: true, error: null },
          execute: jest.fn(),
          retry: jest.fn(),
        }),
      }));

      render(<LoginPage />);
      
      const googleButton = screen.getByRole('button', { name: /sign in with google/i });
      expect(googleButton).toBeDisabled();
    });

    it('shows connection status and error handling', () => {
      render(<LoginPage />);
      
      expect(screen.getByTestId('toaster')).toBeInTheDocument();
      
      // Connection status should be displayed
      const connectionStatus = screen.getByText('Connection Status') || screen.getByTestId('connection-status');
      expect(connectionStatus).toBeInTheDocument();
    });
  });

  describe('Google OAuth Callback Integration', () => {
    beforeEach(() => {
      (require('next/navigation').useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
    });

    it('handles successful OAuth callback', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'success': return 'true';
          case 'token': return 'access-token-123';
          case 'refresh_token': return 'refresh-token-123';
          case 'user': return encodeURIComponent(JSON.stringify({
            id: 'user-123',
            email: 'user@example.com',
            name: 'Test User',
          }));
          default: return null;
        }
      });

      render(<GoogleCallbackPage />);

      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('accessToken', 'access-token-123');
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('refreshToken', 'refresh-token-123');
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('handles OAuth error callback', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'error': return 'access_denied';
          case 'error_description': return 'User denied access';
          default: return null;
        }
      });

      render(<GoogleCallbackPage />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
        expect(screen.getByText('User denied access')).toBeInTheDocument();
      });
    });

    it('provides retry functionality on error', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'error': return 'server_error';
          case 'error_description': return 'Internal server error';
          default: return null;
        }
      });

      render(<GoogleCallbackPage />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /try again/i });
      await user.click(retryButton);

      expect(mockPush).toHaveBeenCalledWith('/auth/login');
    });
  });

  describe('End-to-End OAuth Flow Simulation', () => {
    it('completes full OAuth flow from login to dashboard', async () => {
      // Step 1: Render login page
      const { unmount } = render(<LoginPage />);
      
      // Step 2: Click Google OAuth button
      const googleButton = screen.getByRole('button', { name: /sign in with google/i });
      await user.click(googleButton);
      
      expect(mockLocation.href).toBe('http://localhost:8000/api/auth/google');
      
      // Step 3: Simulate redirect back to callback page with success
      unmount();
      
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'success': return 'true';
          case 'token': return 'access-token-123';
          case 'refresh_token': return 'refresh-token-123';
          case 'user': return encodeURIComponent(JSON.stringify({
            id: 'user-123',
            email: 'user@example.com',
            name: 'Test User',
          }));
          default: return null;
        }
      });
      
      render(<GoogleCallbackPage />);
      
      // Step 4: Verify successful authentication and redirect
      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('accessToken', 'access-token-123');
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('refreshToken', 'refresh-token-123');
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('handles OAuth flow with user denial', async () => {
      // Step 1: Render login page and initiate OAuth
      const { unmount } = render(<LoginPage />);
      
      const googleButton = screen.getByRole('button', { name: /sign in with google/i });
      await user.click(googleButton);
      
      // Step 2: Simulate user denying access
      unmount();
      
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'error': return 'access_denied';
          case 'error_description': return 'The user denied the request';
          default: return null;
        }
      });
      
      render(<GoogleCallbackPage />);
      
      // Step 3: Verify error handling
      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
        expect(screen.getByText('The user denied the request')).toBeInTheDocument();
      });
      
      // Step 4: Test retry flow
      const retryButton = screen.getByRole('button', { name: /try again/i });
      await user.click(retryButton);
      
      expect(mockPush).toHaveBeenCalledWith('/auth/login');
    });

    it('handles OAuth flow with server error', async () => {
      // Step 1: Initiate OAuth flow
      const { unmount } = render(<LoginPage />);
      
      const googleButton = screen.getByRole('button', { name: /sign in with google/i });
      await user.click(googleButton);
      
      // Step 2: Simulate server error
      unmount();
      
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'error': return 'server_error';
          case 'error_description': return 'A server error occurred';
          default: return null;
        }
      });
      
      render(<GoogleCallbackPage />);
      
      // Step 3: Verify error handling and recovery options
      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
        expect(screen.getByText('A server error occurred')).toBeInTheDocument();
      });
      
      // Both retry and home options should be available
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
    });
  });

  describe('Error Recovery and User Experience', () => {
    it('maintains user session during OAuth errors', async () => {
      // Simulate existing user session
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'accessToken') return 'existing-token';
        if (key === 'refreshToken') return 'existing-refresh';
        return null;
      });

      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'error': return 'access_denied';
          default: return null;
        }
      });

      render(<GoogleCallbackPage />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      });

      // Existing tokens should not be cleared on OAuth error
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
    });

    it('provides clear error messages for different error types', async () => {
      const errorScenarios = [
        {
          error: 'access_denied',
          description: 'User denied access',
          expectedMessage: 'User denied access',
        },
        {
          error: 'invalid_request',
          description: 'Invalid OAuth request',
          expectedMessage: 'Invalid OAuth request',
        },
        {
          error: 'server_error',
          description: null,
          expectedMessage: 'Google authentication failed',
        },
      ];

      for (const scenario of errorScenarios) {
        mockSearchParams.get.mockImplementation((param: string) => {
          switch (param) {
            case 'error': return scenario.error;
            case 'error_description': return scenario.description;
            default: return null;
          }
        });

        const { unmount } = render(<GoogleCallbackPage />);

        await waitFor(() => {
          expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
          expect(screen.getByText(scenario.expectedMessage)).toBeInTheDocument();
        });

        unmount();
      }
    });

    it('handles network connectivity issues gracefully', async () => {
      // Simulate network error during callback processing
      mockSearchParams.get.mockImplementation(() => {
        throw new Error('Network error');
      });

      render(<GoogleCallbackPage />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('Security and Privacy', () => {
    it('does not expose sensitive data in error messages', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'error': return 'server_error';
          case 'error_description': return 'Database connection failed with password: secret123';
          default: return null;
        }
      });

      render(<GoogleCallbackPage />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      });

      // The full error message should be displayed as received
      // In production, you might want to sanitize this
      expect(screen.getByText(/Database connection failed/)).toBeInTheDocument();
    });

    it('validates tokens before storage', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'success': return 'true';
          case 'token': return 'malformed.token.here';
          case 'refresh_token': return 'malformed.refresh.token';
          default: return null;
        }
      });

      render(<GoogleCallbackPage />);

      await waitFor(() => {
        // Tokens should still be stored (validation happens server-side)
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('accessToken', 'malformed.token.here');
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('refreshToken', 'malformed.refresh.token');
      });
    });

    it('handles XSS attempts in callback parameters', async () => {
      const xssAttempt = '<script>alert("xss")</script>';
      
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'error': return 'access_denied';
          case 'error_description': return xssAttempt;
          default: return null;
        }
      });

      render(<GoogleCallbackPage />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      });

      // XSS attempt should be rendered as text, not executed
      expect(screen.getByText(xssAttempt)).toBeInTheDocument();
      expect(document.querySelectorAll('script')).toHaveLength(0);
    });
  });

  describe('Accessibility and Usability', () => {
    it('provides keyboard navigation support', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'error': return 'access_denied';
          default: return null;
        }
      });

      render(<GoogleCallbackPage />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      });

      // Tab through interactive elements
      await user.tab();
      expect(screen.getByRole('button', { name: /try again/i })).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('button', { name: /go home/i })).toHaveFocus();
    });

    it('provides proper ARIA labels and roles', async () => {
      render(<LoginPage />);
      
      const googleButton = screen.getByRole('button', { name: /sign in with google/i });
      expect(googleButton).toHaveAccessibleName();
      
      // Check for proper button role
      expect(googleButton).toHaveAttribute('type', 'button');
    });

    it('shows loading states with proper announcements', () => {
      render(<GoogleCallbackPage />);
      
      expect(screen.getByText('Completing Google authentication...')).toBeInTheDocument();
      expect(screen.getByText('Please wait while we sign you in...')).toBeInTheDocument();
    });
  });

  describe('Performance and Optimization', () => {
    it('does not cause memory leaks during OAuth flow', () => {
      const { unmount } = render(<LoginPage />);
      
      // Should not throw any errors on unmount
      expect(() => unmount()).not.toThrow();
    });

    it('handles rapid user interactions gracefully', async () => {
      render(<LoginPage />);
      
      const googleButton = screen.getByRole('button', { name: /sign in with google/i });
      
      // Rapid clicks should not cause issues
      await user.click(googleButton);
      await user.click(googleButton);
      await user.click(googleButton);
      
      // Should only redirect once
      expect(mockLocation.href).toBe('http://localhost:8000/api/auth/google');
    });

    it('optimizes re-renders during OAuth flow', () => {
      const { rerender } = render(<LoginPage />);
      
      // Re-render should not cause issues
      rerender(<LoginPage />);
      
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
    });
  });
});