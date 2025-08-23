# Frontend Component Documentation

## Overview

This document provides comprehensive documentation for all authentication and pricing components in the frontend application. Components are built with React, TypeScript, and follow accessibility best practices.

## Component Architecture

```
src/components/
├── auth/                    # Authentication components
│   ├── PhoneSignupFlow.tsx     # Multi-step phone signup
│   ├── Auth0SignupFlow.tsx     # Auth0 signup with phone verification
│   ├── LoginMethodSelector.tsx # Login method selection
│   ├── PhoneOTPLogin.tsx       # Phone OTP login
│   ├── EmailPasswordLogin.tsx  # Email/password login
│   ├── PhoneVerificationStep.tsx
│   ├── EmailVerificationStep.tsx
│   ├── PasswordCreationStep.tsx
│   └── SignupProgress.tsx      # Progress indicator
├── pricing/                 # Pricing components
│   ├── PricingDisplay.tsx      # Main pricing display
│   ├── PricingFallback.tsx     # Fallback pricing
│   └── PricingContainer.tsx    # Container with error handling
└── common/                  # Shared components
    ├── ErrorBoundary.tsx       # Error boundary wrapper
    ├── LoadingSpinner.tsx      # Loading states
    └── SecureForm.tsx          # Secure form wrapper
```

## Authentication Components

### PhoneSignupFlow

Multi-step phone number signup component that handles the complete signup process.

**Props:**
```typescript
interface PhoneSignupFlowProps {
  onComplete: (result: SignupResult) => void;
  onError?: (error: AuthError) => void;
  className?: string;
  theme?: 'light' | 'dark';
}

interface SignupResult {
  user: User;
  tokens: AuthTokens;
}
```

**Usage:**
```tsx
import { PhoneSignupFlow } from '@/components/auth/PhoneSignupFlow';

function SignupPage() {
  const handleComplete = (result: SignupResult) => {
    // Handle successful signup
    localStorage.setItem('accessToken', result.tokens.accessToken);
    router.push('/dashboard');
  };

  const handleError = (error: AuthError) => {
    // Handle signup error
    toast.error(error.message);
  };

  return (
    <PhoneSignupFlow 
      onComplete={handleComplete}
      onError={handleError}
      theme="light"
    />
  );
}
```

**Features:**
- 4-step signup process (phone → OTP → email → password)
- Real-time validation
- Progress indicator
- Error handling with retry options
- Accessibility compliant
- Mobile responsive

**Steps:**
1. **Phone Entry**: User enters phone number with format validation
2. **OTP Verification**: User enters 6-digit OTP with resend option
3. **Email Verification**: User enters email and verifies with code
4. **Password Creation**: User creates secure password

**State Management:**
```typescript
interface SignupState {
  currentStep: number;
  phone: string;
  email: string;
  isLoading: boolean;
  error: string | null;
  otpSent: boolean;
  emailVerified: boolean;
}
```

**Validation Rules:**
- Phone: E.164 format (+1234567890)
- Email: Valid email format
- Password: Min 8 chars, uppercase, lowercase, number, special char
- OTP: 6 digits

---

### Auth0SignupFlow

Auth0 integration component with phone verification requirement.

**Props:**
```typescript
interface Auth0SignupFlowProps {
  onComplete: (result: SignupResult) => void;
  onError?: (error: AuthError) => void;
  redirectUri?: string;
  className?: string;
}
```

**Usage:**
```tsx
import { Auth0SignupFlow } from '@/components/auth/Auth0SignupFlow';

function Auth0SignupPage() {
  return (
    <Auth0SignupFlow 
      onComplete={(result) => {
        // Handle Auth0 signup completion
        setUser(result.user);
        router.push('/dashboard');
      }}
      redirectUri={window.location.origin + '/auth/callback'}
    />
  );
}
```

**Features:**
- Auth0 SDK integration
- Phone verification after Auth0 auth
- Profile data synchronization
- Error handling for Auth0 failures
- Automatic redirect handling

**Flow:**
1. User clicks "Continue with Auth0"
2. Redirects to Auth0 login
3. Returns with Auth0 profile data
4. Requires phone verification
5. Completes signup with verified phone

