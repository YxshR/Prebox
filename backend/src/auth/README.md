# Authentication System

This module implements a comprehensive authentication system for the bulk email platform with the following features:

## Features Implemented

### ✅ User Registration API
- Email and password registration
- Phone number registration with Google OAuth
- Automatic Free tier assignment
- Input validation with Joi

### ✅ JWT Token Management
- Access token generation (15 minutes expiry)
- Refresh token generation (7 days expiry)
- Token validation and refresh
- Secure token storage in Redis

### ✅ Google OAuth Integration
- Google OAuth 2.0 signup/signin
- Automatic account linking for existing users
- Profile information extraction
- Secure callback handling

### ✅ Phone Number Verification
- OTP generation and sending via Twilio
- 6-digit OTP with 10-minute expiry
- Rate limiting (max 3 attempts per hour)
- Resend functionality with cooldown
- Mock mode for development

### ✅ Email Verification
- Secure token-based email verification
- HTML email templates with responsive design
- 24-hour token expiry
- Resend functionality with spam protection
- SMTP configuration support

### ✅ API Key Management
- Secure API key generation
- Scoped permissions
- Usage tracking
- Key rotation support

### ✅ Security Features
- Password hashing with bcrypt (12 rounds)
- Rate limiting and abuse prevention
- Secure session management
- Input validation and sanitization
- CORS protection

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token

### Verification
- `POST /api/auth/send-otp` - Send OTP to phone
- `POST /api/auth/verify-otp` - Verify OTP code
- `POST /api/auth/resend-otp` - Resend OTP
- `GET /api/auth/verify-email` - Verify email token
- `POST /api/auth/resend-email-verification` - Resend verification email

### OAuth
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/google/callback` - Google OAuth callback

### API Keys
- `POST /api/auth/api-keys` - Generate API key
- `GET /api/auth/me` - Get current user info

## Database Schema

### Users Table
- User credentials and profile information
- Email and phone verification status
- Google OAuth integration
- Subscription tier and role management

### Authentication Tables
- `api_keys` - API key management
- `otp_verifications` - Phone verification codes
- `email_verifications` - Email verification tokens

## Environment Variables

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Phone Verification (Twilio)
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3001/api/auth/google/callback

# Email Configuration
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
FROM_EMAIL=noreply@yourdomain.com

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

## Usage Examples

### User Registration
```javascript
const response = await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securePassword123',
    firstName: 'John',
    lastName: 'Doe',
    registrationMethod: 'email'
  })
});
```

### User Login
```javascript
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'securePassword123'
  })
});
```

### API Key Usage
```javascript
const response = await fetch('/api/campaigns', {
  headers: {
    'X-API-Key': 'bep_your_api_key_here'
  }
});
```

## Security Considerations

1. **Password Security**: Passwords are hashed using bcrypt with 12 salt rounds
2. **Token Security**: JWT tokens are signed and have appropriate expiry times
3. **Rate Limiting**: OTP requests are rate-limited to prevent abuse
4. **Input Validation**: All inputs are validated using Joi schemas
5. **CORS Protection**: Configured for specific frontend origins
6. **Session Management**: Refresh tokens are stored securely in Redis

## Testing

Run the authentication tests:
```bash
npm test -- --testPathPattern=auth.test.ts
```

## Requirements Satisfied

This implementation satisfies the following requirements from the specification:

- **Requirement 14.1**: Multiple authentication options (phone + Google, email)
- **Requirement 14.2**: Phone number verification with OTP
- **Requirement 14.3**: Email verification workflow
- **Requirement 8.4**: Secure authentication methods and session management

The authentication system is now ready for integration with the frontend applications and provides a solid foundation for the bulk email platform's security infrastructure.