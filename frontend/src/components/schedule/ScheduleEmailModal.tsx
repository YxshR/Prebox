'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  XMarkIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import { useForm } from 'react-hook-form';
import { ScheduledEmailRequest } from '../../types/scheduledEmail';
import { scheduledEmailApi } from '../../lib/scheduledEmailApi';

interface ScheduleEmailModalProps {
  onClose: () => void;
  onSchedule: (emailData: ScheduledEmailRequest) => void;
}

interface FormData {
  subject: string;
  from: string;
  replyTo?: string;
  recipients: string;
  htmlContent: string;
  textContent?: string;
  scheduledAt: string;
  userType: 'subscription' | 'recharge';
}

export default function ScheduleEmailModal({ onClose, onSchedule }: ScheduleEmailModalProps) {
  const [step, setStep] = useState(1);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, watch, formState: { errors }, setValue } = useForm<FormData>({
    defaultValues: {
      userType: 'subscription',
      scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16) // Tomorrow
    }
  });

  const watchedValues = watch();

  const validateScheduling = async () => {
    setIsValidating(true);
    try {
      const recipients = watchedValues.recipients.split('\n').filter(email => email.trim());
      const result = await scheduledEmailApi.validateScheduling({
        tenantId: 'current-tenant', // This would come from auth context
        scheduledAt: new Date(watchedValues.scheduledAt),
        userType: watchedValues.userType,
        recipientCount: recipients.length
      });
      setValidationResult(result);
      if (result.isValid) {
        setStep(3);
      }
    } catch (error) {
      console.error('Validation failed:', error);
      setValidationResult({ isValid: false, reason: 'Validation failed. Please try again.' });
    } finally {
      setIsValidating(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const recipients = data.recipients.split('\n').filter(email => email.trim());
      const emailData: ScheduledEmailRequest = {
        tenantId: 'current-tenant', // This would come from auth context
        emailJob: {
          to: recipients,
          from: data.from,
          subject: data.subject,
          htmlContent: data.htmlContent,
          textContent: data.textContent,
          replyTo: data.replyTo
        },
        scheduledAt: new Date(data.scheduledAt),
        userType: data.userType
      };
      
      await onSchedule(emailData);
    } catch (error) {
      console.error('Failed to schedule email:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5); // Minimum 5 minutes from now
    return now.toISOString().slice(0, 16);
  };

  const getMaxDateTime = () => {
    const maxDate = new Date();
    if (watchedValues.userType === 'subscription') {
      maxDate.setDate(maxDate.getDate() + 14); // 14 days for subscription
    } else {
      maxDate.setFullYear(maxDate.getFullYear() + 1); // 1 year for recharge
    }
    return maxDate.toISOString().slice(0, 16);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-green-600 to-blue-600 rounded-lg flex items-center justify-center">
                <CalendarIcon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Schedule Email</h2>
                <p className="text-sm text-gray-500">Step {step} of 3</p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </motion.button>
          </div>

          {/* Progress Bar */}
          <div className="px-6 py-3 bg-gray-50">
            <div className="flex items-center space-x-4">
              {[1, 2, 3].map((stepNumber) => (
                <div key={stepNumber} className="flex items-center">
                  <motion.div
                    animate={{
                      backgroundColor: step >= stepNumber ? '#3B82F6' : '#E5E7EB',
                      scale: step === stepNumber ? 1.1 : 1
                    }}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                  >
                    {step > stepNumber ? (
                      <CheckCircleIcon className="h-5 w-5" />
                    ) : (
                      stepNumber
                    )}
                  </motion.div>
                  {stepNumber < 3 && (
                    <motion.div
                      animate={{
                        backgroundColor: step > stepNumber ? '#3B82F6' : '#E5E7EB'
                      }}
                      className="w-16 h-1 mx-2 rounded-full"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
            <div className="p-6">
              <AnimatePresence mode="wait">
                {/* Step 1: Email Content */}
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Email Content</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Subject *
                          </label>
                          <input
                            {...register('subject', { required: 'Subject is required' })}
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter email subject"
                          />
                          {errors.subject && (
                            <p className="mt-1 text-sm text-red-600">{errors.subject.message}</p>
                          )}
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            From Email *
                          </label>
                          <input
                            {...register('from', { 
                              required: 'From email is required',
                              pattern: {
                                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                message: 'Invalid email format'
                              }
                            })}
                            type="email"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="sender@example.com"
                          />
                          {errors.from && (
                            <p className="mt-1 text-sm text-red-600">{errors.from.message}</p>
                          )}
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Reply To (Optional)
                        </label>
                        <input
                          {...register('replyTo', {
                            pattern: {
                              value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                              message: 'Invalid email format'
                            }
                          })}
                          type="email"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="reply@example.com"
                        />
                        {errors.replyTo && (
                          <p className="mt-1 text-sm text-red-600">{errors.replyTo.message}</p>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Recipients * (one email per line)
                        </label>
                        <textarea
                          {...register('recipients', { required: 'At least one recipient is required' })}
                          rows={6}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="recipient1@example.com&#10;recipient2@example.com&#10;recipient3@example.com"
                        />
                        {errors.recipients && (
                          <p className="mt-1 text-sm text-red-600">{errors.recipients.message}</p>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          HTML Content *
                        </label>
                        <textarea
                          {...register('htmlContent', { required: 'HTML content is required' })}
                          rows={8}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                          placeholder="<html><body><h1>Your email content here</h1></body></html>"
                        />
                        {errors.htmlContent && (
                          <p className="mt-1 text-sm text-red-600">{errors.htmlContent.message}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Scheduling */}
                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Scheduling Options</h3>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            User Type *
                          </label>
                          <div className="space-y-3">
                            <label className="flex items-center">
                              <input
                                {...register('userType')}
                                type="radio"
                                value="subscription"
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                              />
                              <span className="ml-3 text-sm text-gray-700">
                                Subscription (14 days max)
                              </span>
                            </label>
                            <label className="flex items-center">
                              <input
                                {...register('userType')}
                                type="radio"
                                value="recharge"
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                              />
                              <span className="ml-3 text-sm text-gray-700">
                                Recharge (unlimited time)
                              </span>
                            </label>
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Scheduled Date & Time *
                          </label>
                          <input
                            {...register('scheduledAt', { required: 'Scheduled date is required' })}
                            type="datetime-local"
                            min={getMinDateTime()}
                            max={getMaxDateTime()}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          {errors.scheduledAt && (
                            <p className="mt-1 text-sm text-red-600">{errors.scheduledAt.message}</p>
                          )}
                          <p className="mt-1 text-xs text-gray-500">
                            {watchedValues.userType === 'subscription' 
                              ? 'Maximum 14 days in advance for subscription users'
                              : 'No time limit for recharge users'
                            }
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Validation Results */}
                    {validationResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-lg border ${
                          validationResult.isValid 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          {validationResult.isValid ? (
                            <CheckCircleIcon className="h-5 w-5 text-green-600" />
                          ) : (
                            <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />
                          )}
                          <span className={`text-sm font-medium ${
                            validationResult.isValid ? 'text-green-800' : 'text-red-800'
                          }`}>
                            {validationResult.isValid ? 'Validation Successful' : 'Validation Failed'}
                          </span>
                        </div>
                        {validationResult.reason && (
                          <p className={`mt-2 text-sm ${
                            validationResult.isValid ? 'text-green-700' : 'text-red-700'
                          }`}>
                            {validationResult.reason}
                          </p>
                        )}
                        {validationResult.estimatedCost && (
                          <p className="mt-2 text-sm text-gray-700">
                            Estimated Cost: ₹{validationResult.estimatedCost}
                          </p>
                        )}
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* Step 3: Confirmation */}
                {step === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Confirm Schedule</h3>
                      
                      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h4 className="text-sm font-medium text-gray-700">Email Details</h4>
                            <div className="mt-2 space-y-1 text-sm text-gray-600">
                              <p><span className="font-medium">Subject:</span> {watchedValues.subject}</p>
                              <p><span className="font-medium">From:</span> {watchedValues.from}</p>
                              <p><span className="font-medium">Recipients:</span> {watchedValues.recipients?.split('\n').filter(e => e.trim()).length || 0}</p>
                            </div>
                          </div>
                          
                          <div>
                            <h4 className="text-sm font-medium text-gray-700">Schedule Details</h4>
                            <div className="mt-2 space-y-1 text-sm text-gray-600">
                              <p><span className="font-medium">Date:</span> {new Date(watchedValues.scheduledAt).toLocaleString()}</p>
                              <p><span className="font-medium">User Type:</span> {watchedValues.userType}</p>
                              {validationResult?.estimatedCost && (
                                <p><span className="font-medium">Cost:</span> ₹{validationResult.estimatedCost}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex space-x-3">
                {step > 1 && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => setStep(step - 1)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </motion.button>
                )}
              </div>
              
              <div className="flex space-x-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </motion.button>
                
                {step < 2 && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Next
                  </motion.button>
                )}
                
                {step === 2 && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    onClick={validateScheduling}
                    disabled={isValidating}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                  >
                    {isValidating && (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                      />
                    )}
                    <span>Validate & Continue</span>
                  </motion.button>
                )}
                
                {step === 3 && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                  >
                    {isSubmitting && (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                      />
                    )}
                    <span>Schedule Email</span>
                  </motion.button>
                )}
              </div>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}