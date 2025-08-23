'use client';

import React, { useState, useCallback } from 'react';
import { FormField } from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { validatePhone, validateOTP, normalizePhone, formatPhoneForDisplay } from '@/lib/validation';
import { enhancedFormSubmit } from '@/lib/enhancedRetry';
import { parseConstraintError, isConstraintError, formatConstraintErrorForDisplay } from '@/lib/constraintErrorHandler';

interface EnhancedPhoneVerificationStepProps {
  onVerified: (phone: string) => void;
  onBack: () => void;
  onError: (error: string) => void;
  onLoading: (loading: boolean) => void;
  loading: boolean;
  error: string | null;
}

export function EnhancedPhoneVerificationStep({
  onVerified,
  onBack,
  onError,
  onLoading,
  loading,
  error,
}: EnhancedPhoneVerificationStepProps) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [otpError, setOtpError] = useState('');
  const [constraintError, setConstraintError] = useState<any>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handlePhoneValidation = useCallback((isValid: boolean, error?: string) => {
    setPhoneError(error || '');
  }, []);

  const handleOtpValidation = useCallback((isValid: boolean, error?: string) => {
    setOtpError(error || '');
  }, []);

  const handlePhoneSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate phone number
    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.isValid) {
      setPhoneError(phoneValidation.error || 'Invalid phone number');
      return;
    }

    const normalizedPhone = normalizePhone(phone);
    onLoading(true);
    onError('');
    setConstraintError(null);

    try {
      await enhancedFormSubmit(
        async () => {
          const response = await fetch('/api/auth/signup/phone/start', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ phone: normalizedPhone }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            const error = new Error(errorData.message || 'Failed to send verification code');
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
            setPhoneError(errorData?.message || 'Please check your phone number format');
          },
          onNetworkError: (error) => {
            onError('Network error. Please check your connection and try again.');
          }
        }
      );

      // Success
      setShowOtpInput(true);
      setRetryCount(0);
      onError('');
    } catch (err: any) {
      // Final error handling if not caught by enhancedFormSubmit
      if (!isConstraintError(err)) {
        onError('Failed to send verification code. Please try again.');
      }
    } finally {
      onLoading(false);
    }
  }, [phone, onError, onLoading]);

  const handleOtpSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate OTP
    const otpValidation = validateOTP(otp);
    if (!otpValidation.isValid) {
      setOtpError(otpValidation.error || 'Invalid verification code');
      return;
    }

    const normalizedPhone = normalizePhone(phone);
    onLoading(true);
    onError('');

    try {
      await enhancedFormSubmit(
        async () => {
          const response = await fetch('/api/auth/signup/phone/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              phone: normalizedPhone, 
              otp: otp.trim()
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
            setOtpError(errorData?.message || 'Invalid verification code');
          },
          onNetworkError: (error) => {
            onError('Network error. Please check your connection and try again.');
          }
        }
      );

      // Success
      onVerified(normalizedPhone);
    } catch (err: any) {
      if (err.response?.status === 400) {
        setOtpError('Invalid verification code. Please try again.');
      } else {
        onError('Verification failed. Please try again.');
      }
    } finally {
      onLoading(false);
    }
  }, [phone, otp, onError, onLoading, onVerified]);

  const handleResendOtp = useCallback(async () => {
    const normalizedPhone = normalizePhone(phone);
    onLoading(true);
    onError('');
    setRetryCount(prev => prev + 1);

    try {
      await enhancedFormSubmit(
        async () => {
          const response = await fetch('/api/auth/signup/phone/start', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ phone: normalizedPhone }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            const error = new Error(errorData.message || 'Failed to resend verification code');
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

      setOtp('');
      onError('');
    } catch (err: any) {
      onError('Failed to resend verification code. Please try again.');
    } finally {
      onLoading(false);
    }
  }, [phone, onError, onLoading]);

  if (showOtpInput) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Phone</h2>
          <p className="text-gray-600">
            We sent a 6-digit code to <strong>{formatPhoneForDisplay(phone)}</strong>
          </p>
        </div>

        <form onSubmit={handleOtpSubmit} className="space-y-4">
          <FormField
            label="Verification Code"
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Enter 6-digit code"
            maxLength={6}
            className="text-center text-lg tracking-widest"
            required
            autoComplete="one-time-code"
            error={otpError}
            validation={{
              required: true,
              custom: (value) => {
                const result = validateOTP(value);
                return result.isValid ? null : result.error || 'Invalid verification code';
              }
            }}
            onValidationChange={handleOtpValidation}
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
                setShowOtpInput(false);
                setOtp('');
                setOtpError('');
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
              disabled={otp.length !== 6 || Boolean(otpError)}
            >
              Verify Code
            </Button>
          </div>
        </form>

        <div className="text-center">
          <button
            type="button"
            onClick={handleResendOtp}
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Enter Your Phone Number</h2>
        <p className="text-gray-600">
          We'll send you a verification code to confirm your number
        </p>
      </div>

      <form onSubmit={handlePhoneSubmit} className="space-y-4">
        <FormField
          label="Phone Number"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+1 (555) 123-4567"
          required
          autoComplete="tel"
          error={phoneError}
          helperText="Enter with country code or use local format"
          validation={{
            required: true,
            custom: (value) => {
              const result = validatePhone(value);
              return result.isValid ? null : result.error || 'Invalid phone number';
            }
          }}
          onValidationChange={handlePhoneValidation}
        />

        {constraintError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <svg className="w-5 h-5 text-yellow-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Phone Number Already Registered
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
            disabled={Boolean(phoneError) || !phone.trim()}
          >
            Send Code
          </Button>
        </div>
      </form>
    </div>
  );
}