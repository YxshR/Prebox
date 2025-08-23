'use client';

import React, { useState, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { authApi } from '@/lib/auth';

interface PhoneVerificationForAuth0Props {
  onVerified: (phone: string) => void;
  onBack: () => void;
  onError: (error: string) => void;
  onLoading: (loading: boolean) => void;
  loading: boolean;
  error: string | null;
  auth0User: any;
}

export function PhoneVerificationForAuth0({
  onVerified,
  onBack,
  onError,
  onLoading,
  loading,
  error,
  auth0User,
}: PhoneVerificationForAuth0Props) {
  const { getAccessTokenSilently } = useAuth0();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpId, setOtpId] = useState<string | null>(null);

  const formatPhoneNumber = (value: string): string => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const validatePhoneNumber = (phone: string): boolean => {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10;
  };

  const handlePhoneSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validatePhoneNumber(phone)) {
      onError('Please enter a valid 10-digit phone number');
      return;
    }

    onLoading(true);
    onError('');

    try {
      // Get Auth0 access token
      const token = await getAccessTokenSilently();
      
      // Send OTP using our auth API with Auth0 user context
      const response = await authApi.sendOTP(
        auth0User.sub, // Auth0 user ID
        phone.replace(/\D/g, ''), 
        'auth0_phone_verification'
      );

      setOtpId(response.otpId);
      setShowOtpInput(true);
      onError('');
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('already registered')) {
          onError('This phone number is already registered. Please use a different number.');
        } else {
          onError(err.message);
        }
      } else {
        onError('Failed to send verification code. Please try again.');
      }
    } finally {
      onLoading(false);
    }
  }, [phone, onError, onLoading, getAccessTokenSilently, auth0User]);

  const handleOtpSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otp.length !== 6) {
      onError('Please enter the complete 6-digit verification code');
      return;
    }

    if (!otpId) {
      onError('Invalid verification session. Please try again.');
      return;
    }

    onLoading(true);
    onError('');

    try {
      // Verify OTP using our auth API
      const response = await authApi.verifyOTP(otpId, otp);

      if (response.verified) {
        // Update Auth0 user metadata with verified phone
        const token = await getAccessTokenSilently();
        
        // Call our backend to update user phone verification status
        await fetch('/api/auth/auth0/update-phone', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ 
            phone: phone.replace(/\D/g, ''),
            verified: true 
          }),
        });

        // Phone verification successful
        onVerified(phone.replace(/\D/g, ''));
      } else {
        onError('Invalid verification code. Please try again.');
      }
    } catch (err) {
      if (err instanceof Error) {
        onError(err.message);
      } else {
        onError('Verification failed. Please try again.');
      }
    } finally {
      onLoading(false);
    }
  }, [phone, otp, otpId, onError, onLoading, onVerified, getAccessTokenSilently]);

  const handleResendOtp = useCallback(async () => {
    if (!otpId) return;

    onLoading(true);
    onError('');

    try {
      const response = await authApi.resendOTP(otpId);
      setOtpId(response.otpId);
      setOtp('');
      onError('');
    } catch (err) {
      if (err instanceof Error) {
        onError(err.message);
      } else {
        onError('Failed to resend verification code. Please try again.');
      }
    } finally {
      onLoading(false);
    }
  }, [otpId, onError, onLoading]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhone(formatted);
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(value);
  };

  if (showOtpInput) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Phone</h2>
          <p className="text-gray-600">
            We sent a 6-digit code to <strong>{phone}</strong>
          </p>
          <p className="text-sm text-gray-500 mt-2">
            This will complete your Auth0 account setup
          </p>
        </div>

        <form onSubmit={handleOtpSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Verification Code
            </label>
            <Input
              type="text"
              value={otp}
              onChange={handleOtpChange}
              placeholder="Enter 6-digit code"
              maxLength={6}
              className="text-center text-lg tracking-widest"
              required
              autoComplete="one-time-code"
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowOtpInput(false);
                setOtpId(null);
                setOtp('');
                onError('');
              }}
              className="flex-1"
              disabled={loading}
            >
              Change Number
            </Button>
            <Button
              type="submit"
              loading={loading}
              className="flex-1"
              disabled={otp.length !== 6}
            >
              Verify Code
            </Button>
          </div>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={handleResendOtp}
            disabled={loading}
            className="text-sm text-blue-600 hover:text-blue-500 disabled:opacity-50 transition-colors"
          >
            Didn't receive the code? Resend
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Add Your Phone Number</h2>
        <p className="text-gray-600">
          Complete your Auth0 account by verifying your phone number
        </p>
        {auth0User && (
          <p className="text-sm text-gray-500 mt-2">
            Signed in as: {auth0User.email || auth0User.name}
          </p>
        )}
      </div>

      <form onSubmit={handlePhoneSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <Input
            type="tel"
            value={phone}
            onChange={handlePhoneChange}
            placeholder="(555) 123-4567"
            required
            autoComplete="tel"
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter a US phone number (10 digits)
          </p>
        </div>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
            {error}
          </div>
        )}

        <div className="flex space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="flex-1"
            disabled={loading}
          >
            Back
          </Button>
          <Button
            type="submit"
            loading={loading}
            className="flex-1"
            disabled={!validatePhoneNumber(phone)}
          >
            Send Code
          </Button>
        </div>
      </form>
    </div>
  );
}