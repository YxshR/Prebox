'use client';

import React, { useState, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface EmailVerificationStepProps {
  onVerified: (email: string) => void;
  onBack: () => void;
  onError: (error: string) => void;
  onLoading: (loading: boolean) => void;
  loading: boolean;
  error: string | null;
}

export function EmailVerificationStep({
  onVerified,
  onBack,
  onError,
  onLoading,
  loading,
  error,
}: EmailVerificationStepProps) {
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [codeSent, setCodeSent] = useState(false);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleEmailSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) {
      onError('Please enter a valid email address');
      return;
    }

    onLoading(true);
    onError('');

    try {
      // API call to start email verification
      const response = await fetch('/api/auth/signup/email/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          onError('This email address is already registered. Please use a different email or try logging in.');
        } else {
          onError(data.message || 'Failed to send verification email');
        }
        return;
      }

      setCodeSent(true);
      setShowCodeInput(true);
      onError('');
    } catch (err) {
      onError('Network error. Please check your connection and try again.');
    } finally {
      onLoading(false);
    }
  }, [email, onError, onLoading]);

  const handleCodeSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (verificationCode.length !== 6) {
      onError('Please enter the complete 6-digit verification code');
      return;
    }

    onLoading(true);
    onError('');

    try {
      // API call to verify email code
      const response = await fetch('/api/auth/signup/email/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          email, 
          code: verificationCode 
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        onError(data.message || 'Invalid verification code');
        return;
      }

      // Email verification successful
      onVerified(email);
    } catch (err) {
      onError('Network error. Please check your connection and try again.');
    } finally {
      onLoading(false);
    }
  }, [email, verificationCode, onError, onLoading, onVerified]);

  const handleResendCode = useCallback(async () => {
    onLoading(true);
    onError('');

    try {
      const response = await fetch('/api/auth/signup/email/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        onError(data.message || 'Failed to resend verification email');
        return;
      }

      setVerificationCode('');
      onError('');
    } catch (err) {
      onError('Network error. Please check your connection and try again.');
    } finally {
      onLoading(false);
    }
  }, [email, onError, onLoading]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setVerificationCode(value);
  };

  if (showCodeInput) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Email</h2>
          <p className="text-gray-600">
            We sent a 6-digit code to <strong>{email}</strong>
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Check your inbox and spam folder
          </p>
        </div>

        <form onSubmit={handleCodeSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Verification Code
            </label>
            <Input
              type="text"
              value={verificationCode}
              onChange={handleCodeChange}
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
                setShowCodeInput(false);
                setCodeSent(false);
                setVerificationCode('');
                onError('');
              }}
              className="flex-1"
              disabled={loading}
            >
              Change Email
            </Button>
            <Button
              type="submit"
              loading={loading}
              className="flex-1"
              disabled={verificationCode.length !== 6}
            >
              Verify Code
            </Button>
          </div>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={handleResendCode}
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Enter Your Email</h2>
        <p className="text-gray-600">
          We'll send you a verification code to confirm your email address
        </p>
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
            autoComplete="email"
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
            disabled={loading}
          >
            Back
          </Button>
          <Button
            type="submit"
            loading={loading}
            className="flex-1"
            disabled={!validateEmail(email)}
          >
            Send Code
          </Button>
        </div>
      </form>
    </div>
  );
}