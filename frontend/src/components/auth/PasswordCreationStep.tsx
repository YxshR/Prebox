'use client';

import React, { useState, useCallback } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

interface PasswordCreationStepProps {
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

export function PasswordCreationStep({
  onPasswordCreated,
  onBack,
  onError,
  onLoading,
  loading,
  error,
}: PasswordCreationStepProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validatePasswordStrength = (password: string): PasswordStrength => {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length >= 8) {
      score += 1;
    } else {
      feedback.push('At least 8 characters');
    }

    // Uppercase check
    if (/[A-Z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('One uppercase letter');
    }

    // Lowercase check
    if (/[a-z]/.test(password)) {
      score += 1;
    } else {
      feedback.push('One lowercase letter');
    }

    // Number check
    if (/\d/.test(password)) {
      score += 1;
    } else {
      feedback.push('One number');
    }

    // Special character check
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      score += 1;
    } else {
      feedback.push('One special character (!@#$%^&*)');
    }

    return {
      score,
      feedback,
      isValid: score >= 4, // Require at least 4 out of 5 criteria
    };
  };

  const passwordStrength = validatePasswordStrength(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

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
    
    if (!passwordStrength.isValid) {
      onError('Password does not meet security requirements');
      return;
    }

    if (!passwordsMatch) {
      onError('Passwords do not match');
      return;
    }

    onLoading(true);
    onError('');

    try {
      // API call to complete signup
      const response = await fetch('/api/auth/signup/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (!response.ok) {
        onError(data.message || 'Failed to create account');
        return;
      }

      // Password creation successful
      onPasswordCreated(password);
    } catch (err) {
      onError('Network error. Please check your connection and try again.');
    } finally {
      onLoading(false);
    }
  }, [password, passwordStrength.isValid, passwordsMatch, onError, onLoading, onPasswordCreated]);

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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <div className="relative">
            <Input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
          </div>

          {/* Password Strength Indicator */}
          {password.length > 0 && (
            <div className="mt-2">
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
                <div className="mt-2">
                  <p className="text-xs text-gray-600 mb-1">Password must include:</p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    {passwordStrength.feedback.map((requirement, index) => (
                      <li key={index} className="flex items-center space-x-1">
                        <span className="text-red-400">•</span>
                        <span>{requirement}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Confirm Password
          </label>
          <div className="relative">
            <Input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
          </div>

          {/* Password Match Indicator */}
          {confirmPassword.length > 0 && (
            <div className="mt-1">
              {passwordsMatch ? (
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
            disabled={!passwordStrength.isValid || !passwordsMatch}
          >
            Create Account
          </Button>
        </div>
      </form>
    </div>
  );
}