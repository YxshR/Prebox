# Client-Side Security Implementation

This document outlines the comprehensive client-side security protections implemented for the home page redesign project.

## Overview

The security implementation includes four main components:
1. **Input Validation and Sanitization** - Prevents malicious input and ensures data integrity
2. **Content Security Policy (CSP)** - Prevents XSS attacks through HTTP headers
3. **Error Boundaries** - Graceful handling of component failures
4. **Rate Limiting** - Protection against abuse and DoS attacks

## 1. Input Validation and Sanitization

### Files
- `src/lib/security.ts` - Core security utilities
- `src/components/common/SecureForm.tsx` - Secure form component
- `src/lib/__tests__/security.test.ts` - Comprehensive tests

### Features

#### Input Validators
```typescript
import { InputValidator } from '../lib/security';

// Email validation
const emailResult = InputValidator.validateEmail('user@example.com');
if (!emailResult.isValid) {
  console.error(emailResult.error);
}

// Phone validation
const phoneResult = InputValidator.validatePhone('+1234567890');

// Password strength validation
const passwordResult = InputValidator.validatePassword('StrongPass123!');

// OTP validation
const otpResult = InputValidator.validateOTP('123456');
```

#### Input Sanitizers
```typescript
import { InputSanitizer } from '../lib/security';

// Sanitize HTML content
const cleanHtml = InputSanitizer.sanitizeHtml('<script>alert("xss")</script>Hello');

// Sanitize text input
const cleanText = InputSanitizer.sanitizeText('  <script>alert("xss")</script>Hello  ');

// Sanitize email
const cleanEmail = InputSanitizer.sanitizeEmail('  TEST@EXAMPLE.COM  ');

// Sanitize phone number
const cleanPhone = InputSanitizer.sanitizePhone('+1 (234) 567-8900 ext123');

// Sanitize OTP
const cleanOTP = InputSanitizer.sanitizeOTP('12a34b56');
```

#### Secure Form Processing
```typescript
import { SecureFormProcessor } from '../lib/security';

const formData = { email: 'test@example.com', name: 'John Doe' };
const validationRules = {
  email: (value: string) => InputValidator.validateEmail(value),
  name: (value: string) => InputValidator.validateName(value)
};

const result = SecureFormProcessor.processFormData(formData, validationRules);
if (result.isValid) {
  // Use result.sanitizedData
} else {
  // Handle result.errors
}
```

### Usage with React Hook Form

```typescript
import { SecureForm, SecureInput } from '../components/common/SecureForm';

function MyForm() {
  const handleSubmit = async (data: FormData) => {
    // Data is automatically validated and sanitized
    console.log('Secure data:', data);
  };

  return (
    <SecureForm
      onSubmit={handleSubmit}
      fieldConfigs={{
        email: { type: 'email', required: true },
        phone: { type: 'phone', required: true },
        otp: { type: 'otp', required: true }
      }}
      securityConfig={{
        enableRateLimiting: true,
        maxSubmissions: 5,
        rateLimitWindowMs: 300000
      }}
    >
      <SecureInput
        name="email"
        label="Email Address"
        securityType="email"
        showSecurityIndicator={true}
      />
      <SecureInput
        name="phone"
        label="Phone Number"
        securityType="phone"
        showSecurityIndicator={true}
      />
      <SecureInput
        name="otp"
        label="Verification Code"
        securityType="otp"
        showSecurityIndicator={true}
      />
      <button type="submit">Submit</button>
    </SecureForm>
  );
}
```

## 2. Content Security Policy (CSP)

### Implementation
CSP headers are configured in `next.config.ts` to prevent XSS attacks:

```typescript
// next.config.ts
async headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            "connect-src 'self' https://api.* ws: wss:",
            "media-src 'self' https:",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'",
            "upgrade-insecure-requests"
          ].join('; ')
        },
        // Additional security headers...
      ]
    }
  ];
}
```

### Security Headers Included
- **Content-Security-Policy** - Prevents XSS attacks
- **X-Content-Type-Options** - Prevents MIME type sniffing
- **X-Frame-Options** - Prevents clickjacking
- **X-XSS-Protection** - Browser XSS protection
- **Referrer-Policy** - Controls referrer information
- **Permissions-Policy** - Restricts browser features
- **Strict-Transport-Security** - Enforces HTTPS

## 3. Error Boundaries

### Files
- `src/components/common/ErrorBoundary.tsx` - Error boundary implementations

### Components

