# Authentication System API Documentation

## Overview

This document provides comprehensive documentation for the authentication system API endpoints. The API supports multiple authentication flows including multi-step phone signup, Auth0 integration, and various login methods.

## Base URL

```
Production: https://api.yourdomain.com
Development: http://localhost:3001
```

## Authentication

Most endpoints require authentication via JWT tokens in the Authorization header:

```
Authorization: Bearer <access_token>
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

- `INVALID_INPUT` - Invalid request data
- `DUPLICATE_PHONE` - Phone number already exists
- `DUPLICATE_EMAIL` - Email already exists
- `INVALID_OTP` - Invalid or expired OTP
- `INVALID_CREDENTIALS` - Invalid login credentials
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INVALID_TOKEN` - Invalid JWT token
- `UNAUTHORIZED` - Authentication required

## Multi-Step Phone Signup Flow

### 1. Start Phone Signup

Initiates the phone signup process by sending an OTP to the provided phone number.

**Endpoint:** `POST /api/auth/signup/phone/start`

**Request Body:**
```json
{
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "step": 1,
  "expiresIn": 600
}
```

**Validation:**
- Phone number must be in E.164 format
- Phone number must not already exist in the system

**Rate Limiting:** 5 requests per minute per phone number

---

### 2. Verify Phone OTP

Verifies the OTP sent to the phone number.

**Endpoint:** `POST /api/auth/signup/phone/verify`

**Request Body:**
```json
{
  "phone": "+1234567890",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Phone verified successfully",
  "step": 2
}
```

**Validation:**
- OTP must be 6 digits
- OTP must not be expired
- Maximum 5 attempts per OTP

---

### 3. Email Verification

Sends email verification code and verifies email.

**Send Email Verification:**
**Endpoint:** `POST /api/auth/signup/email/verify`

**Request Body:**
```json
{
  "phone": "+1234567890",
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email verification sent",
  "step": 3,
  "expiresIn": 86400
}
```

**Verify Email Code:**
**Request Body:**
```json
{
  "email": "user@example.com",
  "code": "654321"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

---

### 4. Complete Signup

Completes the signup process with password creation.

**Endpoint:** `POST /api/auth/signup/complete`

**Request Body:**
```json
{
  "phone": "+1234567890",
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Signup completed successfully",
  "user": {
    "id": "uuid",
    "phone": "+1234567890",
    "email": "user@example.com",
    "phoneVerified": true,
    "emailVerified": true,
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "tokens": {
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token",
    "expiresIn": 3600
  }
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

## Auth0 Signup Flow

### 1. Start Auth0 Signup

Creates user profile from Auth0 authentication data.

**Endpoint:** `POST /api/auth/signup/auth0/start`

**Request Body:**
```json
{
  "auth0Profile": {
    "sub": "auth0|user123",
    "email": "user@example.com",
    "name": "John Doe",
    "picture": "https://example.com/avatar.jpg"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Auth0 profile created, phone verification required",
  "step": 2,
  "userId": "uuid"
}
```

---

### 2. Add Phone Verification

Adds phone verification to Auth0 signup.

**Endpoint:** `POST /api/auth/signup/auth0/phone`

**Request Body:**
```json
{
  "auth0Id": "auth0|user123",
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Phone verification sent",
  "expiresIn": 600
}
```

---

### 3. Complete Auth0 Signup

Completes Auth0 signup with phone verification.

**Endpoint:** `POST /api/auth/signup/auth0/complete`

**Request Body:**
```json
{
  "auth0Id": "auth0|user123",
  "phone": "+1234567890",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Auth0 signup completed successfully",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "phone": "+1234567890",
    "auth0Id": "auth0|user123",
    "phoneVerified": true,
    "emailVerified": true,
    "name": "John Doe"
  },
  "tokens": {
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token",
    "expiresIn": 3600
  }
}
```

## Login Methods

### 1. Auth0 Login

Authenticates user via Auth0.

**Endpoint:** `POST /api/auth/login/auth0`

**Request Body:**
```json
{
  "auth0Id": "auth0|user123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "phone": "+1234567890",
    "auth0Id": "auth0|user123",
    "name": "John Doe",
    "lastLogin": "2024-01-01T00:00:00Z"
  },
  "tokens": {
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token",
    "expiresIn": 3600
  }
}
```

---

### 2. Phone OTP Login

Authenticates user via phone number and OTP.

**Request OTP:**
**Endpoint:** `POST /api/auth/login/phone/request`

**Request Body:**
```json
{
  "phone": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "expiresIn": 600
}
```

**Login with OTP:**
**Endpoint:** `POST /api/auth/login/phone`

**Request Body:**
```json
{
  "phone": "+1234567890",
  "otp": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "phone": "+1234567890",
    "email": "user@example.com",
    "phoneVerified": true,
    "lastLogin": "2024-01-01T00:00:00Z"
  },
  "tokens": {
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token",
    "expiresIn": 3600
  }
}
```

---

### 3. Email/Password Login

Authenticates user via email and password.

**Endpoint:** `POST /api/auth/login/email`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "phone": "+1234567890",
    "emailVerified": true,
    "lastLogin": "2024-01-01T00:00:00Z"
  },
  "tokens": {
    "accessToken": "jwt_access_token",
    "refreshToken": "jwt_refresh_token",
    "expiresIn": 3600
  }
}
```

## Token Management

### Refresh Token

Refreshes access token using refresh token.

**Endpoint:** `POST /api/auth/refresh`

**Request Body:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

**Response:**
```json
{
  "success": true,
  "tokens": {
    "accessToken": "new_jwt_access_token",
    "refreshToken": "new_jwt_refresh_token",
    "expiresIn": 3600
  }
}
```

---

### Logout

Invalidates user session and tokens.

**Endpoint:** `POST /api/auth/logout`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logout successful"
}
```

