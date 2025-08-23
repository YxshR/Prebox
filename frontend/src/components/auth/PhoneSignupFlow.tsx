'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PhoneVerificationStep } from './PhoneVerificationStep';
import { EmailVerificationStep } from './EmailVerificationStep';
import { PasswordCreationStep } from './PasswordCreationStep';
import { SignupProgress } from './SignupProgress';

export type PhoneSignupStep = 'phone' | 'email' | 'password' | 'complete';

interface PhoneSignupState {
  step: PhoneSignupStep;
  phone: string;
  email: string;
  password: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  loading: boolean;
  error: string | null;
}

interface PhoneSignupFlowProps {
  onComplete: (userData: {
    phone: string;
    email: string;
    password: string;
  }) => void;
  onCancel?: () => void;
}

export function PhoneSignupFlow({ onComplete, onCancel }: PhoneSignupFlowProps) {
  const [state, setState] = useState<PhoneSignupState>({
    step: 'phone',
    phone: '',
    email: '',
    password: '',
    phoneVerified: false,
    emailVerified: false,
    loading: false,
    error: null,
  });

  const updateState = useCallback((updates: Partial<PhoneSignupState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const handlePhoneVerified = useCallback((phone: string) => {
    updateState({
      phone,
      phoneVerified: true,
      step: 'email',
      error: null,
    });
  }, [updateState]);

  const handleEmailVerified = useCallback((email: string) => {
    updateState({
      email,
      emailVerified: true,
      step: 'password',
      error: null,
    });
  }, [updateState]);

  const handlePasswordCreated = useCallback((password: string) => {
    updateState({
      password,
      step: 'complete',
      error: null,
    });

    // Complete the signup process
    onComplete({
      phone: state.phone,
      email: state.email,
      password,
    });
  }, [updateState, onComplete, state.phone, state.email]);

  const handleStepBack = useCallback(() => {
    switch (state.step) {
      case 'email':
        updateState({ step: 'phone', error: null });
        break;
      case 'password':
        updateState({ step: 'email', error: null });
        break;
      default:
        onCancel?.();
        break;
    }
  }, [state.step, updateState, onCancel]);

  const handleError = useCallback((error: string) => {
    updateState({ error, loading: false });
  }, [updateState]);

  const handleLoading = useCallback((loading: boolean) => {
    updateState({ loading });
  }, [updateState]);

  const getStepNumber = (): number => {
    switch (state.step) {
      case 'phone': return 1;
      case 'email': return 2;
      case 'password': return 3;
      default: return 3;
    }
  };

  const renderCurrentStep = () => {
    switch (state.step) {
      case 'phone':
        return (
          <PhoneVerificationStep
            onVerified={handlePhoneVerified}
            onBack={handleStepBack}
            onError={handleError}
            onLoading={handleLoading}
            loading={state.loading}
            error={state.error}
          />
        );

      case 'email':
        return (
          <EmailVerificationStep
            onVerified={handleEmailVerified}
            onBack={handleStepBack}
            onError={handleError}
            onLoading={handleLoading}
            loading={state.loading}
            error={state.error}
          />
        );

      case 'password':
        return (
          <PasswordCreationStep
            onPasswordCreated={handlePasswordCreated}
            onBack={handleStepBack}
            onError={handleError}
            onLoading={handleLoading}
            loading={state.loading}
            error={state.error}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        {/* Progress Indicator */}
        <SignupProgress
          currentStep={getStepNumber()}
          totalSteps={3}
          stepLabels={['Phone', 'Email', 'Password']}
        />

        {/* Step Content */}
        <div className="mt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={state.step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="bg-white rounded-lg shadow-lg p-6"
            >
              {renderCurrentStep()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Cancel Option */}
        {onCancel && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel signup
            </button>
          </div>
        )}
      </div>
    </div>
  );
}