---

### LoginMethodSelector

Component for selecting authentication method.

**Props:**
```typescript
interface LoginMethodSelectorProps {
  onMethodSelect: (method: LoginMethod) => void;
  availableMethods?: LoginMethod[];
  className?: string;
  showIcons?: boolean;
}

type LoginMethod = 'auth0' | 'phone' | 'email';
```

**Usage:**
```tsx
import { LoginMethodSelector } from '@/components/auth/LoginMethodSelector';

function LoginPage() {
  const [selectedMethod, setSelectedMethod] = useState<LoginMethod | null>(null);

  if (selectedMethod === 'phone') {
    return <PhoneOTPLogin onSuccess={handleLoginSuccess} />;
  }

  if (selectedMethod === 'email') {
    return <EmailPasswordLogin onSuccess={handleLoginSuccess} />;
  }

  return (
    <LoginMethodSelector 
      onMethodSelect={setSelectedMethod}
      availableMethods={['auth0', 'phone', 'email']}
      showIcons={true}
    />
  );
}
```

**Features:**
- Visual method selection
- Customizable available methods
- Icon support
- Keyboard navigation
- Responsive design

---

### PhoneOTPLogin

Phone number and OTP login component.

**Props:**
```typescript
interface PhoneOTPLoginProps {
  onSuccess: (result: LoginResult) => void;
  onError?: (error: AuthError) => void;
  onBack?: () => void;
  className?: string;
}
```

**Usage:**
```tsx
import { PhoneOTPLogin } from '@/components/auth/PhoneOTPLogin';

function PhoneLoginPage() {
  return (
    <PhoneOTPLogin 
      onSuccess={(result) => {
        setAuthTokens(result.tokens);
        setUser(result.user);
        router.push('/dashboard');
      }}
      onBack={() => router.back()}
    />
  );
}
```

**Features:**
- Phone number input with validation
- OTP request and verification
- Resend OTP functionality
- Rate limiting handling
- Auto-focus on OTP input

**Flow:**
1. User enters phone number
2. System sends OTP via SMS
3. User enters 6-digit OTP
4. System verifies and logs in user

---

### EmailPasswordLogin

Traditional email and password login component.

**Props:**
```typescript
interface EmailPasswordLoginProps {
  onSuccess: (result: LoginResult) => void;
  onError?: (error: AuthError) => void;
  onForgotPassword?: () => void;
  showRememberMe?: boolean;
  className?: string;
}
```

**Usage:**
```tsx
import { EmailPasswordLogin } from '@/components/auth/EmailPasswordLogin';

function EmailLoginPage() {
  return (
    <EmailPasswordLogin 
      onSuccess={handleLoginSuccess}
      onForgotPassword={() => router.push('/forgot-password')}
      showRememberMe={true}
    />
  );
}
```

**Features:**
- Email and password validation
- Show/hide password toggle
- Remember me option
- Forgot password link
- Form submission handling

---

### PhoneVerificationStep

Reusable phone verification step component.

**Props:**
```typescript
interface PhoneVerificationStepProps {
  phone: string;
  onVerified: (phone: string) => void;
  onError?: (error: string) => void;
  onResend?: () => void;
  className?: string;
}
```

**Usage:**
```tsx
import { PhoneVerificationStep } from '@/components/auth/PhoneVerificationStep';

function CustomSignupFlow() {
  return (
    <PhoneVerificationStep 
      phone="+1234567890"
      onVerified={(phone) => {
        console.log('Phone verified:', phone);
        setStep(2);
      }}
      onResend={() => {
        // Resend OTP logic
      }}
    />
  );
}
```

**Features:**
- OTP input with auto-focus
- Countdown timer for resend
- Error display
- Loading states
- Accessibility support

---

### EmailVerificationStep

Email verification step component.

**Props:**
```typescript
interface EmailVerificationStepProps {
  email: string;
  onVerified: (email: string) => void;
  onError?: (error: string) => void;
  onResend?: () => void;
  className?: string;
}
```

