# Auth0 Integration Implementation

This document describes the Auth0 integration implementation for the bulk email platform authentication system.

## Overview

The Auth0 integration provides social authentication with phone verification as a secondary step. Users can sign up using Auth0 (Google, Facebook, etc.) and then verify their phone number to complete the registration process.

## Architecture

```
Frontend → Auth0 → Backend API → Database
    ↓         ↓         ↓           ↓
  User    Profile   User Mgmt   Persistence
```

## Implementation Files

### Core Service
- `auth0.service.ts` - Main Auth0 integration service
- `auth0.routes.ts` - API endpoints for Auth0 flows
- `auth0.service.test.ts` - Unit tests
- `auth0.integration.test.ts` - Integration tests
- `auth0.error-scenarios.test.ts` - Error handling tests

### Database Schema
- `auth0_profiles` table - Stores Auth0 profile data
- `users` table - Extended with `auth0_id` field

## API Endpoints

### Authentication Flow

#### 1. Get Authorization URL
```http
GET /api/auth/auth0/signup
GET /api/auth/auth0/login
```

**Response:**
```json
{
  "success": true,
  "data": {
    "authUrl": "https://domain.auth0.com/authorize?..."
  }
}
```

#### 2. Handle Callback
```http
GET /api/auth/auth0/callback?code=...&state=...
```

**Behavior:**
- New users: Redirects to phone verification page
- Existing users: Redirects to success page with tokens

#### 3. Complete Signup (Phone Verification)
```http
POST /api/auth/auth0/complete-signup
Authorization: Bearer <token>
```

**Request:**
```json
{
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "otpId": "uuid"
  }
}
```

#### 4. Verify Phone Number
```http
POST /api/auth/auth0/verify-phone
```

**Request:**
```json
{
  "otpId": "uuid",
  "code": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "jwt-token",
    "refreshToken": "refresh-token",
    "user": { ... }
  }
}
```

### Profile Management

#### Get Auth0 Profile
```http
GET /api/auth/auth0/profile
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "profile": {
      "id": "uuid",
      "userId": "uuid",
      "auth0Id": "auth0|123456789",
      "profileData": { ... }
    }
  }
}
```

## Environment Configuration

Required environment variables:

```bash
# Auth0 Configuration
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_CALLBACK_URL=http://localhost:8000/api/auth/auth0/callback
AUTH0_SUCCESS_REDIRECT=http://localhost:3000/auth/success
AUTH0_ERROR_REDIRECT=http://localhost:3000/auth/error
```

## Database Schema

### Users Table Extension
```sql
ALTER TABLE users ADD COLUMN auth0_id VARCHAR(255) UNIQUE;
CREATE INDEX idx_users_auth0_id ON users(auth0_id) WHERE auth0_id IS NOT NULL;
```

### Auth0 Profiles Table
```sql
CREATE TABLE auth0_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    auth0_id VARCHAR(255) NOT NULL UNIQUE,
    profile_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## User Flow

### New User Signup
1. User clicks "Sign up with Auth0"
2. Frontend redirects to Auth0 authorization URL
3. User authenticates with Auth0 provider
4. Auth0 redirects to callback endpoint
5. Backend creates user account with Auth0 profile
6. User is redirected to phone verification page
7. User enters phone number and receives OTP
8. User verifies OTP and completes signup
9. User is logged in with JWT tokens

### Existing User Login
1. User clicks "Login with Auth0"
2. Frontend redirects to Auth0 authorization URL
3. User authenticates with Auth0 provider
4. Auth0 redirects to callback endpoint
5. Backend finds existing user by Auth0 ID
6. User is redirected to success page with tokens

### Account Linking
If a user signs up with Auth0 using an email that already exists:
1. Backend links the Auth0 ID to existing account
2. User may need phone verification if not already verified
3. User is logged in to existing account

## Error Handling

### Auth0 Errors
- `access_denied` - User cancelled authentication
- `invalid_request` - Malformed request
- `server_error` - Auth0 service error

### Application Errors
- `PHONE_ALREADY_EXISTS` - Phone number in use
- `OTP_EXPIRED` - Verification code expired
- `TOO_MANY_ATTEMPTS` - Rate limit exceeded
- `CALLBACK_FAILED` - Token exchange failed

## Security Features

### Data Protection
- Auth0 profile data stored as JSONB
- Sensitive data encrypted in database
- JWT tokens with user-specific secrets
- Phone number uniqueness constraints

### Rate Limiting
- OTP generation rate limiting
- Login attempt rate limiting
- API endpoint rate limiting

### Validation
- Phone number format validation
- Email format validation (via Auth0)
- Required field validation

## Testing

### Unit Tests
```bash
npm test -- auth0.service.test.ts
```

### Integration Tests
```bash
npm test -- auth0.integration.test.ts
```

### Error Scenario Tests
```bash
npm test -- auth0.error-scenarios.test.ts
```

### Manual Testing
```bash
npx ts-node src/auth/test-auth0-implementation.ts
```

## Frontend Integration

### React/Next.js Example
```typescript
// Redirect to Auth0
const handleAuth0Signup = async () => {
  const response = await fetch('/api/auth/auth0/signup');
  const { authUrl } = await response.json();
  window.location.href = authUrl;
};

// Handle callback
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const refresh = urlParams.get('refresh');
  
  if (token && refresh) {
    // Store tokens and redirect to dashboard
    localStorage.setItem('accessToken', token);
    localStorage.setItem('refreshToken', refresh);
    router.push('/dashboard');
  }
}, []);
```

## Monitoring and Logging

### Key Metrics
- Auth0 signup conversion rate
- Phone verification completion rate
- Authentication failure rate
- Token refresh rate

### Log Events
- Auth0 callback success/failure
- Phone verification attempts
- Account linking events
- Error scenarios

## Troubleshooting

### Common Issues

1. **Auth0 Configuration Error**
   - Verify environment variables
   - Check Auth0 application settings
   - Ensure callback URLs match

2. **Database Connection Issues**
   - Check database connectivity
   - Verify table schema
   - Check user permissions

3. **Phone Verification Failures**
   - Verify Twilio configuration
   - Check phone number format
   - Review rate limiting settings

### Debug Mode
Set `LOG_LEVEL=debug` to enable detailed logging.

## Performance Considerations

### Database Optimization
- Index on `auth0_id` for fast lookups
- JSONB indexing for profile data queries
- Connection pooling for concurrent requests

### Caching
- Redis caching for OTP codes
- Session caching for JWT tokens
- Profile data caching

### Rate Limiting
- Per-user rate limits for OTP requests
- Global rate limits for Auth0 callbacks
- Exponential backoff for failed attempts

## Security Checklist

- [ ] Auth0 client secret secured
- [ ] HTTPS enforced for all endpoints
- [ ] JWT tokens properly validated
- [ ] Phone numbers encrypted at rest
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] Error messages don't leak sensitive data
- [ ] Audit logging enabled

## Future Enhancements

1. **Multi-Factor Authentication**
   - TOTP support
   - Hardware key support
   - Biometric authentication

2. **Social Providers**
   - Additional OAuth providers
   - Enterprise SSO integration
   - Custom identity providers

3. **Advanced Features**
   - Account recovery flows
   - Profile synchronization
   - Advanced user management

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review the test files for examples
3. Check Auth0 documentation
4. Contact the development team