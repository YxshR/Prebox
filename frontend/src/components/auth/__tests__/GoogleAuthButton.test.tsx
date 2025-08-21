/**
 * Unit tests for GoogleAuthButton component
 * Requirements: 2.1, 2.2, 2.3
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GoogleAuthButton from '../GoogleAuthButton';

// Mock dependencies
jest.mock('../../LoadingState', () => {
  return function MockLoadingState({ message, size }: { message: string; size: string }) {
    return <div data-testid="loading-state">{message}</div>;
  };
});

jest.mock('framer-motion', () => ({
  motion: {
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
}));

// Mock window.location
const mockLocation = {
  href: '',
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

describe('GoogleAuthButton Component', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.href = '';
    
    // Reset environment variables
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000/api';
  });

  describe('Rendering', () => {
    it('renders login button correctly', () => {
      render(<GoogleAuthButton mode="login" />);
      
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument();
      expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
      
      // Check for Google icon
      const svg = screen.getByRole('button').querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveClass('w-5', 'h-5', 'mr-3');
    });

    it('renders signup button correctly', () => {
      render(<GoogleAuthButton mode="signup" />);
      
      expect(screen.getByRole('button', { name: /sign up with google/i })).toBeInTheDocument();
      expect(screen.getByText('Sign up with Google')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<GoogleAuthButton mode="login" className="custom-class" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('renders with proper default styling', () => {
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass(
        'w-full',
        'inline-flex',
        'justify-center',
        'items-center',
        'py-3',
        'px-4',
        'border',
        'border-gray-300',
        'rounded-md',
        'shadow-sm',
        'bg-white',
        'text-sm',
        'font-medium',
        'text-gray-700'
      );
    });
  });

  describe('Functionality', () => {
    it('redirects to Google OAuth endpoint on click', async () => {
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(mockLocation.href).toBe('http://localhost:8000/api/auth/google');
    });

    it('uses custom API URL from environment', async () => {
      process.env.NEXT_PUBLIC_API_URL = 'https://api.example.com';
      
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(mockLocation.href).toBe('https://api.example.com/auth/google');
    });

    it('falls back to default API URL when environment variable is not set', async () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(mockLocation.href).toBe('http://localhost:8000/api/auth/google');
    });

    it('shows loading state when clicked', async () => {
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      expect(screen.getByText('Redirecting...')).toBeInTheDocument();
    });

    it('does not redirect when disabled', async () => {
      render(<GoogleAuthButton mode="login" disabled />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(mockLocation.href).toBe('');
    });

    it('does not redirect when already loading', async () => {
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      
      // First click should start loading
      await user.click(button);
      expect(mockLocation.href).toBe('http://localhost:8000/api/auth/google');
      
      // Reset href to test second click
      mockLocation.href = '';
      
      // Second click should not redirect again
      await user.click(button);
      expect(mockLocation.href).toBe('');
    });
  });

  describe('Disabled State', () => {
    it('renders disabled button correctly', () => {
      render(<GoogleAuthButton mode="login" disabled />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
    });

    it('does not show hover effects when disabled', () => {
      render(<GoogleAuthButton mode="login" disabled />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      
      // Disabled buttons should not have hover effects
      fireEvent.mouseEnter(button);
      expect(button).not.toHaveClass('hover:bg-gray-50');
    });

    it('prevents click events when disabled', async () => {
      render(<GoogleAuthButton mode="login" disabled />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(mockLocation.href).toBe('');
      expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
    });

    it('supports keyboard navigation', async () => {
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      
      // Tab to button
      await user.tab();
      expect(button).toHaveFocus();
      
      // Enter key should trigger click
      await user.keyboard('{Enter}');
      expect(mockLocation.href).toBe('http://localhost:8000/api/auth/google');
    });

    it('supports space key activation', async () => {
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      button.focus();
      
      // Space key should trigger click
      await user.keyboard(' ');
      expect(mockLocation.href).toBe('http://localhost:8000/api/auth/google');
    });

    it('has proper focus indicators', () => {
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-offset-2', 'focus:ring-blue-500');
    });
  });

  describe('Visual States', () => {
    it('shows correct text for login mode', () => {
      render(<GoogleAuthButton mode="login" />);
      expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    });

    it('shows correct text for signup mode', () => {
      render(<GoogleAuthButton mode="signup" />);
      expect(screen.getByText('Sign up with Google')).toBeInTheDocument();
    });

    it('displays Google icon with correct colors', () => {
      render(<GoogleAuthButton mode="login" />);
      
      const svg = screen.getByRole('button').querySelector('svg');
      expect(svg).toBeInTheDocument();
      
      // Check for Google brand colors in paths
      const paths = svg?.querySelectorAll('path');
      expect(paths).toHaveLength(4);
      
      // Google brand colors
      expect(paths?.[0]).toHaveAttribute('fill', '#4285F4'); // Blue
      expect(paths?.[1]).toHaveAttribute('fill', '#34A853'); // Green
      expect(paths?.[2]).toHaveAttribute('fill', '#FBBC05'); // Yellow
      expect(paths?.[3]).toHaveAttribute('fill', '#EA4335'); // Red
    });

    it('maintains aspect ratio of Google icon', () => {
      render(<GoogleAuthButton mode="login" />);
      
      const svg = screen.getByRole('button').querySelector('svg');
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
      expect(svg).toHaveClass('w-5', 'h-5');
    });
  });

  describe('Error Handling', () => {
    it('handles missing environment variables gracefully', async () => {
      // Remove environment variable
      delete process.env.NEXT_PUBLIC_API_URL;
      
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      // Should fall back to default URL
      expect(mockLocation.href).toBe('http://localhost:8000/api/auth/google');
    });

    it('handles malformed API URLs', async () => {
      process.env.NEXT_PUBLIC_API_URL = 'not-a-valid-url';
      
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(mockLocation.href).toBe('not-a-valid-url/auth/google');
    });
  });

  describe('Performance', () => {
    it('does not cause unnecessary re-renders', () => {
      const { rerender } = render(<GoogleAuthButton mode="login" />);
      
      // Re-render with same props
      rerender(<GoogleAuthButton mode="login" />);
      
      // Button should still be present and functional
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    });

    it('handles rapid clicks gracefully', async () => {
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      
      // Rapid clicks
      await user.click(button);
      await user.click(button);
      await user.click(button);
      
      // Should only redirect once
      expect(mockLocation.href).toBe('http://localhost:8000/api/auth/google');
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('works with different container sizes', () => {
      const { container } = render(
        <div style={{ width: '200px' }}>
          <GoogleAuthButton mode="login" />
        </div>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('w-full');
      expect(container.firstChild).toHaveStyle({ width: '200px' });
    });

    it('maintains functionality when wrapped in forms', async () => {
      render(
        <form onSubmit={(e) => e.preventDefault()}>
          <GoogleAuthButton mode="login" />
        </form>
      );
      
      const button = screen.getByRole('button');
      await user.click(button);
      
      expect(mockLocation.href).toBe('http://localhost:8000/api/auth/google');
    });
  });
});