## User Profile

### Get User Profile

Retrieves authenticated user's profile.

**Endpoint:** `GET /api/auth/profile`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "phone": "+1234567890",
    "auth0Id": "auth0|user123",
    "phoneVerified": true,
    "emailVerified": true,
    "name": "John Doe",
    "createdAt": "2024-01-01T00:00:00Z",
    "lastLogin": "2024-01-01T12:00:00Z"
  }
}
```

## Pricing System

### Get Pricing Plans

Retrieves all active pricing plans.

**Endpoint:** `GET /api/pricing/plans`

**Response:**
```json
{
  "success": true,
  "plans": [
    {
      "id": "uuid",
      "name": "Free",
      "price": 0,
      "features": [
        "1,000 emails/month",
        "Basic templates",
        "Email support"
      ],
      "limits": {
        "emails_per_month": 1000,
        "templates": 5,
        "contacts": 500
      },
      "active": true
    },
    {
      "id": "uuid",
      "name": "Pro",
      "price": 29.99,
      "features": [
        "10,000 emails/month",
        "Advanced templates",
        "Priority support",
        "Analytics"
      ],
      "limits": {
        "emails_per_month": 10000,
        "templates": 50,
        "contacts": 5000
      },
      "active": true
    }
  ]
}
```

**Fallback Response (when database fails):**
```json
{
  "success": true,
  "fallback": true,
  "plans": [
    {
      "id": "fallback-basic",
      "name": "Basic Plan",
      "price": 19.99,
      "features": ["Basic features"],
      "limits": {},
      "active": true
    }
  ]
}
```

---

### Get Specific Pricing Plan

Retrieves details for a specific pricing plan.

**Endpoint:** `GET /api/pricing/plan/:id`

**Response:**
```json
{
  "success": true,
  "plan": {
    "id": "uuid",
    "name": "Pro",
    "price": 29.99,
    "features": [
      "10,000 emails/month",
      "Advanced templates",
      "Priority support",
      "Analytics"
    ],
    "limits": {
      "emails_per_month": 10000,
      "templates": 50,
      "contacts": 5000
    },
    "active": true,
    "description": "Perfect for growing businesses",
    "popular": true
  }
}
```

## Health Check

### System Health

Checks system health and database connectivity.

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00Z",
  "services": {
    "database": "healthy",
    "auth0": "healthy",
    "twilio": "healthy",
    "sendgrid": "healthy"
  },
  "version": "1.0.0"
}
```

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Authentication endpoints**: 10 requests per minute per IP
- **OTP requests**: 5 requests per minute per phone number
- **Login attempts**: 5 attempts per minute per email/phone
- **General API**: 100 requests per minute per IP

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1640995200
```

## Security Headers

All responses include security headers:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

## CORS Configuration

CORS is configured to allow requests from:
- `https://yourdomain.com`
- `https://www.yourdomain.com`
- `http://localhost:3000` (development)

## Webhook Events

The system can send webhook events for:
- User signup completion
- Login events
- Password changes
- Account verification

Webhook payload example:
```json
{
  "event": "user.signup.completed",
  "timestamp": "2024-01-01T00:00:00Z",
  "data": {
    "userId": "uuid",
    "email": "user@example.com",
    "signupMethod": "phone"
  }
}
```

## SDK Examples

### JavaScript/TypeScript

```typescript
import { AuthClient } from './auth-client';

const client = new AuthClient({
  baseURL: 'https://api.yourdomain.com',
  apiKey: 'your-api-key'
});

// Multi-step phone signup
const signup = await client.signup.phone.start('+1234567890');
await client.signup.phone.verify('+1234567890', '123456');
await client.signup.email.verify('user@example.com', '654321');
const result = await client.signup.complete({
  phone: '+1234567890',
  email: 'user@example.com',
  password: 'SecurePass123!'
});

// Login
const login = await client.login.email('user@example.com', 'SecurePass123!');
```

### cURL Examples

```bash
# Start phone signup
curl -X POST https://api.yourdomain.com/api/auth/signup/phone/start \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890"}'

# Verify OTP
curl -X POST https://api.yourdomain.com/api/auth/signup/phone/verify \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1234567890", "otp": "123456"}'

# Login
curl -X POST https://api.yourdomain.com/api/auth/login/email \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "SecurePass123!"}'
```

## Testing

### Test Endpoints

Test endpoints are available in development:

- `POST /api/test/reset-user` - Reset test user data
- `POST /api/test/generate-otp` - Generate test OTP
- `GET /api/test/health` - Extended health check

### Test Data

Use these test phone numbers that don't send real SMS:
- `+15551234567` - Always succeeds
- `+15551234568` - Always fails with invalid OTP
- `+15551234569` - Simulates rate limiting

## Changelog

### v1.0.0 (2024-01-01)
- Initial API release
- Multi-step phone signup flow
- Auth0 integration
- Multiple login methods
- Pricing system integration
- Comprehensive error handling
- Rate limiting and security measures