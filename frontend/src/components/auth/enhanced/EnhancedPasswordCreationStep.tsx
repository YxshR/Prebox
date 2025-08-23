'use client';

import React, { useState, useCallback } from 'react';
import { FormField } from '@/components/ui/FormField';
import Button from '@/components/ui/Button';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { validatePassword } from '@/lib/validation';
import { enhancedFormSubmit } from '@/lib/enhancedRetry';

interface EnhancedPasswordCreationStepProps {
  onPasswordCreated: (password: string) => void;
  onBack: () => void;
  onError: (error: string) => void;
  onLoading: (loading: boolean) => void;
  loading: boolean;
  error: string | null;
}

interface PasswordStrength {
  score: number;
  feedback: string[];
  isValid: boolean;
}

export function EnhancedPasswordCreationStep({
  onPasswordCreated,
  onBack,
  onError,
  onLoading,
  loading,
  error,
}: EnhancedPasswordCreationStepProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [passwordWarnings, setPasswordWarnings] = useState<string[]>([]);

  const validatePasswordStrength = useCallback((password: string): PasswordStrength => {
    const validation = validatePassword(password);
    
    const criteria = [
      { test: password.length >= 8, label: 'At least 8 characters' },
      { test: /[A-Z]/.test(password), label: 'One uppercase letter' },
      { test: /[a-z]/.test(password), label: 'One lowercase letter' },
      { test: /\d/.test(password), label: 'One number' },
      { test: /[!@#$%^&*(),.?":{}|<>]/.test(password), label: 'One special character' }
    ];

    const passedCriteria = criteria.filter(c => c.test).length;
    const failedCriteria = criteria.filter(c => !c.test).map(c => c.label);

    return {
      score: passedCriteria,
      feedback: failedCriteria,
      isValid: validation.isValid
    };
  }, []);

  const passwordStrength = validatePasswordStrength(password);

  const handlePasswordValidation = useCallback((isValid: boolean, error?: string) => {
    setPasswordError(error || '');
    
    if (password) {
      const validation = validatePassword(password);
      setPasswordWarnings(validation.warnings || []);
    }
  }, [password]);

  const handleConfirmPasswordValidation = useCallback((isValid: boolean, error?: string) => {
    setConfirmPasswordError(error || '');
  }, []);

  const validatePasswordMatch = useCallback((value: string) => {
    if (!value) {
      return { isValid: false, error: 'Please confirm your password' };
    }
    
    if (value !== password) {
      return { isValid: false, error: 'Passwords do not match' };
    }
    
    return { isValid: true };
  }, [password]);

  const getStrengthColor = (score: number): string => {
    if (score <= 2) return 'bg-red-500';
    if (score <= 3) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStrengthText = (score: number): string => {
    if (score <= 2) return 'Weak';
    if (score <= 3) return 'Medium';
    return 'Strong';
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate password
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.error || 'Password does not meet requirements');
      return;
    }

    // Validate password match
    const matchValidation = validatePasswordMatch(confirmPassword);
    if (!matchValidation.isValid) {
      setConfirmPasswordError(matchValidation.error || 'Passwords do not match');
      return;
    }

    onLoading(true);
    onError('');

    try {
      await enhancedFormSubmit(
        async () => {
          const response = await fetch('/api/auth/signup/complete', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ password }),
          });

          if (!response.ok) {
            const errorData = await response.json();
            const error = new Error(errorData.message || 'Failed to create account');
            (error as any).response = response;
            (error as any).data = errorData;
            throw error;
          }

          return response.json();
        },
        {
          onValidationError: (error) => {
            const errorData = error.response?.data || error.data;
            if (errorData?.message?.toLowerCase().includes('password')) {
              setPasswordError(errorData.message);
            } else {
              onError(errorData?.message || 'Please check your password requirements');
            }
          },
          onNetworkError: (error) => {
            onError('Network error. Please check your connection and try again.');
          }
        }
      );

      // Success
      onPasswordCreated(password);
    } catch (err: any) {
      onError('Failed to create account. Please try again.');
    } finally {
      onLoading(false);
    }
  }, [password, confirmPassword, validatePasswordMatch, onError, onLoading, onPasswordCreated]);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Your Password</h2>
        <p className="text-gray-600">
          Choose a strong password to secure your account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <FormField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
            autoComplete="new-password"
            error={passwordError}
            validation={{
              required: true,
              custom: (value) => validatePassword(value)
            }}
            onValidationChange={handlePasswordValidation}
          />
          
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
            style={{ marginTop: '2rem' }}
          >
            {showPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>

          {/* Password Strength Indicator */}
          {password.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center space-x-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${getStrengthColor(passwordStrength.score)}`}
                    style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                  />
                </div>
                <span className={`text-sm font-medium ${
                  passwordStrength.score <= 2 ? 'text-red-600' :
                  passwordStrength.score <= 3 ? 'text-yellow-600' : 'text-green-600'
                }`}>
                  {getStrengthText(passwordStrength.score)}
                </span>
              </div>

              {/* Password Requirements */}
              {passwordStrength.feedback.length > 0 && (
                <div className="text-xs text-gray-600">
                  <p className="mb-1">Password must include:</p>
                  <ul className="space-y-1">
                    {passwordStrength.feedback.map((requirement, index) => (
                      <li key={index} className="flex items-center space-x-1">
                        <span className="text-red-400">•</span>
                        <span>{requirement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Password Warnings */}
              {passwordWarnings.length > 0 && (
                <div className="text-xs text-yellow-600">
                  <p className="mb-1">Security suggestions:</p>
                  <ul className="space-y-1">
                    {passwordWarnings.map((warning, index) => (
                      <li key={index} className="flex items-center space-x-1">
                        <span className="text-yellow-400">⚠</span>
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <FormField
            label="Confirm Password"
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            required
            autoComplete="new-password"
            error={confirmPasswordError}
            validation={{
              required: true,
              custom: validatePasswordMatch
            }}
            onValidationChange={handleConfirmPasswordValidation}
          />
          
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-8 text-gray-400 hover:text-gray-600"
            style={{ marginTop: '2rem' }}
          >
            {showConfirmPassword ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>

          {/* Password Match Indicator */}
          {confirmPassword.length > 0 && (
            <div className="mt-1">
              {password === confirmPassword ? (
                <p className="text-xs text-green-600 flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Passwords match</span>
                </p>
              ) : (
                <p className="text-xs text-red-600 flex items-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Passwords do not match</span>
                </p>
              )}
            </div>
          )}
        </div>

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
            disabled={
              !passwordStrength.isValid || 
              password !== confirmPassword || 
              Boolean(passwordError) || 
              Boolean(confirmPasswordError)
            }
          >
            Create Account
          </Button>
        </div>
      </form>
    </div>
  );
}