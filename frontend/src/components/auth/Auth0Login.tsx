'use client';

import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/Button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, ArrowLeft, AlertCircle } from 'lucide-react';
import { handleAuth0Error } from '@/lib/auth0';

interface Auth0LoginProps {
  onSuccess?: (user: any) => void;
  onError?: (error: string) => void;
  onBack?: () => void;
  className?: string;
}

export function Auth0Login({ 
  onSuccess, 
  onError, 
  onBack,
  className = '' 
}: Auth0LoginProps) {
  const { 
    loginWithRedirect, 
    user, 
    isAuthenticated, 
    isLoading, 
    error: auth0Error 
  } = useAuth0();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle Auth0 authentication result
  useEffect(() => {
    if (isAuthenticated && user && !loading) {
      onSuccess?.(user);
    }
  }, [isAuthenticated, user, loading, onSuccess]);

  // Handle Auth0 errors
  useEffect(() => {
    if (auth0Error) {
      const errorMessage = handleAuth0Error(auth0Error);
      setError(errorMessage);
      onError?.(errorMessage);
      setLoading(false);
    }
  }, [auth0Error, onError]);

  const handleAuth0Login = async () => {
    try {
      setLoading(true);
      setError(null);
      
      await loginWithRedirect({
        authorizationParams: {
          screen_hint: 'login',
          prompt: 'login'
        }
      });
    } catch (err: any) {
      const errorMessage = handleAuth0Error(err);
      setError(errorMessage);
      onError?.(errorMessage);
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    handleAuth0Login();
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Authenticating...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center space-x-3">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              disabled={loading}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle>Social Login</CardTitle>
              <CardDescription>
                Sign in with your social account
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              Choose from multiple social login options including Google, Facebook, and more.
            </p>
          </div>

          <Button
            onClick={handleAuth0Login}
            disabled={loading}
            loading={loading}
            className="w-full"
            size="lg"
          >
            Continue with Social Login
          </Button>

          {error && (
            <Button
              onClick={handleRetry}
              variant="outline"
              className="w-full"
              disabled={loading}
            >
              Try Again
            </Button>
          )}
        </div>

        <div className="text-center pt-4 border-t">
          <p className="text-xs text-gray-500">
            By continuing, you agree to our Terms of Service and Privacy Policy.
            Your social account information will be used to create or access your account.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}