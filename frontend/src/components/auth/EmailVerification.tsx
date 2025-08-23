'use client';

import React, { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface EmailVerificationProps {
  onEmailSubmit: (email: string) => void;
  onCodeVerify: (code: string) => void;
  onResendCode: () => void;
  loading: boolean;
  error: string | null;
  showCodeInput: boolean;
  onBack: () => void;
}

export function EmailVerification({
  onEmailSubmit,
  onCodeVerify,
  onResendCode,
  loading,
  error,
  showCodeInput,
  onBack
}: EmailVerificationProps) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onEmailSubmit(email);
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCodeVerify(code);
  };

  if (showCodeInput) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Email</h2>
          <p className="text-gray-600">
            We sent a verification code to <strong>{email}</strong>
          </p>
        </div>

        <form onSubmit={handleCodeSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Verification Code
            </label>
            <Input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
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
            onClick={onResendCode}
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Email</h2>
        <p className="text-gray-600">Enter your email address to receive a verification code</p>
      </div>

      <form onSubmit={handleEmailSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
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