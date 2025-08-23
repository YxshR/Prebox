'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import RegistrationForm from './RegistrationForm';
import { PhoneVerification } from './PhoneVerification';

import OnboardingSuccess from './OnboardingSuccess';

type OnboardingStep = 'registration' | 'phone_verification' | 'success';

interface OnboardingState {
  step: OnboardingStep;
  userId?: string;
  email?: string;
  otpId?: string;
  registrationMethod?: 'email' | 'phone_google';
  phone?: string;
  userName?: string;
}

interface OnboardingFlowProps {
  onComplete: () => void;
}

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [state, setState] = useState<OnboardingState>({
    step: 'registration',
  });

  const handleRegistrationSuccess = (data: {
    userId: string;
    email: string;
    otpId?: string;
    registrationMethod: string;
    phone?: string;
  }) => {
    setState(prev => ({
      ...prev,
      step: data.otpId ? 'phone_verification' : 'success',
      userId: data.userId,
      email: data.email,
      otpId: data.otpId,
      phone: data.phone,
      registrationMethod: 'phone_google',
    }));
  };

  const handlePhoneVerificationSuccess = (authData?: any) => {
    // If authentication data is provided, the user is now logged in
    if (authData) {
      // Tokens are already stored in localStorage by PhoneVerification component
      console.log('User authenticated successfully:', authData.user);
    }
    
    setState(prev => ({
      ...prev,
      step: 'success',
      userName: authData?.user?.firstName || authData?.user?.email || 'User'
    }));
  };



  const handleOtpResend = (newOtpId: string) => {
    setState(prev => ({
      ...prev,
      otpId: newOtpId,
    }));
  };

  const renderStep = () => {
    switch (state.step) {
      case 'registration':
        return (
          <RegistrationForm
            onSuccess={handleRegistrationSuccess}
          />
        );

      case 'phone_verification':
        return state.otpId && state.phone ? (
          <PhoneVerification
            onPhoneSubmit={(phone) => {
              // Phone already submitted, this shouldn't be called
              console.log('Phone resubmitted:', phone);
            }}
            onOtpVerify={(otp) => {
              console.log('OTP verified:', otp);
              handlePhoneVerificationSuccess();
            }}
            onResendOtp={() => {
              handleOtpResend('new-otp-id');
            }}
            loading={false}
            error={null}
            showOtpInput={true}
            onBack={() => {
              setState(prev => ({ ...prev, step: 'registration' }));
            }}
          />
        ) : null;



      case 'success':
        return (
          <OnboardingSuccess
            userName={state.userName}
            onContinue={onComplete}
          />
        );

      default:
        return null;
    }
  };

  const getStepNumber = () => {
    switch (state.step) {
      case 'registration': return 1;
      case 'phone_verification': return 2;
      case 'success': return 3;
      default: return 1;
    }
  };

  const getTotalSteps = () => {
    return 3;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Progress Indicator */}
        {state.step !== 'success' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center justify-center space-x-4">
              {Array.from({ length: getTotalSteps() }, (_, index) => {
                const stepNumber = index + 1;
                const isActive = stepNumber === getStepNumber();
                const isCompleted = stepNumber < getStepNumber();

                return (
                  <div key={stepNumber} className="flex items-center">
                    <motion.div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                        isCompleted
                          ? 'bg-green-500 text-white'
                          : isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-600'
                      }`}
                      animate={{
                        scale: isActive ? 1.1 : 1,
                      }}
                    >
                      {isCompleted ? '✓' : stepNumber}
                    </motion.div>
                    {stepNumber < getTotalSteps() && (
                      <div
                        className={`w-12 h-1 mx-2 transition-colors ${
                          isCompleted ? 'bg-green-500' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="text-center mt-4">
              <p className="text-sm text-gray-600">
                Step {getStepNumber()} of {getTotalSteps()}
              </p>
            </div>
          </motion.div>
        )}

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={state.step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}