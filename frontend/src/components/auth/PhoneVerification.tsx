'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from '../ui/Button';
import { authApi, AuthResponse } from '../../lib/auth';
import { validateOTPFormat, formatPhoneForDisplay } from '../../lib/phoneValidation';
import toast from 'react-hot-toast';

interface PhoneVerificationProps {
  otpId: string;
  phone: string;
  onSuccess: (authData?: AuthResponse) => void;
  onResend: (newOtpId: string) => void;
  enableAuthentication?: boolean; // If true, returns JWT tokens on successful verification
  maxAttempts?: number;
}

interface SecurityFeedback {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  show: boolean;
}

export default function PhoneVerification({ 
  otpId, 
  phone, 
  onSuccess, 
  onResend, 
  enableAuthentication = false,
  maxAttempts = 3 
}: PhoneVerificationProps) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [securityFeedback, setSecurityFeedback] = useState<SecurityFeedback>({
    type: 'info',
    message: '',
    show: false
  });
  const [isBlocked, setIsBlocked] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Enhanced countdown timer with security feedback
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
      showSecurityFeedback('info', 'You can now request a new verification code.');
    }
  }, [timeLeft]);

  // Security feedback display
  const showSecurityFeedback = useCallback((type: SecurityFeedback['type'], message: string) => {
    setSecurityFeedback({ type, message, show: true });
    setTimeout(() => {
      setSecurityFeedback(prev => ({ ...prev, show: false }));
    }, 5000);
  }, []);

  // Enhanced OTP input handling with security validation
  const handleOtpChange = (index: number, value: string) => {
    // Prevent multiple characters and non-numeric input
    if (value.length > 1 || !/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all fields are filled
    if (newOtp.every(digit => digit !== '') && newOtp.join('').length === 6) {
      handleVerifyOtp(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    
    // Clear security feedback on new input
    if (securityFeedback.show && securityFeedback.type === 'error') {
      setSecurityFeedback(prev => ({ ...prev, show: false }));
    }
  };

  // Enhanced OTP verification with security features
  const handleVerifyOtp = async (otpCode?: string) => {
    const code = otpCode || otp.join('');
    
    // Validate OTP format
    if (!validateOTPFormat(code)) {
      showSecurityFeedback('error', 'Please enter all 6 digits');
      return;
    }

    // Check if blocked due to too many attempts
    if (isBlocked) {
      showSecurityFeedback('error', 'Too many failed attempts. Please request a new code.');
      return;
    }

    setLoading(true);
    
    try {
      if (enableAuthentication) {
        // Use secure OTP verification that returns JWT tokens
        const response = await authApi.verifyOTPWithAuth(otpId, code);
        
        // Store tokens securely
        if (response.accessToken) {
          localStorage.setItem('accessToken', response.accessToken);
          localStorage.setItem('refreshToken', response.refreshToken);
        }
        
        showSecurityFeedback('success', 'Phone verified successfully! Logging you in...');
        setTimeout(() => onSuccess(response), 1000);
      } else {
        // Standard OTP verification
        const verifyResponse = await authApi.verifyOTP(otpId, code);
        if (verifyResponse.verified) {
          showSecurityFeedback('success', 'Phone number verified successfully!');
          setTimeout(() => onSuccess(), 1000);
        } else {
          throw new Error('Invalid verification code');
        }
      }
      
      // Reset attempts on success
      setAttempts(0);
      
    } catch (error: any) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      
      // Enhanced error handling with security feedback
      let errorMessage = 'Verification failed. Please try again.';
      
      if (error.response?.status === 429) {
        errorMessage = 'Too many attempts. Please wait before trying again.';
        setIsBlocked(true);
        setTimeout(() => setIsBlocked(false), 60000); // Unblock after 1 minute
      } else if (error.response?.status === 400) {
        errorMessage = error.response?.data?.error?.message || 'Invalid verification code';
      } else if (error.response?.status === 404) {
        errorMessage = 'Verification code expired. Please request a new one.';
      }
      
      // Show attempts remaining
      if (newAttempts >= maxAttempts) {
        errorMessage = 'Maximum attempts exceeded. Please request a new code.';
        setIsBlocked(true);
        showSecurityFeedback('error', errorMessage);
      } else {
        const attemptsLeft = maxAttempts - newAttempts;
        showSecurityFeedback('warning', `${errorMessage} ${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''} remaining.`);
      }
      
      // Clear OTP inputs and focus first input
      setOtp(['', '', '', '', '', '']);
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  // Enhanced resend with security features
  const handleResendOtp = async () => {
    if (!canResend || resendLoading) return;
    
    setResendLoading(true);
    
    try {
      const response = await authApi.resendOTP(otpId);
      onResend(response.otpId);
      
      // Reset security state
      setTimeLeft(60);
      setCanResend(false);
      setAttempts(0);
      setIsBlocked(false);
      setOtp(['', '', '', '', '', '']);
      
      showSecurityFeedback('success', 'New verification code sent to your phone');
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
      
    } catch (error: any) {
      let errorMessage = 'Failed to resend code. Please try again.';
      
      if (error.response?.status === 429) {
        errorMessage = 'Please wait before requesting another code.';
      } else if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      }
      
      showSecurityFeedback('error', errorMessage);
    } finally {
      setResendLoading(false);
    }
  };

  // Security indicator component
  const SecurityIndicator = () => (
    <AnimatePresence>
      {securityFeedback.show && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={`p-3 rounded-lg text-sm font-medium ${
            securityFeedback.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
            securityFeedback.type === 'warning' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
            securityFeedback.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
            'bg-blue-50 text-blue-700 border border-blue-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            <div className="flex-shrink-0">
              {securityFeedback.type === 'error' && (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              {securityFeedback.type === 'warning' && (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
              {securityFeedback.type === 'success' && (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              {securityFeedback.type === 'info' && (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <span>{securityFeedback.message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="bg-white shadow-lg rounded-lg p-8">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Verify Phone Number</h2>
          <p className="text-gray-600 mt-2">
            We've sent a 6-digit code to
          </p>
          <p className="text-gray-900 font-medium">
            {formatPhoneForDisplay(phone)}
          </p>
          {enableAuthentication && (
            <p className="text-sm text-blue-600 mt-1">
              🔒 Secure authentication enabled
            </p>
          )}
        </div>

        <div className="space-y-6">
          {/* Security Feedback */}
          <SecurityIndicator />

          {/* OTP Input Fields */}
          <div className="flex justify-center space-x-3">
            {otp.map((digit, index) => (
              <motion.input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={`w-12 h-12 text-center text-xl font-bold border-2 rounded-lg focus:outline-none transition-all duration-200 ${
                  isBlocked 
                    ? 'border-red-300 bg-red-50 cursor-not-allowed' 
                    : securityFeedback.type === 'error' && securityFeedback.show
                    ? 'border-red-400 focus:border-red-500'
                    : 'border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200'
                }`}
                whileFocus={{ scale: 1.05 }}
                disabled={loading || isBlocked}
                autoComplete="one-time-code"
              />
            ))}
          </div>

          {/* Security Status */}
          <div className="text-center text-sm">
            {attempts > 0 && !isBlocked && (
              <p className="text-yellow-600">
                {maxAttempts - attempts} attempt{maxAttempts - attempts !== 1 ? 's' : ''} remaining
              </p>
            )}
            {isBlocked && (
              <p className="text-red-600 font-medium">
                Account temporarily locked due to multiple failed attempts
              </p>
            )}
          </div>

          {/* Verify Button */}
          <Button
            onClick={() => handleVerifyOtp()}
            className="w-full"
            size="lg"
            loading={loading}
            disabled={otp.some(digit => digit === '') || isBlocked}
          >
            {enableAuthentication ? 'Verify & Sign In' : 'Verify Phone Number'}
          </Button>

          {/* Resend OTP */}
          <div className="text-center">
            {!canResend ? (
              <p className="text-gray-500">
                Resend code in {timeLeft}s
              </p>
            ) : (
              <button
                onClick={handleResendOtp}
                disabled={resendLoading || isBlocked}
                className="text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {resendLoading ? 'Sending...' : 'Resend Code'}
              </button>
            )}
          </div>

          {/* Enhanced Help Text */}
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-500">
              Didn't receive the code? Check your phone and try again.
            </p>
            <p className="text-xs text-gray-400">
              Code expires in 10 minutes. Keep this page open.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}