#### Page Error Boundary
```typescript
import { PageErrorBoundary } from '../components/common/ErrorBoundary';

function App() {
  return (
    <PageErrorBoundary>
      <YourPageContent />
    </PageErrorBoundary>
  );
}
```

#### Form Error Boundary
```typescript
import { FormErrorBoundary } from '../components/common/ErrorBoundary';

function MyForm() {
  return (
    <FormErrorBoundary>
      <form>
        {/* Form content */}
      </form>
    </FormErrorBoundary>
  );
}
```

#### Component Error Boundary
```typescript
import { ComponentErrorBoundary } from '../components/common/ErrorBoundary';

function MyComponent() {
  return (
    <ComponentErrorBoundary componentName="MyComponent">
      <SomeComplexComponent />
    </ComponentErrorBoundary>
  );
}
```

#### Higher-Order Component
```typescript
import { withErrorBoundary } from '../components/common/ErrorBoundary';

const SafeComponent = withErrorBoundary(MyComponent, {
  showDetails: process.env.NODE_ENV === 'development'
});
```

#### Async Error Handling
```typescript
import { useAsyncErrorBoundary } from '../components/common/ErrorBoundary';

function MyComponent() {
  const throwError = useAsyncErrorBoundary();

  const handleAsyncOperation = async () => {
    try {
      await riskyAsyncOperation();
    } catch (error) {
      throwError(error); // This will be caught by the error boundary
    }
  };
}
```

### Features
- **Automatic Error Logging** - All errors are logged for security monitoring
- **Graceful Fallback UI** - User-friendly error messages
- **Development Details** - Detailed error information in development mode
- **Error Recovery** - Retry and reload options
- **Security Event Tracking** - Integration with security logging system

## 4. Rate Limiting

### Files
- `src/lib/secureApiClient.ts` - Secure API client with rate limiting
- `src/lib/securityMiddleware.ts` - Security middleware

### Client-Side Rate Limiting
```typescript
import { ClientRateLimiter } from '../lib/security';

// Check if request is allowed
const isAllowed = ClientRateLimiter.isAllowed('api-endpoint', 10, 60000);
if (!isAllowed) {
  console.log('Rate limit exceeded');
  return;
}

// Get remaining requests
const remaining = ClientRateLimiter.getRemainingRequests('api-endpoint', 10, 60000);
console.log(`${remaining} requests remaining`);
```

### Secure API Client
```typescript
import { secureApiClient } from '../lib/secureApiClient';

// Automatic rate limiting and security validation
const response = await secureApiClient.post('/auth/login', {
  email: 'user@example.com',
  password: 'password'
});

// Custom rate limiting
const response = await secureApiClient.post('/auth/send-otp', data, {
  customRateLimit: { maxRequests: 3, windowMs: 60000 }
});
```

### Rate Limit Configuration
Different endpoints have different rate limits:

```typescript
const RATE_LIMITS = {
  '/auth/login': { maxRequests: 5, windowMs: 300000 }, // 5 per 5 minutes
  '/auth/register': { maxRequests: 3, windowMs: 300000 }, // 3 per 5 minutes
  '/auth/send-otp': { maxRequests: 3, windowMs: 60000 }, // 3 per minute
  '/auth/verify-otp': { maxRequests: 5, windowMs: 300000 }, // 5 per 5 minutes
  default: { maxRequests: 30, windowMs: 60000 } // 30 per minute
};
```

## 5. Security Monitoring

### Files
- `src/components/common/SecurityMonitor.tsx` - Security monitoring UI
- `src/lib/securityMiddleware.ts` - Security middleware and monitoring

### Security Monitor Component
```typescript
import { SecurityMonitor } from '../components/common/SecurityMonitor';

function App() {
  return (
    <div>
      <YourAppContent />
      {/* Only shows in development by default */}
      <SecurityMonitor position="bottom-left" minimized={true} />
    </div>
  );
}
```

### Security Status Indicator
```typescript
import { SecurityStatus } from '../components/common/SecurityMonitor';

function Header() {
  return (
    <header>
      <SecurityStatus className="ml-4" />
    </header>
  );
}
```

### Security Monitoring Hook
```typescript
import { useSecurityMonitoring } from '../components/common/SecurityMonitor';

function AdminDashboard() {
  const { metrics, logs, clearLogs } = useSecurityMonitoring();

  return (
    <div>
      <h2>Security Metrics</h2>
      <p>Total Requests: {metrics.totalRequests}</p>
      <p>Failed Requests: {metrics.failedRequests}</p>
      <p>Rate Limited: {metrics.rateLimitedRequests}</p>
      <p>Suspicious Activities: {metrics.suspiciousActivities}</p>
      
      <button onClick={clearLogs}>Clear Logs</button>
    </div>
  );
}
```

