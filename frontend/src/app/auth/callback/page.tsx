'use client';

import React from 'react';
import { Auth0ProviderWrapper } from '@/components/auth/Auth0Provider';
import { Auth0Callback } from '@/components/auth/Auth0Callback';

export default function Auth0CallbackPage() {
  const handleSuccess = (user: any) => {
    console.log('Auth0 authentication successful:', user);
    // Additional success handling can be added here
  };

  const handleError = (error: string) => {
    console.error('Auth0 authentication error:', error);
    // Additional error handling can be added here
  };

  return (
    <Auth0ProviderWrapper>
      <Auth0Callback
        onSuccess={handleSuccess}
        onError={handleError}
        redirectTo="/dashboard"
      />
    </Auth0ProviderWrapper>
  );
}