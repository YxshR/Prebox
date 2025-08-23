'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface SignupProgressProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
}

export function SignupProgress({ 
  currentStep, 
  totalSteps, 
  stepLabels = [] 
}: SignupProgressProps) {
  const getStepStatus = (stepNumber: number) => {
    if (stepNumber < currentStep) return 'completed';
    if (stepNumber === currentStep) return 'active';
    return 'pending';
  };

  const getStepColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 text-white border-green-500';
      case 'active':
        return 'bg-blue-600 text-white border-blue-600';
      default:
        return 'bg-gray-200 text-gray-600 border-gray-200';
    }
  };

  const getConnectorColor = (stepNumber: number) => {
    return stepNumber < currentStep ? 'bg-green-500' : 'bg-gray-200';
  };

  return (
    <div className="w-full">
      {/* Progress Bar */}
      <div className="flex items-center justify-center mb-6">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1;
          const status = getStepStatus(stepNumber);
          const label = stepLabels[index];

          return (
            <div key={stepNumber} className="flex items-center">
              {/* Step Circle */}
              <div className="flex flex-col items-center">
                <motion.div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${getStepColor(status)}`}
                  animate={{
                    scale: status === 'active' ? 1.1 : 1,
                  }}
                  transition={{ duration: 0.2 }}
                >
                  {status === 'completed' ? (
                    <motion.svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </motion.svg>
                  ) : (
                    stepNumber
                  )}
                </motion.div>

                {/* Step Label */}
                {label && (
                  <span className={`text-xs mt-2 font-medium ${
                    status === 'active' ? 'text-blue-600' :
                    status === 'completed' ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {label}
                  </span>
                )}
              </div>

              {/* Connector Line */}
              {stepNumber < totalSteps && (
                <motion.div
                  className={`w-12 h-1 mx-2 transition-colors ${getConnectorColor(stepNumber)}`}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: stepNumber < currentStep ? 1 : 0 }}
                  transition={{ duration: 0.5, delay: stepNumber < currentStep ? 0.2 : 0 }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress Text */}
      <div className="text-center">
        <p className="text-sm text-gray-600">
          Step {currentStep} of {totalSteps}
        </p>
        <motion.div
          className="w-full bg-gray-200 rounded-full h-2 mt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
            initial={{ width: 0 }}
            animate={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </motion.div>
      </div>
    </div>
  );
}