## 6. Integration with Authentication

The security system is fully integrated with the authentication API:

```typescript
// src/lib/auth.ts - Enhanced with security features
export const authApi = {
  register: async (data: RegisterData): Promise<RegisterResponse> => {
    // Automatic input validation
    const emailValidation = InputValidator.validateEmail(data.email);
    if (!emailValidation.isValid) {
      throw new Error(emailValidation.error);
    }

    // Security logging
    SecurityLogger.log('AUTH_REGISTER_ATTEMPT', 'User registration attempt', {
      email: data.email
    });

    // Secure API call with rate limiting
    const response = await secureApiClient.post('/auth/register', data);
    
    // ... rest of implementation
  }
};
```

## 7. Testing

### Running Security Tests
```bash
npm test -- src/lib/__tests__/security.test.ts
```

### Test Coverage
- Input validation for all supported types
- Input sanitization functions
- Rate limiting functionality
- Form processing security
- Security logging
- Integration workflows

## 8. Configuration

### Environment Variables
```env
# Development security settings
NEXT_PUBLIC_SECURITY_LOGGING=true
NEXT_PUBLIC_RATE_LIMITING=true
NEXT_PUBLIC_SHOW_SECURITY_MONITOR=true
```

### Security Configuration
```typescript
// Custom security configuration
const securityConfig = {
  enableRateLimiting: true,
  enableInputSanitization: true,
  enableSecurityLogging: true,
  customRateLimits: {
    '/api/sensitive': { maxRequests: 5, windowMs: 300000 }
  }
};

const secureClient = createSecureApiClient(securityConfig);
```

## 9. Best Practices

### Form Security
1. Always use `SecureForm` for user input
2. Define proper field configurations
3. Enable rate limiting for sensitive forms
4. Use appropriate input types (email, phone, otp, etc.)

### API Security
1. Use `secureApiClient` for all API calls
2. Implement proper error handling
3. Log security events appropriately
4. Configure rate limits based on endpoint sensitivity

### Component Security
1. Wrap components with appropriate error boundaries
2. Use security monitoring in development
3. Validate all props and state
4. Handle errors gracefully

### Data Security
1. Sanitize all user input
2. Validate data on both client and server
3. Use secure storage for sensitive data
4. Implement proper session management

## 10. Monitoring and Alerts

### Security Events Logged
- Authentication attempts (success/failure)
- Rate limit violations
- Input validation failures
- Component errors
- Suspicious activity patterns
- API request failures

### Development Monitoring
- Real-time security monitor
- Security status indicators
- Detailed logging in development mode
- Performance metrics

### Production Considerations
- Security events should be sent to monitoring service
- Rate limiting should be coordinated with server-side limits
- Error boundaries should not expose sensitive information
- CSP violations should be reported and monitored

## 11. Troubleshooting

### Common Issues

#### CSP Violations
If you encounter CSP violations:
1. Check the browser console for specific violations
2. Update the CSP policy in `next.config.ts`
3. Ensure inline scripts/styles are properly handled

#### Rate Limiting Issues
If rate limiting is too restrictive:
1. Adjust limits in `secureApiClient.ts`
2. Clear rate limit data: `ClientRateLimiter.clearAll()`
3. Check for proper key generation

#### Form Validation Errors
If forms aren't validating properly:
1. Check field configurations in `SecureForm`
2. Verify validation rules are properly defined
3. Ensure proper error handling

### Debug Mode
Enable debug logging in development:
```typescript
SecurityLogger.log('DEBUG', 'Debug information', { data: 'debug' });
```

## 12. Future Enhancements

### Planned Improvements
1. **Biometric Authentication** - Integration with WebAuthn
2. **Advanced Threat Detection** - ML-based anomaly detection
3. **Real-time Security Dashboard** - Enhanced monitoring UI
4. **Automated Security Testing** - Continuous security validation
5. **Security Compliance Reports** - Automated compliance checking

### Integration Opportunities
1. **Server-side Coordination** - Sync client/server rate limits
2. **Security Analytics** - Advanced security metrics
3. **Incident Response** - Automated security incident handling
4. **User Behavior Analysis** - Security-focused user analytics

This comprehensive security implementation provides multiple layers of protection while maintaining a good user experience. All components are thoroughly tested and documented for easy maintenance and extension.