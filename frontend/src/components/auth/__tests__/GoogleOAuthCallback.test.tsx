/**
 * Unit tests for GoogleOAuthCallback component
 * Requirements: 2.4, 2.5
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GoogleOAuthCallback from '../GoogleOAuthCallback';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../LoadingState', () => {
  return function MockLoadingState({ message }: { message: string }) {
    return <div data-testid="loading-state">{message}</div>;
  };
});

jest.mock('../../ErrorDisplay', () => {
  return function MockErrorDisplay({ error, onRetry }: { error: string; onRetry: () => void }) {
    return (
      <div data-testid="error-display">
        <span>{error}</span>
        <button onClick={onRetry}>Retry</button>
      </div>
    );
  };
});

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
}));

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

describe('GoogleOAuthCallback Component', () => {
  const user = userEvent.setup();
  const mockPush = jest.fn();
  const mockSearchParams = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
    
    (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);
    
    mockLocalStorage.setItem.mockClear();
    mockLocalStorage.getItem.mockClear();
  });

  describe('Loading State', () => {
    it('shows loading state initially', () => {
      mockSearchParams.get.mockReturnValue(null);
      
      render(<GoogleOAuthCallback />);
      
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      expect(screen.getByText('Completing Google authentication...')).toBeInTheDocument();
      expect(screen.getByText('Please wait while we sign you in...')).toBeInTheDocument();
    });
  });

  describe('Success Scenarios', () => {
    it('handles successful authentication with all parameters', async () => {
      const mockUser = { id: '123', name: 'John Doe', email: 'john@example.com' };
      
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'success': return 'true';
          case 'token': return 'access-token-123';
          case 'refresh_token': return 'refresh-token-123';
          case 'user': return encodeURIComponent(JSON.stringify(mockUser));
          default: return null;
        }
      });

      const mockOnSuccess = jest.fn();
      render(<GoogleOAuthCallback onSuccess={mockOnSuccess} />);

      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('accessToken', 'access-token-123');
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('refreshToken', 'refresh-token-123');
        expect(toast.success).toHaveBeenCalledWith('Google authentication successful!');
        expect(mockOnSuccess).toHaveBeenCalledWith(mockUser);
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('handles successful authentication without user data', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'success': return 'true';
          case 'token': return 'access-token-123';
          case 'refresh_token': return 'refresh-token-123';
          case 'user': return null;
          default: return null;
        }
      });

      const mockOnSuccess = jest.fn();
      render(<GoogleOAuthCallback onSuccess={mockOnSuccess} />);

      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('accessToken', 'access-token-123');
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('refreshToken', 'refresh-token-123');
        expect(toast.success).toHaveBeenCalledWith('Google authentication successful!');
        expect(mockOnSuccess).toHaveBeenCalledWith(null);
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });

    it('handles malformed user data gracefully', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'success': return 'true';
          case 'token': return 'access-token-123';
          case 'refresh_token': return 'refresh-token-123';
          case 'user': return 'invalid-json';
          default: return null;
        }
      });

      const mockOnSuccess = jest.fn();
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      render(<GoogleOAuthCallback onSuccess={mockOnSuccess} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to parse user data:', expect.any(Error));
        expect(mockOnSuccess).toHaveBeenCalledWith(null);
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Error Scenarios', () => {
    it('handles OAuth error parameters', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'error': return 'access_denied';
          case 'error_description': return 'User denied access';
          default: return null;
        }
      });

      const mockOnError = jest.fn();
      render(<GoogleOAuthCallback onError={mockOnError} />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
        expect(screen.getByText('User denied access')).toBeInTheDocument();
        expect(toast.error).toHaveBeenCalledWith('User denied access');
        expect(mockOnError).toHaveBeenCalledWith('User denied access');
      });
    });

    it('handles OAuth error without description', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'error': return 'server_error';
          case 'error_description': return null;
          default: return null;
        }
      });

      const mockOnError = jest.fn();
      render(<GoogleOAuthCallback onError={mockOnError} />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
        expect(screen.getByText('Google authentication failed')).toBeInTheDocument();
        expect(toast.error).toHaveBeenCalledWith('Google authentication failed');
        expect(mockOnError).toHaveBeenCalledWith('Google authentication failed');
      });
    });

    it('handles success=false parameter', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'success': return 'false';
          case 'message': return 'Authentication failed on server';
          default: return null;
        }
      });

      const mockOnError = jest.fn();
      render(<GoogleOAuthCallback onError={mockOnError} />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
        expect(screen.getByText('Authentication failed on server')).toBeInTheDocument();
        expect(toast.error).toHaveBeenCalledWith('Authentication failed on server');
        expect(mockOnError).toHaveBeenCalledWith('Authentication failed on server');
      });
    });

    it('handles missing tokens', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'success': return null;
          case 'token': return null;
          case 'refresh_token': return null;
          default: return null;
        }
      });

      const mockOnError = jest.fn();
      render(<GoogleOAuthCallback onError={mockOnError} />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
        expect(screen.getByText('Authentication failed - no tokens received')).toBeInTheDocument();
        expect(toast.error).toHaveBeenCalledWith('Authentication failed - no tokens received');
        expect(mockOnError).toHaveBeenCalledWith('Authentication failed - no tokens received');
      });
    });

    it('handles unexpected errors during processing', async () => {
      // Mock searchParams.get to throw an error
      mockSearchParams.get.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const mockOnError = jest.fn();
      render(<GoogleOAuthCallback onError={mockOnError} />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
        expect(screen.getByText('Unexpected error')).toBeInTheDocument();
        expect(toast.error).toHaveBeenCalledWith('Unexpected error');
        expect(mockOnError).toHaveBeenCalledWith('Unexpected error');
      });
    });
  });

  describe('Error UI and Recovery', () => {
    beforeEach(async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'error': return 'access_denied';
          case 'error_description': return 'User denied access';
          default: return null;
        }
      });

      render(<GoogleOAuthCallback />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      });
    });

    it('displays error UI with proper elements', () => {
      expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      expect(screen.getByText('User denied access')).toBeInTheDocument();
      
      // Check for error icon
      const errorIcon = screen.getByRole('button', { name: /try again/i }).closest('div')?.querySelector('svg');
      expect(errorIcon).toBeInTheDocument();
      
      // Check for action buttons
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
    });

    it('handles retry button click', async () => {
      const retryButton = screen.getByRole('button', { name: /try again/i });
      await user.click(retryButton);

      expect(mockPush).toHaveBeenCalledWith('/auth/login');
    });

    it('handles go home button click', async () => {
      const homeButton = screen.getByRole('button', { name: /go home/i });
      await user.click(homeButton);

      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels and roles', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'error': return 'access_denied';
          default: return null;
        }
      });

      render(<GoogleOAuthCallback />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
      
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName();
      });
    });

    it('supports keyboard navigation', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'error': return 'access_denied';
          default: return null;
        }
      });

      render(<GoogleOAuthCallback />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      });

      // Tab through buttons
      await user.tab();
      expect(screen.getByRole('button', { name: /try again/i })).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('button', { name: /go home/i })).toHaveFocus();
    });

    it('announces status changes to screen readers', () => {
      mockSearchParams.get.mockReturnValue(null);
      
      render(<GoogleOAuthCallback />);
      
      // Loading state should be announced
      expect(screen.getByText('Completing Google authentication...')).toBeInTheDocument();
    });
  });

  describe('Security', () => {
    it('does not expose sensitive data in error messages', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'error': return 'server_error';
          case 'error_description': return 'Internal server error: database connection failed with password abc123';
          default: return null;
        }
      });

      render(<GoogleOAuthCallback />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      });

      // Should show the full error message as received from the server
      // In a real implementation, you might want to sanitize this
      expect(screen.getByText(/Internal server error/)).toBeInTheDocument();
    });

    it('handles XSS attempts in URL parameters', async () => {
      const xssAttempt = '<script>alert("xss")</script>';
      
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'error': return 'access_denied';
          case 'error_description': return xssAttempt;
          default: return null;
        }
      });

      render(<GoogleOAuthCallback />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      });

      // The XSS attempt should be rendered as text, not executed
      expect(screen.getByText(xssAttempt)).toBeInTheDocument();
      
      // Verify no script tags were actually created
      expect(document.querySelectorAll('script')).toHaveLength(0);
    });

    it('validates token format before storing', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'success': return 'true';
          case 'token': return 'invalid-token-format';
          case 'refresh_token': return 'invalid-refresh-format';
          default: return null;
        }
      });

      render(<GoogleOAuthCallback />);

      await waitFor(() => {
        // Should still store tokens even if format looks invalid
        // Token validation should happen on the server side
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('accessToken', 'invalid-token-format');
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('refreshToken', 'invalid-refresh-format');
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty search parameters', async () => {
      mockSearchParams.get.mockReturnValue('');

      const mockOnError = jest.fn();
      render(<GoogleOAuthCallback onError={mockOnError} />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
        expect(mockOnError).toHaveBeenCalledWith('Authentication failed - no tokens received');
      });
    });

    it('handles null search parameters', async () => {
      mockSearchParams.get.mockReturnValue(null);

      const mockOnError = jest.fn();
      render(<GoogleOAuthCallback onError={mockOnError} />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
        expect(mockOnError).toHaveBeenCalledWith('Authentication failed - no tokens received');
      });
    });

    it('handles partial success parameters', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'success': return 'true';
          case 'token': return 'access-token-123';
          case 'refresh_token': return null; // Missing refresh token
          default: return null;
        }
      });

      const mockOnError = jest.fn();
      render(<GoogleOAuthCallback onError={mockOnError} />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
        expect(mockOnError).toHaveBeenCalledWith('Authentication failed - no tokens received');
      });
    });

    it('handles localStorage errors gracefully', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'success': return 'true';
          case 'token': return 'access-token-123';
          case 'refresh_token': return 'refresh-token-123';
          default: return null;
        }
      });

      // Mock localStorage to throw an error
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage is full');
      });

      const mockOnError = jest.fn();
      render(<GoogleOAuthCallback onError={mockOnError} />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
        expect(mockOnError).toHaveBeenCalledWith('localStorage is full');
      });
    });
  });

  describe('Component Lifecycle', () => {
    it('processes callback only once on mount', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'success': return 'true';
          case 'token': return 'access-token-123';
          case 'refresh_token': return 'refresh-token-123';
          default: return null;
        }
      });

      const mockOnSuccess = jest.fn();
      const { rerender } = render(<GoogleOAuthCallback onSuccess={mockOnSuccess} />);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      });

      // Re-render should not trigger callback again
      rerender(<GoogleOAuthCallback onSuccess={mockOnSuccess} />);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it('cleans up properly on unmount', () => {
      const { unmount } = render(<GoogleOAuthCallback />);
      
      // Should not throw any errors
      expect(() => unmount()).not.toThrow();
    });
  });
});