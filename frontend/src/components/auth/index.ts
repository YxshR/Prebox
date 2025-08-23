// Multi-step phone signup components
export { PhoneSignupFlow } from './PhoneSignupFlow';
export { PhoneVerificationStep } from './PhoneVerificationStep';
export { EmailVerificationStep } from './EmailVerificationStep';
export { PasswordCreationStep } from './PasswordCreationStep';
export { SignupProgress } from './SignupProgress';
export { PhoneSignupExample } from './PhoneSignupExample';

// Auth0 signup components
export { Auth0SignupFlow } from './Auth0SignupFlow';
export { Auth0Callback } from './Auth0Callback';
export { PhoneVerificationForAuth0 } from './PhoneVerificationForAuth0';
export { Auth0ProviderWrapper } from './Auth0Provider';

// Login components
export { Login } from './Login';
export { LoginMethodSelector } from './LoginMethodSelector';
export { Auth0Login } from './Auth0Login';
export { PhoneOTPLogin } from './PhoneOTPLogin';
export { EmailPasswordLogin } from './EmailPasswordLogin';

// Auth utilities and providers
export { AuthProvider, useAuthContext } from './AuthProvider';
export { ProtectedRoute, withAuth } from './ProtectedRoute';
export { useAuth } from '@/hooks/useAuth';

// Existing components
export { PhoneVerification } from './PhoneVerification';
export { EmailVerification } from './EmailVerification';
export { default as OnboardingFlow } from './OnboardingFlow';
export { default as OnboardingSuccess } from './OnboardingSuccess';
export { default as RegistrationForm } from './RegistrationForm';
export { GoogleAuthButton } from './GoogleAuthButton';
export { default as GoogleOAuthCallback } from './GoogleOAuthCallback';