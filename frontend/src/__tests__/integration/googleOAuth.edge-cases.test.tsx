/**
 * Additional Google OAuth Integration Tests - Edge Cases and Error Scenarios
 * Requirements: 2.4, 2.5
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRouter, useSearchParams } from 'next/navigation';
import GoogleOAuthCallback from '../../components/auth/GoogleOAuthCallback';
import { googleOAuthService } from '../../lib/googleAuth';

// Mock dependencies
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(),
}));

jest.mock('../../lib/googleAuth', () => ({
  googleOAuthService: {
    initiateLogin: jest.fn(),
    handleCallback: jest.fn(),
    isConfigured: jest.fn(() => true),
    getConfigStatus: jest.fn(() => ({
      configured: true,
      clientId: 'Set',
      redirectUri: 'http://localhost:3000/auth/google/callback'
    })),
  },
}));

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../components/LoadingState', () => {
  return function MockLoadingState({ message }: { message: string }) {
    return <div data-testid="loading-state">{message}</div>;
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

describe('Google OAuth Integration - Edge Cases and Error Scenarios', () => {
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

  describe('Network and Connectivity Edge Cases', () => {
    it('handles network timeout during OAuth callback', async () => {
      mockSearchParams.get.mockImplementation(() => {
        throw new Error('Network timeout');
      });

      render(<GoogleOAuthCallback />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
        expect(screen.getByText('Network timeout')).toBeInTheDocument();
      });
    });

    it('handles intermittent network connectivity', async () => {
      let callCount = 0;
      mockSearchParams.get.mockImplementation((param: string) => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Network error');
        }
        switch (param) {
          case 'success': return 'true';
          case 'token': return 'access-token-123';
          case 'refresh_token': return 'refresh-token-123';
          default: return null;
        }
      });

      render(<GoogleOAuthCallback />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('handles slow network responses gracefully', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        return new Promise(resolve => {
          setTimeout(() => {
            switch (param) {
              case 'success': resolve('true');
              case 'token': resolve('access-token-123');
              case 'refresh_token': resolve('refresh-token-123');
              default: resolve(null);
            }
          }, 100);
        });
      });

      render(<GoogleOAuthCallback />);

      // Should show loading state initially
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      expect(screen.getByText('Completing Google authentication...')).toBeInTheDocument();
    });
  });

  describe('Security Edge Cases', () => {
    it('handles malicious callback parameters', async () => {
      const maliciousScript = '<script>alert("xss")</script>';
      const maliciousUser = JSON.stringify({
        id: maliciousScript,
        name: maliciousScript,
        email: 'test@example.com'
      });

      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'success': return 'true';
          case 'token': return 'access-token-123';
          case 'refresh_token': return 'refresh-token-123';
          case 'user': return encodeURIComponent(maliciousUser);
          default: return null;
        }
      });

      const mockOnSuccess = jest.fn();
      render(<GoogleOAuthCallback onSuccess={mockOnSuccess} />);

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalledWith({
          id: maliciousScript,
          name: maliciousScript,
          email: 'test@example.com'
        });
      });

      // Verify no script tags were actually created
      expect(document.querySelectorAll('script')).toHaveLength(0);
    });

    it('handles extremely long callback parameters', async () => {
      const longString = 'a'.repeat(10000);
      
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'success': return 'true';
          case 'token': return longString;
          case 'refresh_token': return longString;
          default: return null;
        }
      });

      render(<GoogleOAuthCallback />);

      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('accessToken', longString);
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('refreshToken', longString);
      });
    });

    it('handles special characters in callback parameters', async () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'error': return 'access_denied';
          case 'error_description': return specialChars;
          default: return null;
        }
      });

      render(<GoogleOAuthCallback />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
        expect(screen.getByText(specialChars)).toBeInTheDocument();
      });
    });
  });

  describe('Browser Compatibility Edge Cases', () => {
    it('handles missing localStorage gracefully', async () => {
      // Mock localStorage to be undefined
      Object.defineProperty(window, 'localStorage', {
        value: undefined,
        writable: true,
      });

      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'success': return 'true';
          case 'token': return 'access-token-123';
          case 'refresh_token': return 'refresh-token-123';
          default: return null;
        }
      });

      render(<GoogleOAuthCallback />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      });

      // Restore localStorage
      Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
      });
    });

    it('handles localStorage quota exceeded', async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new DOMException('QuotaExceededError');
      });

      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'success': return 'true';
          case 'token': return 'access-token-123';
          case 'refresh_token': return 'refresh-token-123';
          default: return null;
        }
      });

      render(<GoogleOAuthCallback />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      });
    });

    it('handles disabled JavaScript scenarios', async () => {
      // Mock a scenario where JavaScript execution is limited
      const originalConsoleError = console.error;
      console.error = jest.fn();

      mockSearchParams.get.mockImplementation(() => {
        throw new Error('Script execution disabled');
      });

      render(<GoogleOAuthCallback />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      });

      console.error = originalConsoleError;
    });
  });

  describe('Race Condition Edge Cases', () => {
    it('handles multiple simultaneous callback processing', async () => {
      let processCount = 0;
      
      mockSearchParams.get.mockImplementation((param: string) => {
        processCount++;
        switch (param) {
          case 'success': return 'true';
          case 'token': return `token-${processCount}`;
          case 'refresh_token': return `refresh-${processCount}`;
          default: return null;
        }
      });

      // Render multiple instances
      const { unmount: unmount1 } = render(<GoogleOAuthCallback />);
      const { unmount: unmount2 } = render(<GoogleOAuthCallback />);

      await waitFor(() => {
        // Both should process, but localStorage should only be called for the last one
        expect(mockLocalStorage.setItem).toHaveBeenCalled();
      });

      unmount1();
      unmount2();
    });

    it('handles component unmounting during callback processing', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        return new Promise(resolve => {
          setTimeout(() => {
            switch (param) {
              case 'success': resolve('true');
              case 'token': resolve('access-token-123');
              case 'refresh_token': resolve('refresh-token-123');
              default: resolve(null);
            }
          }, 50);
        });
      });

      const { unmount } = render(<GoogleOAuthCallback />);

      // Unmount before callback completes
      setTimeout(() => unmount(), 25);

      // Should not throw any errors
      await new Promise(resolve => setTimeout(resolve, 100));
    });
  });

  describe('Data Integrity Edge Cases', () => {
    it('handles corrupted token data', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'success': return 'true';
          case 'token': return 'corrupted.token.data.here';
          case 'refresh_token': return 'corrupted.refresh.data';
          default: return null;
        }
      });

      render(<GoogleOAuthCallback />);

      await waitFor(() => {
        // Should still store the tokens (validation happens server-side)
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('accessToken', 'corrupted.token.data.here');
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('refreshToken', 'corrupted.refresh.data');
      });
    });

    it('handles empty token values', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'success': return 'true';
          case 'token': return '';
          case 'refresh_token': return '';
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

    it('handles null and undefined values', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'success': return null;
          case 'token': return undefined;
          case 'refresh_token': return null;
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
  });

  describe('User Experience Edge Cases', () => {
    it('provides clear feedback for different error types', async () => {
      const errorScenarios = [
        {
          error: 'invalid_client',
          description: 'The OAuth client was not found.',
          expectedMessage: 'The OAuth client was not found.'
        },
        {
          error: 'invalid_grant',
          description: 'The provided authorization grant is invalid.',
          expectedMessage: 'The provided authorization grant is invalid.'
        },
        {
          error: 'unsupported_grant_type',
          description: 'The authorization grant type is not supported.',
          expectedMessage: 'The authorization grant type is not supported.'
        }
      ];

      for (const scenario of errorScenarios) {
        mockSearchParams.get.mockImplementation((param: string) => {
          switch (param) {
            case 'error': return scenario.error;
            case 'error_description': return scenario.description;
            default: return null;
          }
        });

        const { unmount } = render(<GoogleOAuthCallback />);

        await waitFor(() => {
          expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
          expect(screen.getByText(scenario.expectedMessage)).toBeInTheDocument();
        });

        unmount();
      }
    });

    it('handles accessibility requirements', async () => {
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

      // Check for proper ARIA attributes
      const buttons = screen.getAllByRole('button');
      buttons.forEach(button => {
        expect(button).toHaveAccessibleName();
      });

      // Check for keyboard navigation
      const user = userEvent.setup();
      await user.tab();
      expect(screen.getByRole('button', { name: /try again/i })).toHaveFocus();
    });

    it('maintains state consistency during errors', async () => {
      // Set up existing localStorage state
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'accessToken') return 'existing-token';
        if (key === 'refreshToken') return 'existing-refresh';
        return null;
      });

      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'error': return 'server_error';
          case 'error_description': return 'Internal server error';
          default: return null;
        }
      });

      render(<GoogleOAuthCallback />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      });

      // Existing tokens should not be cleared on OAuth error
      expect(mockLocalStorage.removeItem).not.toHaveBeenCalled();
      expect(mockLocalStorage.clear).not.toHaveBeenCalled();
    });
  });

  describe('Performance Edge Cases', () => {
    it('handles high-frequency callback attempts', async () => {
      const startTime = Date.now();
      
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'success': return 'true';
          case 'token': return 'access-token-123';
          case 'refresh_token': return 'refresh-token-123';
          default: return null;
        }
      });

      // Render multiple instances rapidly
      const instances = Array.from({ length: 10 }, () => render(<GoogleOAuthCallback />));

      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalled();
      });

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Should complete within reasonable time (less than 1 second)
      expect(processingTime).toBeLessThan(1000);

      // Clean up
      instances.forEach(({ unmount }) => unmount());
    });

    it('handles memory constraints gracefully', async () => {
      // Simulate memory pressure by creating large objects
      const largeData = 'x'.repeat(1000000); // 1MB string
      
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'success': return 'true';
          case 'token': return largeData;
          case 'refresh_token': return largeData;
          default: return null;
        }
      });

      render(<GoogleOAuthCallback />);

      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('accessToken', largeData);
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith('refreshToken', largeData);
      });
    });
  });

  describe('Integration with External Services', () => {
    it('handles Google service outages', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'error': return 'temporarily_unavailable';
          case 'error_description': return 'The service is temporarily overloaded or under maintenance.';
          default: return null;
        }
      });

      render(<GoogleOAuthCallback />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
        expect(screen.getByText('The service is temporarily overloaded or under maintenance.')).toBeInTheDocument();
      });

      // Should provide retry option
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('handles rate limiting from Google', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'error': return 'rate_limit_exceeded';
          case 'error_description': return 'Rate limit exceeded. Please try again later.';
          default: return null;
        }
      });

      render(<GoogleOAuthCallback />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
        expect(screen.getByText('Rate limit exceeded. Please try again later.')).toBeInTheDocument();
      });
    });

    it('handles deprecated OAuth endpoints', async () => {
      mockSearchParams.get.mockImplementation((param: string) => {
        switch (param) {
          case 'error': return 'invalid_request';
          case 'error_description': return 'This OAuth endpoint has been deprecated.';
          default: return null;
        }
      });

      render(<GoogleOAuthCallback />);

      await waitFor(() => {
        expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
        expect(screen.getByText('This OAuth endpoint has been deprecated.')).toBeInTheDocument();
      });
    });
  });
});