**Usage:**
```tsx
import { EmailVerificationStep } from '@/components/auth/EmailVerificationStep';

function EmailVerificationPage() {
  return (
    <EmailVerificationStep 
      email="user@example.com"
      onVerified={(email) => {
        console.log('Email verified:', email);
        proceedToNextStep();
      }}
    />
  );
}
```

**Features:**
- Email code input
- Resend functionality
- Email client links
- Visual feedback
- Error handling

---

### PasswordCreationStep

Password creation and confirmation component.

**Props:**
```typescript
interface PasswordCreationStepProps {
  onPasswordCreated: (password: string) => void;
  onError?: (error: string) => void;
  requirements?: PasswordRequirement[];
  className?: string;
}

interface PasswordRequirement {
  rule: string;
  description: string;
  validator: (password: string) => boolean;
}
```

**Usage:**
```tsx
import { PasswordCreationStep } from '@/components/auth/PasswordCreationStep';

function PasswordStep() {
  const requirements = [
    {
      rule: 'minLength',
      description: 'At least 8 characters',
      validator: (pwd) => pwd.length >= 8
    },
    {
      rule: 'uppercase',
      description: 'One uppercase letter',
      validator: (pwd) => /[A-Z]/.test(pwd)
    }
  ];

  return (
    <PasswordCreationStep 
      onPasswordCreated={(password) => {
        completeSignup(password);
      }}
      requirements={requirements}
    />
  );
}
```

**Features:**
- Real-time password validation
- Strength indicator
- Requirement checklist
- Password confirmation
- Show/hide toggle

---

### SignupProgress

Progress indicator for multi-step flows.

**Props:**
```typescript
interface SignupProgressProps {
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
  showLabels?: boolean;
  className?: string;
}
```

**Usage:**
```tsx
import { SignupProgress } from '@/components/auth/SignupProgress';

function SignupWithProgress() {
  const [currentStep, setCurrentStep] = useState(1);
  
  return (
    <div>
      <SignupProgress 
        currentStep={currentStep}
        totalSteps={4}
        stepLabels={['Phone', 'Verify', 'Email', 'Password']}
        showLabels={true}
      />
      {/* Step content */}
    </div>
  );
}
```

**Features:**
- Visual progress bar
- Step labels
- Completed step indicators
- Responsive design
- Customizable styling

## Pricing Components

### PricingDisplay

Main pricing display component with database integration.

**Props:**
```typescript
interface PricingDisplayProps {
  onPlanSelect?: (plan: PricingPlan) => void;
  showComparison?: boolean;
  highlightPlan?: string;
  className?: string;
}

interface PricingPlan {
  id: string;
  name: string;
  price: number;
  features: string[];
  limits: Record<string, number>;
  popular?: boolean;
}
```

**Usage:**
```tsx
import { PricingDisplay } from '@/components/pricing/PricingDisplay';

function PricingPage() {
  return (
    <PricingDisplay 
      onPlanSelect={(plan) => {
        router.push(`/checkout?plan=${plan.id}`);
      }}
      showComparison={true}
      highlightPlan="pro"
    />
  );
}
```

**Features:**
- Database-driven pricing
- Fallback pricing on error
- Plan comparison
- Feature highlighting
- Responsive cards
- Loading states

**Data Flow:**
1. Fetches pricing from API
2. Displays loading state
3. Renders pricing cards
4. Falls back to default pricing on error

---

### PricingFallback

Fallback pricing component for error scenarios.

**Props:**
```typescript
interface PricingFallbackProps {
  onRetry?: () => void;
  showRetryButton?: boolean;
  fallbackPlans?: PricingPlan[];
  className?: string;
}
```

**Usage:**
```tsx
import { PricingFallback } from '@/components/pricing/PricingFallback';

function PricingWithFallback() {
  const [showFallback, setShowFallback] = useState(false);

  if (showFallback) {
    return (
      <PricingFallback 
        onRetry={() => {
          setShowFallback(false);
          refetchPricing();
        }}
        showRetryButton={true}
      />
    );
  }

  return <PricingDisplay />;
}
```

**Features:**
- Default pricing plans
- Retry functionality
- Error messaging
- Graceful degradation

---

### PricingContainer

Container component with error handling and loading states.

