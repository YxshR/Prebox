import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PhoneVerification from '../PhoneVerification';
import { authApi } from '../../../lib/auth';

// Mock the auth API
jest.mock('../../../lib/auth', () => ({
  authApi: {
    verifyOTP: jest.fn(),
    verifyOTPWithAuth: jest.fn(),
    resendOTP: jest.fn(),
  },
}));

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    input: ({ children, ...props }: any) => <input {...props}>{children}</input>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

const mockProps = {
  otpId: 'test-otp-id',
  phone: '+91 98765 43210',
  onSuccess: jest.fn(),
  onResend: jest.fn(),
};

describe('PhoneVerification Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders phone verification form correctly', () => {
    render(<PhoneVerification {...mockProps} />);
    
    expect(screen.getByText('Verify Phone Number')).toBeInTheDocument();
    expect(screen.getByText('+91 98765 43210')).toBeInTheDocument();
    expect(screen.getByText('Verify Phone Number')).toBeInTheDocument();
  });

  it('shows security indicator when enableAuthentication is true', () => {
    render(<PhoneVerification {...mockProps} enableAuthentication={true} />);
    
    expect(screen.getByText('🔒 Secure authentication enabled')).toBeInTheDocument();
  });

  it('handles OTP input correctly', () => {
    render(<PhoneVerification {...mockProps} />);
    
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(6);
    
    // Test input validation - only allows digits
    fireEvent.change(inputs[0], { target: { value: 'a' } });
    expect(inputs[0]).toHaveValue('');
    
    fireEvent.change(inputs[0], { target: { value: '1' } });
    expect(inputs[0]).toHaveValue('1');
  });

  it('calls verifyOTP when standard verification is used', async () => {
    const mockVerifyOTP = authApi.verifyOTP as jest.Mock;
    mockVerifyOTP.mockResolvedValue({ verified: true });

    render(<PhoneVerification {...mockProps} />);
    
    const inputs = screen.getAllByRole('textbox');
    
    // Fill all OTP inputs
    inputs.forEach((input, index) => {
      fireEvent.change(input, { target: { value: (index + 1).toString() } });
    });

    await waitFor(() => {
      expect(mockVerifyOTP).toHaveBeenCalledWith('test-otp-id', '123456');
    });
  });

  it('calls verifyOTPWithAuth when authentication is enabled', async () => {
    const mockVerifyOTPWithAuth = authApi.verifyOTPWithAuth as jest.Mock;
    mockVerifyOTPWithAuth.mockResolvedValue({
      accessToken: 'test-token',
      refreshToken: 'test-refresh',
      user: { id: 'user-1', email: 'test@example.com' }
    });

    render(<PhoneVerification {...mockProps} enableAuthentication={true} />);
    
    const inputs = screen.getAllByRole('textbox');
    
    // Fill all OTP inputs
    inputs.forEach((input, index) => {
      fireEvent.change(input, { target: { value: (index + 1).toString() } });
    });

    await waitFor(() => {
      expect(mockVerifyOTPWithAuth).toHaveBeenCalledWith('test-otp-id', '123456');
    });
  });

  it('handles resend OTP correctly', async () => {
    const mockResendOTP = authApi.resendOTP as jest.Mock;
    mockResendOTP.mockResolvedValue({ otpId: 'new-otp-id' });

    render(<PhoneVerification {...mockProps} />);
    
    // Wait for countdown to finish (mocked)
    const resendButton = screen.getByText('Resend Code');
    fireEvent.click(resendButton);

    await waitFor(() => {
      expect(mockResendOTP).toHaveBeenCalledWith('test-otp-id');
      expect(mockProps.onResend).toHaveBeenCalledWith('new-otp-id');
    });
  });

  it('shows security feedback for invalid attempts', async () => {
    const mockVerifyOTP = authApi.verifyOTP as jest.Mock;
    mockVerifyOTP.mockRejectedValue(new Error('Invalid verification code'));

    render(<PhoneVerification {...mockProps} maxAttempts={3} />);
    
    const inputs = screen.getAllByRole('textbox');
    
    // Fill all OTP inputs with invalid code
    inputs.forEach((input, index) => {
      fireEvent.change(input, { target: { value: '0' } });
    });

    await waitFor(() => {
      expect(screen.getByText(/attempt.*remaining/i)).toBeInTheDocument();
    });
  });
});