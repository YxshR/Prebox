'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '@/components/ui/Button';
import { PhoneVerificationForAuth0 } from './PhoneVerificationForAuth0';
import { SignupProgress } from './SignupProgress';

export type Auth0SignupStep = 'auth0' | 'phone' | 'complete';

interface Auth0SignupState {
  step: Auth0SignupStep;
  phone: string;
  phoneVerified: boolean;
  loading: boolean;
  error: string | null;
}

interface Auth0SignupFlowProps {
  onComplete: (userData: {
    auth0User: any;
    phone?: string;
  }) => void;
  onCancel?: () => void;
}

export function Auth0SignupFlow({ onComplete, onCancel }: Auth0SignupFlowProps) {
  const { loginWithRedirect, user, isAuthenticated, isLoading, error: auth0Error } = useAuth0();
  
  const [state, setState] = useState<Auth0SignupState>({
    step: 'auth0',
    phone: '',
    phoneVerified: false,
    loading: false,
    error: null,
  });

  const updateState = useCallback((updates: Partial<Auth0SignupState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // Handle Auth0 authentication completion
  useEffect(() => {
    if (isAuthenticated && user && state.step === 'auth0') {
      // Check if phone verification is required
      if (user.phone_verified) {
        // Phone already verified, complete signup
        updateState({ step: 'complete' });
        onComplete({ auth0User: user, phone: user.phone_number });
      } else {
        // Need phone verification
        updateState({ step: 'phone' });
      }
    }
  }, [isAuthenticated, user, state.step, updateState, onComplete]);

  // Handle Auth0 errors
  useEffect(() => {
    if (auth0Error) {
      updateState({ 
        error: `Authentication failed: ${auth0Error.message}`,
        loading: false 
      });
    }
  }, [auth0Error, updateState]);

  const handleAuth0Signup = useCallback(async () => {
    updateState({ loading: true, error: null });
    
    try {
      await loginWithRedirect({
        authorizationParams: {
          screen_hint: 'signup',
          prompt: 'login'
        }
      });
    } catch (err) {
      updateState({ 
        error: err instanceof Error ? err.message : 'Failed to start Auth0 signup',
        loading: false 
      });
    }
  }, [loginWithRedirect, updateState]);

  const handlePhoneVerified = useCallback((phone: string) => {
    updateState({
      phone,
      phoneVerified: true,
      step: 'complete',
      error: null,
    });

    // Complete the signup process
    onComplete({
      auth0User: user,
      phone,
    });
  }, [updateState, onComplete, user]);

  const handleStepBack = useCallback(() => {
    switch (state.step) {
      case 'phone':
        updateState({ step: 'auth0', error: null });
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
      case 'auth0': return 1;
      case 'phone': return 2;
      default: return 2;
    }
  };

  const renderCurrentStep = () => {
    if (isLoading) {
      return (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Authenticating...</p>
        </div>
      );
    }

    switch (state.step) {
      case 'auth0':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Your Account</h2>
              <p className="text-gray-600">
                Sign up with Auth0 for secure authentication
              </p>
            </div>

            <div className="space-y-4">
              <Button
                onClick={handleAuth0Signup}
                loading={state.loading}
                className="w-full"
                disabled={isLoading}
              >
                Sign Up with Auth0
              </Button>

              {state.error && (
                <div className="text-red-600 text-sm bg-red-50 p-3 rounded-md">
                  {state.error}
                </div>
              )}
            </div>

            <div className="text-center">
              <p className="text-sm text-gray-500">
                By signing up, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </div>
        );

      case 'phone':
        return (
          <PhoneVerificationForAuth0
            onVerified={handlePhoneVerified}
            onBack={handleStepBack}
            onError={handleError}
            onLoading={handleLoading}
            loading={state.loading}
            error={state.error}
            auth0User={user}
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
          totalSteps={2}
          stepLabels={['Auth0 Signup', 'Phone Verification']}
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