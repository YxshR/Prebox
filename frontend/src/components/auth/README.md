# Multi-Step Phone Signup Components

This directory contains the frontend components for the multi-step phone signup flow as specified in the authentication system rebuild requirements.

## Components Overview

### 1. PhoneSignupFlow (Orchestrator)
The main orchestrator component that manages the entire 3-step signup process.

**Features:**
- State management for the entire signup flow
- Step navigation and progress tracking
- Error handling and loading states
- Animated transitions between steps

**Usage:**
```tsx
import { PhoneSignupFlow } from '@/components/auth';

<PhoneSignupFlow
  onComplete={(userData) => {
    console.log('Signup completed:', userData);
    // Handle successful signup
  }}
  onCancel={() => {
    // Handle signup cancellation
  }}
/>
```

### 2. PhoneVerificationStep
Handles phone number input and OTP verification.

**Features:**
- Phone number formatting (US format)
- Phone number validation
- OTP input with 6-digit validation
- Duplicate phone number error handling
- Resend OTP functionality
- API integration for phone verification

**API Endpoints:**
- `POST /api/auth/signup/phone/start` - Start phone verification
- `POST /api/auth/signup/phone/verify` - Verify OTP

### 3. EmailVerificationStep
Manages email address input and verification code validation.

**Features:**
- Email validation
- Email verification code input
- Duplicate email error handling
- Resend verification code functionality
- API integration for email verification

**API Endpoints:**
- `POST /api/auth/signup/email/start` - Start email verification
- `POST /api/auth/signup/email/verify` - Verify email code

### 4. PasswordCreationStep
Final step for password creation with strength validation.

**Features:**
- Password strength indicator
- Real-time password validation
- Password confirmation matching
- Security requirements display
- Show/hide password toggle
- API integration for account completion

**Password Requirements:**
- At least 8 characters
- One uppercase letter
- One lowercase letter
- One number
- One special character

**API Endpoints:**
- `POST /api/auth/signup/complete` - Complete signup with password

### 5. SignupProgress
Visual progress indicator for the multi-step flow.

**Features:**
- Animated progress bar
- Step completion indicators
- Step labels
- Responsive design

## Requirements Mapping

The components fulfill the following requirements from the specification:

### Requirement 1.1 - Multi-Step Flow
- ✅ 3-step process: Phone → Email → Password
- ✅ Visual progress indication
- ✅ Step navigation

### Requirement 1.2 - Phone Verification
- ✅ Phone number input and validation
- ✅ Duplicate phone number checking
- ✅ OTP generation and verification
- ✅ SMS integration ready

### Requirement 1.3 - OTP Handling
- ✅ 6-digit OTP input
- ✅ OTP validation
- ✅ Retry mechanism
- ✅ Resend functionality

### Requirement 1.4 - Error Handling
- ✅ Constraint violation errors
- ✅ Network error handling
- ✅ User-friendly error messages
- ✅ Retry mechanisms

### Requirement 1.5 - Rate Limiting Ready
- ✅ Components handle rate limiting responses
- ✅ Appropriate error messages for rate limits

### Requirement 1.6 - Email Verification
- ✅ Email input and validation
- ✅ Duplicate email checking
- ✅ Email verification code system

### Requirement 1.7 - Email Code Verification
- ✅ 6-digit email verification code
- ✅ Code validation
- ✅ Resend functionality

### Requirement 1.8 - Complete Signup
- ✅ Password creation with validation
- ✅ Account completion
- ✅ Automatic login after signup

## State Management

The `PhoneSignupFlow` component manages the following state:

```typescript
interface PhoneSignupState {
  step: 'phone' | 'email' | 'password' | 'complete';
  phone: string;
  email: string;
  password: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  loading: boolean;
  error: string | null;
}
```

## Error Handling

All components implement comprehensive error handling:

- **Network Errors**: Connection issues, timeouts
- **Validation Errors**: Invalid input formats
- **Constraint Violations**: Duplicate phone/email
- **API Errors**: Server-side validation failures
- **Rate Limiting**: Too many requests

## Styling

Components use:
- Tailwind CSS for styling
- Framer Motion for animations
- Consistent design system with existing UI components
- Responsive design for mobile and desktop

## Testing

The components are designed to be easily testable:
- Props-based configuration
- Callback functions for events
- Separated concerns for each step
- Mock-friendly API calls

## Integration

To integrate with the existing authentication system:

1. Import the components:
```tsx
import { PhoneSignupFlow } from '@/components/auth';
```

2. Handle the completion callback:
```tsx
const handleSignupComplete = async (userData) => {
  // Store tokens, redirect user, etc.
  localStorage.setItem('accessToken', userData.token);
  router.push('/dashboard');
};
```

3. Add to your routing system:
```tsx
// In your auth pages
<PhoneSignupFlow
  onComplete={handleSignupComplete}
  onCancel={() => router.push('/auth/login')}
/>
```

## API Integration

The components expect the following API responses:

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* relevant data */ }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE"
}
```

### Duplicate Error (409)
```json
{
  "success": false,
  "message": "Phone number already registered",
  "code": "DUPLICATE_PHONE"
}
```

## Future Enhancements

Potential improvements:
- Biometric authentication integration
- Social login options in the flow
- Progressive web app features
- Accessibility improvements
- Internationalization support