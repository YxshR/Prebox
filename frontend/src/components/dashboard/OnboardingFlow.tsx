'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircleIcon, 
  EnvelopeIcon, 
  PhoneIcon,
  DocumentTextIcon,
  UserGroupIcon,
  SparklesIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  completed: boolean;
  action?: string;
}

interface OnboardingFlowProps {
  user: {
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    subscriptionTier: string;
  };
  onClose: () => void;
  onStepComplete: (stepId: string) => void;
}

export default function OnboardingFlow({ user, onClose, onStepComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  const steps: OnboardingStep[] = [
    {
      id: 'email-verification',
      title: 'Verify Your Email',
      description: 'Confirm your email address to start sending emails',
      icon: EnvelopeIcon,
      completed: user.isEmailVerified,
      action: 'Verify Email'
    },
    {
      id: 'phone-verification',
      title: 'Add Phone Number',
      description: 'Optional: Add phone for account security',
      icon: PhoneIcon,
      completed: user.isPhoneVerified,
      action: 'Add Phone'
    },
    {
      id: 'create-template',
      title: 'Create Your First Template',
      description: 'Design an email template or generate one with AI',
      icon: DocumentTextIcon,
      completed: false,
      action: 'Create Template'
    },
    {
      id: 'import-contacts',
      title: 'Import Contacts',
      description: 'Upload your contact list to start sending emails',
      icon: UserGroupIcon,
      completed: false,
      action: 'Import Contacts'
    },
    {
      id: 'send-first-email',
      title: 'Send Your First Email',
      description: 'Send a test email to see the platform in action',
      icon: SparklesIcon,
      completed: false,
      action: 'Send Email'
    }
  ];

  const completedSteps = steps.filter(step => step.completed).length;
  const progress = (completedSteps / steps.length) * 100;

  useEffect(() => {
    // Auto-advance to next incomplete step
    const nextIncompleteStep = steps.findIndex(step => !step.completed);
    if (nextIncompleteStep !== -1) {
      setCurrentStep(nextIncompleteStep);
    }
  }, [user]);

  const handleStepAction = (stepId: string) => {
    onStepComplete(stepId);
    
    // Move to next step
    const nextStep = currentStep + 1;
    if (nextStep < steps.length) {
      setCurrentStep(nextStep);
    }
  };

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="relative p-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
            
            <div className="mb-4">
              <h2 className="text-2xl font-bold mb-2">Welcome to BulkEmail Platform!</h2>
              <p className="text-blue-100">Let's get you set up in just a few steps</p>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-white bg-opacity-20 rounded-full h-2">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="bg-white h-2 rounded-full"
              />
            </div>
            <div className="flex justify-between text-sm mt-2 text-blue-100">
              <span>{completedSteps} of {steps.length} completed</span>
              <span>{Math.round(progress)}%</span>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Step Navigation */}
            <div className="flex justify-center mb-8">
              <div className="flex space-x-2">
                {steps.map((step, index) => (
                  <motion.button
                    key={step.id}
                    onClick={() => setCurrentStep(index)}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                      step.completed
                        ? 'bg-green-500 text-white'
                        : index === currentStep
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {step.completed ? (
                      <CheckCircleIcon className="h-5 w-5" />
                    ) : (
                      index + 1
                    )}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Current Step Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <div className="mb-6">
                  <div className={`inline-flex p-4 rounded-full mb-4 ${
                    steps[currentStep].completed 
                      ? 'bg-green-100' 
                      : 'bg-blue-100'
                  }`}>
                    {React.createElement(steps[currentStep].icon, {
                      className: `h-8 w-8 ${
                        steps[currentStep].completed 
                          ? 'text-green-600' 
                          : 'text-blue-600'
                      }`
                    })}
                  </div>
                  
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {steps[currentStep].title}
                  </h3>
                  
                  <p className="text-gray-600 max-w-md mx-auto">
                    {steps[currentStep].description}
                  </p>
                </div>

                {/* Step-specific content */}
                <div className="mb-6">
                  {currentStep === 0 && !user.isEmailVerified && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-yellow-800">
                        Check your email inbox for a verification link. Don't see it? Check your spam folder.
                      </p>
                    </div>
                  )}

                  {currentStep === 1 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-blue-800">
                        Adding a phone number helps secure your account and enables SMS notifications.
                      </p>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
                      <p className="text-sm text-purple-800">
                        {user.subscriptionTier === 'free' 
                          ? 'You can create 1 AI template per day on the Free tier.'
                          : 'Create unlimited templates with your current plan.'
                        }
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex justify-center space-x-3">
                  {currentStep > 0 && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setCurrentStep(currentStep - 1)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Previous
                    </motion.button>
                  )}

                  {!steps[currentStep].completed && steps[currentStep].action && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleStepAction(steps[currentStep].id)}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {steps[currentStep].action}
                    </motion.button>
                  )}

                  {steps[currentStep].completed && currentStep < steps.length - 1 && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setCurrentStep(currentStep + 1)}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Next Step
                    </motion.button>
                  )}

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleClose}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Skip for now
                  </motion.button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>Step {currentStep + 1} of {steps.length}</span>
              <span>
                {completedSteps === steps.length 
                  ? '🎉 All done!' 
                  : `${steps.length - completedSteps} steps remaining`
                }
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}