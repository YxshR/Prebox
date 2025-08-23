'use client';

import React, { useState } from 'react';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { EnhancedPhoneVerificationStep } from './EnhancedPhoneVerificationStep';
import { EnhancedEmailVerificationStep } from './EnhancedEmailVerificationStep';
import { EnhancedPasswordCreationStep } from './EnhancedPasswordCreationStep';
import { ErrorDisplay } from '@/components/ErrorDisplay';
import { useFormValidation, useFormErrorHandler } from '@/hooks/useFormValidation';
import { validatePhone, validateEmail, validatePassword } from '@/lib/validation';
import { authApi } from '@/lib/enhancedApiClient';

interface EnhancedSignupFormProps {
  onSuccess?: (userData: any) => void;
  onError?: (error: string) => void;
}

type SignupStep = 'phone' | 'email' | 'password' | 'complete';

export function EnhancedSignupForm({ onSuccess, onError }: EnhancedSignupFormProps) {
  const [currentStep, setCurrentStep] = useState<SignupStep>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signupData, setSignupData] = useState({
    phone: '',
    email: '',
    password: ''
  });

  const { handleApiError } = useFormErrorHandler();

  const handleStepError = (errorMessage: string) => {
    setError(errorMessage);
    if (onError) {
      onError(errorMessage);
    }
  };

  const handlePhoneVerified = (phone: string) => {
    setSignupData(prev => ({ ...prev, phone }));
    setCurrentStep('email');
    setError(null);
  };

  const handleEmailVerified = (email: string) => {
    setSignupData(prev => ({ ...prev, email }));
    setCurrentStep('password');
    setError(null);
  };

  const handlePasswordCreated = async (password: string) => {
    setSignupData(prev => ({ ...prev, password }));
    
    try {
      setLoading(true);
      setError(null);

      // Complete the signup process
      const response = await authApi.completeSignup(password);
      
      if (response.success) {
        setCurrentStep('complete');
        if (onSuccess) {
          onSuccess(response.data);
        }
      } else {
        throw new Error(response.error?.message || 'Signup completion failed');
      }
    } catch (err: any) {
      try {
        handleApiError(err, (field, message) => {
          handleStepError(message);
        });
      } catch (unhandledError: any) {
        handleStepError(unhandledError.message || 'Failed to complete signup');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setError(null);
    
    switch (currentStep) {
      case 'email':
        setCurrentStep('phone');
        break;
      case 'password':
        setCurrentStep('email');
        break;
      default:
        break;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'phone':
        return (
          <EnhancedPhoneVerificationStep
            onVerified={handlePhoneVerified}
            onBack={() => {}} // No back on first step
            onError={handleStepError}
            onLoading={setLoading}
            loading={loading}
            error={error}
          />
        );

      case 'email':
        return (
          <EnhancedEmailVerificationStep
            onVerified={handleEmailVerified}
            onBack={handleBack}
            onError={handleStepError}
            onLoading={setLoading}
            loading={loading}
            error={error}
          />
        );

      case 'password':
        return (
          <EnhancedPasswordCreationStep
            onPasswordCreated={handlePasswordCreated}
            onBack={handleBack}
            onError={handleStepError}
            onLoading={setLoading}
            loading={loading}
            error={error}
          />
        );

      case 'complete':
        return (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Account Created Successfully!</h2>
              <p className="text-gray-600">
                Welcome! Your account has been created and you're now logged in.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const getStepNumber = (): number => {
    switch (currentStep) {
      case 'phone': return 1;
      case 'email': return 2;
      case 'password': return 3;
      case 'complete': return 4;
      default: return 1;
    }
  };

  const getStepTitle = (): string => {
    switch (currentStep) {
      case 'phone': return 'Phone Verification';
      case 'email': return 'Email Verification';
      case 'password': return 'Create Password';
      case 'complete': return 'Complete';
      default: return 'Sign Up';
    }
  };

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('Signup form error:', error, errorInfo);
        handleStepError('An unexpected error occurred. Please refresh and try again.');
      }}
      showTechnicalDetails={process.env.NODE_ENV === 'development'}
    >
      <div className="max-w-md mx-auto">
        {/* Progress Indicator */}
        {currentStep !== 'complete' && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-gray-500">
                Step {getStepNumber()} of 3
              </span>
              <span className="text-sm font-medium text-gray-900">
                {getStepTitle()}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(getStepNumber() / 3) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Step Content */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          {renderStep()}
        </div>

        {/* Global Error Display */}
        {error && currentStep !== 'complete' && (
          <div className="mt-4">
            <ErrorDisplay
              error={{ message: error }}
              onRetry={() => setError(null)}
              className="w-full"
            />
          </div>
        )}

        {/* Debug Info (Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-3 bg-gray-100 rounded text-xs">
            <strong>Debug Info:</strong>
            <pre>{JSON.stringify({ currentStep, signupData, loading, error }, null, 2)}</pre>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

/**
 * Enhanced signup form with error boundary wrapper
 */
export function EnhancedSignupFormWithErrorBoundary(props: EnhancedSignupFormProps) {
  return (
    <ErrorBoundary
      fallback={({ error, retry }) => (
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-sm border">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">Something went wrong</h3>
              <p className="text-gray-600 mt-1">
                The signup form encountered an error. Please try again.
              </p>
            </div>
            <button
              onClick={retry}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
      onError={(error, errorInfo) => {
        console.error('Signup form boundary error:', error, errorInfo);
        
        // In production, send to error monitoring service
        if (process.env.NODE_ENV === 'production') {
          // Example: errorMonitoringService.captureException(error, { extra: errorInfo });
        }
      }}
    >
      <EnhancedSignupForm {...props} />
    </ErrorBoundary>
  );
}

export default EnhancedSignupFormWithErrorBoundary;