**Props:**
```typescript
interface PricingContainerProps {
  children?: React.ReactNode;
  onError?: (error: Error) => void;
  loadingComponent?: React.ComponentType;
  errorComponent?: React.ComponentType<{error: Error}>;
}
```

**Usage:**
```tsx
import { PricingContainer } from '@/components/pricing/PricingContainer';

function PricingSection() {
  return (
    <PricingContainer 
      onError={(error) => {
        console.error('Pricing error:', error);
        analytics.track('pricing_error', { error: error.message });
      }}
      loadingComponent={CustomLoader}
      errorComponent={CustomError}
    >
      <PricingDisplay />
    </PricingContainer>
  );
}
```

**Features:**
- Error boundary
- Loading state management
- Custom error/loading components
- Analytics integration

## Common Components

### ErrorBoundary

React error boundary for graceful error handling.

**Props:**
```typescript
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{error: Error}>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}
```

**Usage:**
```tsx
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary 
      onError={(error, errorInfo) => {
        console.error('App error:', error, errorInfo);
        // Send to error reporting service
      }}
      fallback={CustomErrorPage}
    >
      <Router>
        <Routes />
      </Router>
    </ErrorBoundary>
  );
}
```

---

### LoadingSpinner

Reusable loading spinner component.

**Props:**
```typescript
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  text?: string;
  className?: string;
}
```

**Usage:**
```tsx
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

function LoadingState() {
  return (
    <LoadingSpinner 
      size="lg"
      text="Loading pricing plans..."
      className="my-8"
    />
  );
}
```

---

### SecureForm

Secure form wrapper with validation and CSRF protection.

**Props:**
```typescript
interface SecureFormProps {
  children: React.ReactNode;
  onSubmit: (data: FormData) => void;
  validation?: ValidationSchema;
  csrfToken?: string;
  className?: string;
}
```

**Usage:**
```tsx
import { SecureForm } from '@/components/common/SecureForm';

function LoginForm() {
  return (
    <SecureForm 
      onSubmit={(data) => {
        // Handle secure form submission
      }}
      validation={loginValidationSchema}
      csrfToken={csrfToken}
    >
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <button type="submit">Login</button>
    </SecureForm>
  );
}
```

## Hooks

### useAuth

Authentication state management hook.

```typescript
interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

function useAuth(): UseAuthReturn;
```

**Usage:**
```tsx
import { useAuth } from '@/hooks/useAuth';

function Dashboard() {
  const { user, isAuthenticated, logout } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div>
      <h1>Welcome, {user?.name}</h1>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
```

---

### usePricing

Pricing data management hook.

```typescript
interface UsePricingReturn {
  plans: PricingPlan[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

function usePricing(): UsePricingReturn;
```

**Usage:**
```tsx
import { usePricing } from '@/hooks/usePricing';

function PricingSection() {
  const { plans, isLoading, error, refetch } = usePricing();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <PricingFallback onRetry={refetch} />;

  return (
    <div>
      {plans.map(plan => (
        <PricingCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}
```

## Styling and Theming

### CSS Classes

Components use Tailwind CSS with consistent class naming:

```css
/* Authentication components */
.auth-container { @apply max-w-md mx-auto p-6 bg-white rounded-lg shadow-md; }
.auth-input { @apply w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500; }
.auth-button { @apply w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500; }
.auth-error { @apply text-red-600 text-sm mt-1; }

/* Pricing components */
.pricing-card { @apply bg-white rounded-lg shadow-md p-6 border border-gray-200; }
.pricing-popular { @apply border-blue-500 relative; }
.pricing-price { @apply text-3xl font-bold text-gray-900; }
.pricing-feature { @apply flex items-center text-gray-600; }
```

### Theme Support

Components support light/dark themes:

```tsx
// Theme context
const ThemeContext = createContext<{
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}>({
  theme: 'light',
  toggleTheme: () => {}
});

// Usage in components
function ThemedComponent() {
  const { theme } = useContext(ThemeContext);
  
  return (
    <div className={`auth-container ${theme === 'dark' ? 'dark' : ''}`}>
      {/* Component content */}
    </div>
  );
}
```

## Accessibility

### ARIA Labels

