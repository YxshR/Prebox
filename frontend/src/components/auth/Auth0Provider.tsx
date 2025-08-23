'use client';

import React from 'react';
import { Auth0Provider } from '@auth0/auth0-react';
import { auth0Config } from '@/lib/auth0';

interface Auth0ProviderWrapperProps {
  children: React.ReactNode;
}

export function Auth0ProviderWrapper({ children }: Auth0ProviderWrapperProps) {
  // Only render Auth0Provider on client side
  if (typeof window === 'undefined') {
    return <>{children}</>;
  }

  return (
    <Auth0Provider
      domain={auth0Config.domain}
      clientId={auth0Config.clientId}
      authorizationParams={{
        ...auth0Config.authorizationParams,
        redirect_uri: `${window.location.origin}/auth/callback`,
      }}
      cacheLocation={auth0Config.cacheLocation}
      useRefreshTokens={auth0Config.useRefreshTokens}
      onRedirectCallback={(appState) => {
        // Handle redirect after authentication
        const returnTo = appState?.returnTo || window.location.pathname;
        window.history.replaceState({}, document.title, returnTo);
      }}
    >
      {children}
    </Auth0Provider>
  );
}