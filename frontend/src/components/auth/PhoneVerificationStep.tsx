'use client';

import React, { useState, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface PhoneVerificationStepProps {
  onVerified: (phone: string) => void;
  onBack: () => void;
  onError: (error: string) => void;
  onLoading: (loading: boolean) => void;
  loading: boolean;
  error: string | null;
}

export function PhoneVerificationStep({
  onVerified,
  onBack,
  onError,
  onLoading,
  loading,
  error,
}: PhoneVerificationStepProps) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

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
      // API call to start phone verification
      const response = await fetch('/api/auth/signup/phone/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: phone.replace(/\D/g, '') }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          onError('This phone number is already registered. Please use a different number or try logging in.');
        } else {
          onError(data.message || 'Failed to send verification code');
        }
        return;
      }

      setOtpSent(true);
      setShowOtpInput(true);
      onError('');
    } catch (err) {
      onError('Network error. Please check your connection and try again.');
    } finally {
      onLoading(false);
    }
  }, [phone, onError, onLoading]);

  const handleOtpSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otp.length !== 6) {
      onError('Please enter the complete 6-digit verification code');
      return;
    }

    onLoading(true);
    onError('');

    try {
      // API call to verify OTP
      const response = await fetch('/api/auth/signup/phone/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          phone: phone.replace(/\D/g, ''), 
          otp 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        onError(data.message || 'Invalid verification code');
        return;
      }

      // Phone verification successful
      onVerified(phone.replace(/\D/g, ''));
    } catch (err) {
      onError('Network error. Please check your connection and try again.');
    } finally {
      onLoading(false);
    }
  }, [phone, otp, onError, onLoading, onVerified]);

  const handleResendOtp = useCallback(async () => {
    onLoading(true);
    onError('');

    try {
      const response = await fetch('/api/auth/signup/phone/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone: phone.replace(/\D/g, '') }),
      });

      const data = await response.json();

      if (!response.ok) {
        onError(data.message || 'Failed to resend verification code');
        return;
      }

      setOtp('');
      onError('');
    } catch (err) {
      onError('Network error. Please check your connection and try again.');
    } finally {
      onLoading(false);
    }
  }, [phone, onError, onLoading]);

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
                setOtpSent(false);
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Enter Your Phone Number</h2>
        <p className="text-gray-600">
          We'll send you a verification code to confirm your number
        </p>
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