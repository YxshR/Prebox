'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Smartphone, ArrowLeft, AlertCircle, Clock } from 'lucide-react';
import { authApi } from '@/lib/auth';
import { useApiState } from '@/hooks/useApiState';

interface PhoneOTPLoginProps {
  onSuccess?: (authResponse: any) => void;
  onError?: (error: string) => void;
  onBack?: () => void;
  className?: string;
}

interface LoginState {
  step: 'phone' | 'otp';
  phone: string;
  otp: string;
  otpId: string | null;
  countdown: number;
}

export function PhoneOTPLogin({ 
  onSuccess, 
  onError, 
  onBack,
  className = '' 
}: PhoneOTPLoginProps) {
  const [state, setState] = useState<LoginState>({
    step: 'phone',
    phone: '',
    otp: '',
    otpId: null,
    countdown: 0
  });

  const sendOtpApi = useApiState();
  const verifyOtpApi = useApiState();

  // Countdown timer for OTP resend
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (state.countdown > 0) {
      timer = setTimeout(() => {
        setState(prev => ({ ...prev, countdown: prev.countdown - 1 }));
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [state.countdown]);

  const updateState = (updates: Partial<LoginState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const formatPhoneNumber = (phone: string): string => {
    // Remove all non-digits
    const digits = phone.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX for US numbers
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    
    // Add +1 for US numbers if not present
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    
    return `+${digits}`;
  };

  const validatePhoneNumber = (phone: string): boolean => {
    const digits = phone.replace(/\D/g, '');
    return digits.length >= 10;
  };

  const handleSendOTP = async () => {
    if (!validatePhoneNumber(state.phone)) {
      onError?.('Please enter a valid phone number');
      return;
    }

    const formattedPhone = formatPhoneNumber(state.phone);
    
    try {
      const result = await sendOtpApi.execute(async () => {
        // For phone login, we need to send OTP for authentication
        const response = await authApi.sendOTP('', formattedPhone, 'login');
        return response;
      });

      if (result) {
        updateState({
          step: 'otp',
          otpId: result.otpId,
          countdown: 60,
          phone: formattedPhone
        });
      }
    } catch (error: any) {
      onError?.(error.message || 'Failed to send OTP');
    }
  };

  const handleVerifyOTP = async () => {
    if (!state.otp || state.otp.length !== 6) {
      onError?.('Please enter a valid 6-digit OTP');
      return;
    }

    if (!state.otpId) {
      onError?.('Invalid session. Please request a new OTP.');
      return;
    }

    try {
      const result = await verifyOtpApi.execute(async () => {
        // Use authenticateWithOTP for login flow
        const response = await authApi.authenticateWithOTP(state.otpId!, state.otp);
        return response;
      });

      if (result) {
        onSuccess?.(result);
      }
    } catch (error: any) {
      onError?.(error.message || 'Invalid OTP. Please try again.');
    }
  };

  const handleResendOTP = async () => {
    if (!state.otpId) {
      // If no otpId, start over
      handleSendOTP();
      return;
    }

    try {
      const result = await sendOtpApi.execute(async () => {
        const response = await authApi.resendOTP(state.otpId!);
        return response;
      });

      if (result) {
        updateState({
          otpId: result.otpId,
          countdown: 60,
          otp: ''
        });
      }
    } catch (error: any) {
      onError?.(error.message || 'Failed to resend OTP');
    }
  };

  const handleBack = () => {
    if (state.step === 'otp') {
      updateState({ step: 'phone', otp: '', otpId: null, countdown: 0 });
    } else {
      onBack?.();
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow only digits, spaces, parentheses, and dashes
    const cleaned = value.replace(/[^\d\s\(\)\-\+]/g, '');
    updateState({ phone: cleaned });
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    updateState({ otp: value });
  };

  const isLoading = sendOtpApi.state.loading || verifyOtpApi.state.loading;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBack}
            disabled={isLoading}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Smartphone className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle>Phone Login</CardTitle>
              <CardDescription>
                {state.step === 'phone' 
                  ? 'Enter your phone number to receive an OTP'
                  : 'Enter the verification code sent to your phone'
                }
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {(sendOtpApi.state.error || verifyOtpApi.state.error) && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {sendOtpApi.state.error?.message || verifyOtpApi.state.error?.message}
            </AlertDescription>
          </Alert>
        )}

        {state.step === 'phone' ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={state.phone}
                onChange={handlePhoneChange}
                disabled={isLoading}
                className="text-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter your phone number with country code
              </p>
            </div>

            <Button
              onClick={handleSendOTP}
              disabled={!validatePhoneNumber(state.phone) || isLoading}
              loading={isLoading}
              className="w-full"
              size="lg"
            >
              Send Verification Code
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-4">
                We sent a 6-digit code to <strong>{state.phone}</strong>
              </p>
            </div>

            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-gray-700 mb-2">
                Verification Code
              </label>
              <Input
                id="otp"
                type="text"
                placeholder="123456"
                value={state.otp}
                onChange={handleOtpChange}
                disabled={isLoading}
                className="text-lg text-center tracking-widest"
                maxLength={6}
              />
            </div>

            <Button
              onClick={handleVerifyOTP}
              disabled={state.otp.length !== 6 || isLoading}
              loading={isLoading}
              className="w-full"
              size="lg"
            >
              Verify & Sign In
            </Button>

            <div className="text-center">
              {state.countdown > 0 ? (
                <p className="text-sm text-gray-500 flex items-center justify-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>Resend code in {state.countdown}s</span>
                </p>
              ) : (
                <Button
                  onClick={handleResendOTP}
                  variant="ghost"
                  disabled={isLoading}
                  className="text-sm"
                >
                  Didn't receive the code? Resend
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="text-center pt-4 border-t">
          <p className="text-xs text-gray-500">
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}