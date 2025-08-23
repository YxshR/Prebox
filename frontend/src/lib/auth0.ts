import { Auth0Provider } from '@auth0/auth0-react';

// Auth0 configuration
export const auth0Config = {
  domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN || '',
  clientId: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID || '',
  authorizationParams: {
    redirect_uri: typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '',
    audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE || '',
    scope: 'openid profile email phone'
  },
  cacheLocation: 'localstorage' as const,
  useRefreshTokens: true,
};

// Auth0 error handling utility
export const handleAuth0Error = (error: any): string => {
  if (!error) return 'Unknown authentication error';
  
  // Common Auth0 error codes and user-friendly messages
  const errorMappings: Record<string, string> = {
    'access_denied': 'Access was denied. Please try again.',
    'unauthorized': 'Authentication failed. Please check your credentials.',
    'consent_required': 'Additional consent is required to complete authentication.',
    'interaction_required': 'Additional interaction is required to complete authentication.',
    'login_required': 'Please log in to continue.',
    'account_selection_required': 'Please select an account to continue.',
    'invalid_request': 'Invalid authentication request. Please try again.',
    'invalid_scope': 'Invalid authentication scope requested.',
    'server_error': 'Authentication server error. Please try again later.',
    'temporarily_unavailable': 'Authentication service is temporarily unavailable. Please try again later.',
  };

  // Check for specific error codes
  if (error.error && errorMappings[error.error]) {
    return errorMappings[error.error];
  }

  // Check for error description
  if (error.error_description) {
    return error.error_description;
  }

  // Check for message
  if (error.message) {
    return error.message;
  }

  // Fallback
  return 'Authentication failed. Please try again.';
};

// Auth0 token validation utility
export const validateAuth0Token = (token: string): boolean => {
  if (!token) return false;
  
  try {
    // Basic JWT structure validation (header.payload.signature)
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    // Decode payload to check expiration
    const payload = JSON.parse(atob(parts[1]));
    const now = Math.floor(Date.now() / 1000);
    
    return payload.exp > now;
  } catch {
    return false;
  }
};

// Auth0 user profile utility
export const formatAuth0User = (user: any) => {
  return {
    id: user.sub,
    email: user.email,
    name: user.name,
    picture: user.picture,
    emailVerified: user.email_verified,
    phoneNumber: user.phone_number,
    phoneVerified: user.phone_verified,
    nickname: user.nickname,
    updatedAt: user.updated_at,
  };
};

export default auth0Config;