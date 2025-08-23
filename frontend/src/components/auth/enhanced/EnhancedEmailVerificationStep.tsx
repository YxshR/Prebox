'use client';

import React, { useState, useCallback } from 'react';
import { FormField } from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { validateEmail, validateOTP } from '@/lib/validation';
import { enhancedFormSubmit } from '@/lib/enhancedRetry';
import { parseConstraintError, isConstraintError, formatConstraintErrorForDisplay } from '@/lib/constraintErrorHandler';

interface EnhancedEmailVerificationStepProps {
  onVerified: (email: string) => void;
  onBack: () => void;
  onError: (error: string) => void;
  onLoading: (loading: boolean) => void;
  loading: boolean;
  error: string | null;
}

export function EnhancedEmailVerificationStep({
  onVerified,
  onBack,
  onError,
  onLoading,
  loading,
  error,
}: EnhancedEmailVerificationStepProps) {
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showCodeInput, setShowCodeInput] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [codeError, setCodeError] = useState('');
  const [constraintError, setConstraintError] = useState<any>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleEmailValidation = useCallback((isValid: boolean, error?: string) => {
    setEmailError(error || '');
  }, []);

  const handleCodeValidation = useCallback((isValid: boolean, error?: string) => {
    setCodeError(error || '');
  }, []);

  const handleEmailSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.error || 'Invalid email address');
      return;
    }

    onLoading(true);
    onError('');
    setConstraintError(null);

    try {
      await enhancedFormSubmit(
        async () => {
          const response = await fetch('/api/auth/signup/email/start', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: email.trim().toLowerCase() }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            const error = new Error(errorData.message || 'Failed to send verification email');
            (error as any).response = response;
            (error as any).data = errorData;
            throw error;
          }

          return response.json();
        },
        {
          onConstraintError: (error) => {
            const constraintErr = parseConstraintError(error);
            setConstraintError(constraintErr);
            const displayError = formatConstraintErrorForDisplay(constraintErr);
            onError(displayError.message);
          },
          onValidationError: (error) => {
            const errorData = error.response?.data || error.data;
            setEmailError(errorData?.message || 'Please check your email address format');
          },
          onNetworkError: (error) => {
            onError('Network error. Please check your connection and try again.');
          }
        }
      );

      // Success
      setShowCodeInput(true);
      setRetryCount(0);
      onError('');
    } catch (err: any) {
      // Final error handling if not caught by enhancedFormSubmit
      if (!isConstraintError(err)) {
        onError('Failed to send verification email. Please try again.');
      }
    } finally {
      onLoading(false);
    }
  }, [email, onError, onLoading]);

  const handleCodeSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate verification code
    const codeValidation = validateOTP(verificationCode);
    if (!codeValidation.isValid) {
      setCodeError(codeValidation.error || 'Invalid verification code');
      return;
    }

    onLoading(true);
    onError('');

    try {
      await enhancedFormSubmit(
        async () => {
          const response = await fetch('/api/auth/signup/email/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              email: email.trim().toLowerCase(), 
              code: verificationCode.trim()
            }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            const error = new Error(errorData.message || 'Invalid verification code');
            (error as any).response = response;
            (error as any).data = errorData;
            throw error;
          }

          return response.json();
        },
        {
          onValidationError: (error) => {
            const errorData = error.response?.data || error.data;
            setCodeError(errorData?.message || 'Invalid verification code');
          },
          onNetworkError: (error) => {
            onError('Network error. Please check your connection and try again.');
          }
        }
      );

      // Success
      onVerified(email.trim().toLowerCase());
    } catch (err: any) {
      if (err.response?.status === 400) {
        setCodeError('Invalid verification code. Please try again.');
      } else {
        onError('Email verification failed. Please try again.');
      }
    } finally {
      onLoading(false);
    }
  }, [email, verificationCode, onError, onLoading, onVerified]);

  const handleResendCode = useCallback(async () => {
    onLoading(true);
    onError('');
    setRetryCount(prev => prev + 1);

    try {
      await enhancedFormSubmit(
        async () => {
          const response = await fetch('/api/auth/signup/email/start', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: email.trim().toLowerCase() }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            const error = new Error(errorData.message || 'Failed to resend verification email');
            (error as any).response = response;
            (error as any).data = errorData;
            throw error;
          }

          return response.json();
        },
        {
          onNetworkError: (error) => {
            onError('Network error. Please check your connection and try again.');
          }
        }
      );

      setVerificationCode('');
      setCodeError('');
      onError('');
    } catch (err: any) {
      onError('Failed to resend verification email. Please try again.');
    } finally {
      onLoading(false);
    }
  }, [email, onError, onLoading]);

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
          <FormField
            label="Verification Code"
            type="text"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Enter 6-digit code"
            maxLength={6}
            className="text-center text-lg tracking-widest"
            required
            autoComplete="one-time-code"
            error={codeError}
            validation={{
              required: true,
              custom: (value) => validateOTP(value)
            }}
            onValidationChange={handleCodeValidation}
          />

          {error && (
            <ErrorDisplay
              error={{ message: error }}
              className="w-full"
            />
          )}

          <div className="flex space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCodeInput(false);
                setVerificationCode('');
                setCodeError('');
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
              disabled={verificationCode.length !== 6 || Boolean(codeError)}
            >
              Verify Code
            </Button>
          </div>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={handleResendCode}
            disabled={loading || retryCount >= 3}
            className="text-sm text-blue-600 hover:text-blue-500 disabled:opacity-50 transition-colors"
          >
            {retryCount >= 3 
              ? 'Maximum resend attempts reached' 
              : "Didn't receive the code? Resend"
            }
          </button>
          {retryCount > 0 && retryCount < 3 && (
            <p className="text-xs text-gray-500 mt-1">
              Resent {retryCount} time{retryCount > 1 ? 's' : ''}
            </p>
          )}
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
        <FormField
          label="Email Address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter your email address"
          required
          autoComplete="email"
          error={emailError}
          helperText="We'll never share your email with anyone else"
          validation={{
            required: true,
            custom: (value) => validateEmail(value)
          }}
          onValidationChange={handleEmailValidation}
        />

        {constraintError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <svg className="w-5 h-5 text-yellow-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Email Already Registered
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>{constraintError.userMessage}</p>
                  {constraintError.suggestions && (
                    <ul className="mt-2 list-disc list-inside space-y-1">
                      {constraintError.suggestions.map((suggestion: string, index: number) => (
                        <li key={index}>{suggestion}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {error && !constraintError && (
          <ErrorDisplay
            error={{ message: error }}
            className="w-full"
          />
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
            disabled={Boolean(emailError) || !email.trim()}
          >
            Send Code
          </Button>
        </div>
      </form>
    </div>
  );
}