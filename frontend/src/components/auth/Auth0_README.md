# Auth0 Signup Components

This directory contains Auth0 integration components for secure user authentication and signup flows.

## Components

### Auth0SignupFlow
Main component that orchestrates the Auth0 signup process with optional phone verification.

**Features:**
- Auth0 SDK integration
- Multi-step signup flow
- Phone verification integration
- Progress indicator
- Error handling and user feedback
- Responsive design

**Props:**
- `onComplete`: Callback when signup is completed
- `onCancel`: Optional callback for cancellation

**Usage:**
```tsx
import { Auth0SignupFlow } from '@/components/auth';

<Auth0SignupFlow
  onComplete={(userData) => {
    console.log('Signup completed:', userData);
  }}
  onCancel={() => {
    console.log('Signup cancelled');
  }}
/>
```

### Auth0Callback
Handles Auth0 authentication redirects and callback processing.

**Features:**
- Automatic callback handling
- Error state management
- Loading states
- Automatic routing after success
- User-friendly error messages

**Props:**
- `onSuccess`: Optional callback for successful authentication
- `onError`: Optional callback for authentication errors
- `redirectTo`: Route to redirect to after success (default: '/dashboard')

**Usage:**
```tsx
import { Auth0Callback } from '@/components/auth';

<Auth0Callback
  onSuccess={(user) => console.log('Auth successful:', user)}
  onError={(error) => console.error('Auth error:', error)}
  redirectTo="/dashboard"
/>
```

### PhoneVerificationForAuth0
Phone verification component specifically designed for Auth0 users.

**Features:**
- Phone number formatting and validation
- OTP verification with Auth0 context
- Integration with existing auth API
- Resend functionality
- Auth0 user metadata updates

**Props:**
- `onVerified`: Callback when phone is verified
- `onBack`: Callback for back navigation
- `onError`: Error callback
- `onLoading`: Loading state callback
- `loading`: Current loading state
- `error`: Current error message
- `auth0User`: Auth0 user object

### Auth0ProviderWrapper
Wrapper component that provides Auth0 context to child components.

**Features:**
- Client-side only rendering
- Automatic configuration
- Redirect callback handling
- Environment-based configuration

**Usage:**
```tsx
import { Auth0ProviderWrapper } from '@/components/auth';

<Auth0ProviderWrapper>
  <YourApp />
</Auth0ProviderWrapper>
```

## Configuration

### Environment Variables
Add these to your `.env.local` file:

```env
NEXT_PUBLIC_AUTH0_DOMAIN=your-auth0-domain.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=your-auth0-client-id
NEXT_PUBLIC_AUTH0_AUDIENCE=your-auth0-api-audience
```

### Auth0 Setup
1. Create an Auth0 application
2. Configure allowed callback URLs: `http://localhost:3000/auth/callback`
3. Configure allowed logout URLs: `http://localhost:3000`
4. Enable phone number verification in Auth0 dashboard
5. Configure API audience if using Auth0 APIs

## Integration Examples

### Basic Signup Flow
```tsx
'use client';

import { Auth0ProviderWrapper, Auth0SignupFlow } from '@/components/auth';

export default function SignupPage() {
  return (
    <Auth0ProviderWrapper>
      <Auth0SignupFlow
        onComplete={(userData) => {
          // Handle successful signup
          console.log('User signed up:', userData);
        }}
      />
    </Auth0ProviderWrapper>
  );
}
```

### Callback Page
```tsx
'use client';

import { Auth0ProviderWrapper, Auth0Callback } from '@/components/auth';

export default function CallbackPage() {
  return (
    <Auth0ProviderWrapper>
      <Auth0Callback redirectTo="/dashboard" />
    </Auth0ProviderWrapper>
  );
}
```

## Error Handling

The components include comprehensive error handling for:
- Auth0 authentication failures
- Network connectivity issues
- Phone verification errors
- Invalid input validation
- Token expiration

Error messages are user-friendly and provide actionable feedback.

## Security Features

- Secure token handling
- Input validation and sanitization
- Rate limiting for OTP requests
- Security event logging
- CSRF protection
- Secure redirect handling

## Testing

Run the test suite:
```bash
npm test Auth0Components.test.tsx
```

The tests cover:
- Component rendering
- User interactions
- Error states
- Success flows
- Auth0 integration
- Phone verification

## Dependencies

- `@auth0/auth0-react`: Auth0 React SDK
- `framer-motion`: Animations
- `react-hook-form`: Form handling (inherited)
- Custom UI components (Button, Input)

## Browser Support

- Modern browsers with ES6+ support
- Mobile responsive design
- Progressive enhancement for older browsers