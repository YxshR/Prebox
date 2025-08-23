'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LoginMethodSelector, type LoginMethod } from './LoginMethodSelector';
import { Auth0Login } from './Auth0Login';
import { PhoneOTPLogin } from './PhoneOTPLogin';
import { EmailPasswordLogin } from './EmailPasswordLogin';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react';

interface LoginProps {
  onSuccess?: (user: any) => void;
  redirectTo?: string;
  className?: string;
}

export function Login({ 
  onSuccess, 
  redirectTo = '/dashboard',
  className = '' 
}: LoginProps) {
  const [selectedMethod, setSelectedMethod] = useState<LoginMethod | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const { login } = useAuth();
  const router = useRouter();

  const handleMethodSelect = (method: LoginMethod) => {
    setSelectedMethod(method);
    setError(null);
    setSuccess(null);
  };

  const handleBack = () => {
    setSelectedMethod(null);
    setError(null);
    setSuccess(null);
  };

  const handleLoginSuccess = (authResponse: any) => {
    try {
      // Update auth state
      login(authResponse);
      
      setSuccess('Login successful! Redirecting...');
      setError(null);
      
      // Call success callback if provided
      onSuccess?.(authResponse.user);
      
      // Redirect after a short delay
      setTimeout(() => {
        router.push(redirectTo);
      }, 1500);
      
    } catch (error: any) {
      setError('Login successful but failed to update session. Please try again.');
      console.error('Login success handler error:', error);
    }
  };

  const handleLoginError = (errorMessage: string) => {
    setError(errorMessage);
    setSuccess(null);
  };

  const renderLoginMethod = () => {
    const commonProps = {
      onSuccess: handleLoginSuccess,
      onError: handleLoginError,
      onBack: handleBack,
      className: className
    };

    switch (selectedMethod) {
      case 'auth0':
        return <Auth0Login {...commonProps} />;
      case 'phone':
        return <PhoneOTPLogin {...commonProps} />;
      case 'email':
        return <EmailPasswordLogin {...commonProps} />;
      default:
        return null;
    }
  };

  return (
    <div className={`max-w-md mx-auto ${className}`}>
      {/* Global error/success messages */}
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {success && (
        <Alert className="mb-4 border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Render method selector or selected login method */}
      {!selectedMethod ? (
        <LoginMethodSelector 
          onMethodSelect={handleMethodSelect}
          className={className}
        />
      ) : (
        renderLoginMethod()
      )}
    </div>
  );
}