All components include proper ARIA labels:

```tsx
<input 
  type="tel"
  id="phone"
  aria-label="Phone number"
  aria-required="true"
  aria-describedby="phone-error"
/>
<div id="phone-error" role="alert" aria-live="polite">
  {error && <span>{error}</span>}
</div>
```

### Keyboard Navigation

Components support full keyboard navigation:

- Tab order follows logical flow
- Enter/Space activate buttons
- Escape closes modals
- Arrow keys navigate options

### Screen Reader Support

- Form labels are properly associated
- Error messages are announced
- Loading states are communicated
- Progress is announced

## Testing

### Component Testing

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhoneSignupFlow } from '../PhoneSignupFlow';

describe('PhoneSignupFlow', () => {
  it('should complete signup flow', async () => {
    const user = userEvent.setup();
    const onComplete = jest.fn();
    
    render(<PhoneSignupFlow onComplete={onComplete} />);
    
    // Enter phone number
    const phoneInput = screen.getByLabelText(/phone number/i);
    await user.type(phoneInput, '+1234567890');
    
    // Submit form
    const submitButton = screen.getByRole('button', { name: /send otp/i });
    await user.click(submitButton);
    
    // Verify API call
    await waitFor(() => {
      expect(mockApiCall).toHaveBeenCalledWith('/api/auth/signup/phone/start', {
        phone: '+1234567890'
      });
    });
  });
});
```

### Integration Testing

```tsx
import { render, screen } from '@testing-library/react';
import { AuthProvider } from '../AuthProvider';
import { PricingDisplay } from '../PricingDisplay';

describe('Pricing Integration', () => {
  it('should display pricing for authenticated users', async () => {
    render(
      <AuthProvider>
        <PricingDisplay />
      </AuthProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Free Plan')).toBeInTheDocument();
      expect(screen.getByText('Pro Plan')).toBeInTheDocument();
    });
  });
});
```

## Performance Optimization

### Code Splitting

```tsx
import { lazy, Suspense } from 'react';

const PhoneSignupFlow = lazy(() => import('./PhoneSignupFlow'));
const Auth0SignupFlow = lazy(() => import('./Auth0SignupFlow'));

function SignupPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      {method === 'phone' && <PhoneSignupFlow />}
      {method === 'auth0' && <Auth0SignupFlow />}
    </Suspense>
  );
}
```

### Memoization

```tsx
import { memo, useMemo } from 'react';

const PricingCard = memo(({ plan }: { plan: PricingPlan }) => {
  const formattedPrice = useMemo(() => 
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(plan.price),
    [plan.price]
  );

  return (
    <div className="pricing-card">
      <h3>{plan.name}</h3>
      <p>{formattedPrice}</p>
    </div>
  );
});
```

## Error Handling

### Error Types

```typescript
interface AuthError {
  code: string;
  message: string;
  field?: string;
  retryable?: boolean;
}

interface PricingError {
  code: string;
  message: string;
  fallbackAvailable?: boolean;
}
```

### Error Display

```tsx
function ErrorDisplay({ error, onRetry }: { 
  error: AuthError; 
  onRetry?: () => void; 
}) {
  return (
    <div role="alert" className="auth-error">
      <p>{error.message}</p>
      {error.retryable && onRetry && (
        <button onClick={onRetry}>Try Again</button>
      )}
    </div>
  );
}
```

## Deployment Considerations

### Environment Variables

```typescript
// Component configuration
const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  auth0Domain: process.env.NEXT_PUBLIC_AUTH0_DOMAIN,
  auth0ClientId: process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID,
  enableAnalytics: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true'
};
```

### Bundle Analysis

```bash
# Analyze bundle size
npm run build:analyze

# Check component sizes
npx webpack-bundle-analyzer .next/static/chunks/*.js
```

### Performance Monitoring

```tsx
import { usePerformanceMonitoring } from '@/hooks/usePerformanceMonitoring';

function MonitoredComponent() {
  const { startTiming, endTiming } = usePerformanceMonitoring();
  
  useEffect(() => {
    startTiming('component-render');
    return () => endTiming('component-render');
  }, []);
  
  return <div>Component content</div>;
}
```