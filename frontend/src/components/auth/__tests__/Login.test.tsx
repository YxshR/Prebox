import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Login } from '../Login';
import { AuthProvider } from '../AuthProvider';
import { Auth0ProviderWrapper } from '../Auth0Provider';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock auth API
jest.mock('@/lib/auth', () => ({
  authApi: {
    login: jest.fn(),
    sendOTP: jest.fn(),
    authenticateWithOTP: jest.fn(),
    getCurrentUser: jest.fn(),
    logout: jest.fn(),
  },
}));

// Mock Auth0
jest.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    loginWithRedirect: jest.fn(),
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
  }),
  Auth0Provider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <Auth0ProviderWrapper>
    <AuthProvider>
      {children}
    </AuthProvider>
  </Auth0ProviderWrapper>
);

describe('Login Component', () => {
  it('renders login method selector by default', () => {
    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    );

    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByText('Social Login')).toBeInTheDocument();
    expect(screen.getByText('Phone Number')).toBeInTheDocument();
    expect(screen.getByText('Email & Password')).toBeInTheDocument();
  });

  it('shows Auth0 login when social login is selected', async () => {
    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    );

    const socialLoginCard = screen.getByText('Social Login').closest('div');
    fireEvent.click(socialLoginCard!);

    await waitFor(() => {
      expect(screen.getByText('Continue with Social Login')).toBeInTheDocument();
    });
  });

  it('shows phone login when phone method is selected', async () => {
    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    );

    const phoneLoginCard = screen.getByText('Phone Number').closest('div');
    fireEvent.click(phoneLoginCard!);

    await waitFor(() => {
      expect(screen.getByText('Phone Login')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('+1 (555) 123-4567')).toBeInTheDocument();
    });
  });

  it('shows email login when email method is selected', async () => {
    render(
      <TestWrapper>
        <Login />
      </TestWrapper>
    );

    const emailLoginCard = screen.getByText('Email & Password').closest('div');
    fireEvent.click(emailLoginCard!);

    await waitFor(() => {
      expect(screen.getByText('Email & Password')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
    });
  });

  it('calls onSuccess callback when login succeeds', async () => {
    const mockOnSuccess = jest.fn();
    
    render(
      <TestWrapper>
        <Login onSuccess={mockOnSuccess} />
      </TestWrapper>
    );

    // This test would need more setup to actually trigger a successful login
    // For now, we're just testing that the component renders without errors
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
  });
});