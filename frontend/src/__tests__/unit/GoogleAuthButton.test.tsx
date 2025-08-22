import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GoogleAuthButton from '../../components/auth/GoogleAuthButton';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    button: React.forwardRef<HTMLButtonElement, any>(({ children, ...props }, ref) => (
      <button ref={ref} {...props}>
        {children}
      </button>
    ))
  }
}));

// Mock LoadingState component
jest.mock('../../components/LoadingState', () => {
  return function MockLoadingState({ message, size }: { message: string; size: string }) {
    return <div data-testid="loading-state">{message} ({size})</div>;
  };
});

// Mock window.location
const mockLocation = {
  href: ''
};
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true
});

describe('GoogleAuthButton', () => {
  beforeEach(() => {
    mockLocation.href = '';
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:8000/api';
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  describe('rendering', () => {
    it('should render login button correctly', () => {
      render(<GoogleAuthButton mode="login" />);
      
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    });

    it('should render signup button correctly', () => {
      render(<GoogleAuthButton mode="signup" />);
      
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByText('Sign up with Google')).toBeInTheDocument();
    });

    it('should render Google icon', () => {
      render(<GoogleAuthButton mode="login" />);
      
      const svg = screen.getByRole('button').querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    });

    it('should apply custom className', () => {
      render(<GoogleAuthButton mode="login" className="custom-class" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('should be disabled when disabled prop is true', () => {
      render(<GoogleAuthButton mode="login" disabled />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
    });
  });

  describe('functionality', () => {
    it('should redirect to Google OAuth on click', () => {
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(mockLocation.href).toBe('http://localhost:8000/api/auth/google');
    });

    it('should use default API URL when environment variable is not set', () => {
      delete process.env.NEXT_PUBLIC_API_URL;
      
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(mockLocation.href).toBe('http://localhost:8000/api/auth/google');
    });

    it('should show loading state after click', async () => {
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toBeInTheDocument();
        expect(screen.getByText('Redirecting... (small)')).toBeInTheDocument();
      });
    });

    it('should not redirect when disabled', () => {
      render(<GoogleAuthButton mode="login" disabled />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(mockLocation.href).toBe('');
    });

    it('should not redirect when already loading', async () => {
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      
      // First click
      fireEvent.click(button);
      const firstHref = mockLocation.href;
      
      // Reset href to test second click
      mockLocation.href = '';
      
      // Second click while loading
      fireEvent.click(button);
      
      expect(mockLocation.href).toBe('');
      expect(firstHref).toBe('http://localhost:8000/api/auth/google');
    });
  });

  describe('accessibility', () => {
    it('should have proper button role', () => {
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('should be focusable when not disabled', () => {
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      button.focus();
      
      expect(button).toHaveFocus();
    });

    it('should not be focusable when disabled', () => {
      render(<GoogleAuthButton mode="login" disabled />);
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should have proper focus styles', () => {
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-offset-2', 'focus:ring-blue-500');
    });
  });

  describe('styling', () => {
    it('should have correct base styles', () => {
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

    it('should have hover styles', () => {
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('hover:bg-gray-50');
    });

    it('should have transition styles', () => {
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('transition-colors', 'duration-200');
    });

    it('should have disabled styles when disabled', () => {
      render(<GoogleAuthButton mode="login" disabled />);
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
    });
  });

  describe('Google icon', () => {
    it('should render all Google icon paths', () => {
      render(<GoogleAuthButton mode="login" />);
      
      const svg = screen.getByRole('button').querySelector('svg');
      const paths = svg?.querySelectorAll('path');
      
      expect(paths).toHaveLength(4);
      
      // Check for Google brand colors
      expect(paths?.[0]).toHaveAttribute('fill', '#4285F4'); // Blue
      expect(paths?.[1]).toHaveAttribute('fill', '#34A853'); // Green
      expect(paths?.[2]).toHaveAttribute('fill', '#FBBC05'); // Yellow
      expect(paths?.[3]).toHaveAttribute('fill', '#EA4335'); // Red
    });

    it('should have correct icon size', () => {
      render(<GoogleAuthButton mode="login" />);
      
      const svg = screen.getByRole('button').querySelector('svg');
      expect(svg).toHaveClass('w-5', 'h-5', 'mr-3');
    });
  });

  describe('loading state', () => {
    it('should show loading component when loading', async () => {
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      });
    });

    it('should hide Google icon when loading', async () => {
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      await waitFor(() => {
        const svg = button.querySelector('svg');
        expect(svg).not.toBeInTheDocument();
      });
    });

    it('should hide button text when loading', async () => {
      render(<GoogleAuthButton mode="login" />);
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      await waitFor(() => {
        expect(screen.queryByText('Sign in with Google')).not.toBeInTheDocument();
      });
    });
  });

  describe('mode variations', () => {
    it('should show correct text for login mode', () => {
      render(<GoogleAuthButton mode="login" />);
      
      expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    });

    it('should show correct text for signup mode', () => {
      render(<GoogleAuthButton mode="signup" />);
      
      expect(screen.getByText('Sign up with Google')).toBeInTheDocument();
    });
  });
});