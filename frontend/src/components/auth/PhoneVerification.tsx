'use client';

import React, { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface PhoneVerificationProps {
  onPhoneSubmit: (phone: string) => void;
  onOtpVerify: (otp: string) => void;
  onResendOtp: () => void;
  loading: boolean;
  error: string | null;
  showOtpInput: boolean;
  onBack: () => void;
}

export function PhoneVerification({
  onPhoneSubmit,
  onOtpVerify,
  onResendOtp,
  loading,
  error,
  showOtpInput,
  onBack
}: PhoneVerificationProps) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');

  const handlePhoneSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onPhoneSubmit(phone);
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onOtpVerify(otp);
  };

  if (showOtpInput) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Phone</h2>
          <p className="text-gray-600">
            We sent a verification code to <strong>{phone}</strong>
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
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Enter 6-digit code"
              maxLength={6}
              required
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
              onClick={onBack}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              type="submit"
              loading={loading}
              className="flex-1"
            >
              Verify
            </Button>
          </div>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={onResendOtp}
            disabled={loading}
            className="text-sm text-blue-600 hover:text-blue-500 disabled:opacity-50"
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Phone</h2>
        <p className="text-gray-600">Enter your phone number to receive a verification code</p>
      </div>

      <form onSubmit={handlePhoneSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Phone Number
          </label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 123-4567"
            required
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
            onClick={onBack}
            className="flex-1"
          >
            Back
          </Button>
          <Button
            type="submit"
            loading={loading}
            className="flex-1"
          >
            Send Code
          </Button>
        </div>
      </form>
    </div>
  );
}