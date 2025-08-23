# Authentication System Rebuild Design

## Overview

This design document outlines the complete rebuild of the authentication system to address critical issues including broken signup flows, non-functional login methods, and pricing data retrieval failures. The new system will support multiple authentication methods with proper database persistence, unique constraints, and seamless frontend-backend integration.

The rebuild focuses on three core authentication flows:
1. Multi-step phone number signup (phone → email → password)
2. Auth0 social authentication with phone verification
3. Multiple login methods (Auth0, phone OTP, email/password)

## Architecture

### High-Level Architecture

```
Frontend (Next.js) ↔ Backend API (Node.js/Express) ↔ Database (PostgreSQL)
                                ↕
                           Auth0 Service
                                ↕
                           SMS Service (Twilio)
                                ↕
                           Email Service (SendGrid)
```

### Authentication Flow Architecture

The system implements a state-machine approach for multi-step authentication:

- **Session Management**: JWT tokens with refresh mechanism
- **State Persistence**: Database-backed verification states
- **Duplicate Prevention**: Unique constraints on phone/email
- **Error Handling**: Graceful degradation with specific error messages

### Database Schema Design

**Rationale**: Separate tables for different verification types allow for better tracking of multi-step processes and prevent data conflicts.

```sql
-- Core user table with unique constraints
users (
  id, email, phone, password_hash, auth0_id,
  phone_verified, email_verified, created_at, last_login
)

-- Phone verification tracking
phone_verifications (
  id, phone, otp_code, expires_at, verified_at, attempts
)

-- Email verification tracking  
email_verifications (
  id, email, verification_code, expires_at, verified_at
)

-- Auth0 profile data
auth0_profiles (
  id, user_id, auth0_id, profile_data, created_at
)

-- Session management
user_sessions (
  id, user_id, jwt_token, refresh_token, expires_at, created_at
)

-- Pricing system tables
pricing_plans (
  id, name, price, features, limits, active
)
```

## Components and Interfaces

### Frontend Components

#### 1. Multi-Step Signup Components
- `PhoneSignupFlow`: Orchestrates 3-step phone signup
- `PhoneVerificationStep`: Handles phone input and OTP verification
- `EmailVerificationStep`: Manages email verification
- `PasswordCreationStep`: Final step for password setup
- `SignupProgress`: Visual progress indicator

#### 2. Auth0 Integration Components
- `Auth0SignupFlow`: Handles Auth0 authentication + phone verification
- `Auth0Callback`: Processes Auth0 redirect and user creation
- `PhoneVerificationForAuth0`: Phone verification for Auth0 users

#### 3. Login Components
- `LoginMethodSelector`: Allows users to choose login method
- `Auth0Login`: Auth0 authentication flow
- `PhoneOTPLogin`: Phone number + OTP login
- `EmailPasswordLogin`: Traditional email/password login

#### 4. Pricing Components
- `PricingDisplay`: Shows pricing plans with database integration
- `PricingFallback`: Displays when database fails

### Backend API Endpoints

#### Authentication Endpoints
```
POST /api/auth/signup/phone/start     # Start phone signup
POST /api/auth/signup/phone/verify    # Verify phone OTP
POST /api/auth/signup/email/verify    # Verify email
POST /api/auth/signup/complete        # Complete signup

POST /api/auth/signup/auth0/start     # Start Auth0 signup
POST /api/auth/signup/auth0/complete  # Complete Auth0 + phone

POST /api/auth/login/auth0           # Auth0 login
POST /api/auth/login/phone           # Phone OTP login
POST /api/auth/login/email           # Email/password login

POST /api/auth/refresh               # Refresh JWT tokens
POST /api/auth/logout                # Logout and invalidate session
```

#### Pricing Endpoints
```
GET /api/pricing/plans               # Get all pricing plans
GET /api/pricing/plan/:id            # Get specific plan
```

### Service Layer Architecture

#### 1. Authentication Service
- `UserService`: User CRUD operations with duplicate checking
- `VerificationService`: Handles OTP and email verification
- `Auth0Service`: Auth0 integration and profile management
- `SessionService`: JWT token management and session tracking

#### 2. Communication Services
- `SMSService`: Twilio integration for OTP delivery
- `EmailService`: SendGrid integration for email verification
- `NotificationService`: Unified notification handling

#### 3. Database Services
- `DatabaseService`: Connection management and query optimization
- `MigrationService`: Schema creation and data migration
- `PricingService`: Pricing data management and caching

## Data Models

### User Model
```typescript
interface User {
  id: string;
  email: string;
  phone: string;
  passwordHash?: string;
  auth0Id?: string;
  phoneVerified: boolean;
  emailVerified: boolean;
  createdAt: Date;
  lastLogin?: Date;
}
```

### Verification Models
```typescript
interface PhoneVerification {
  id: string;
  phone: string;
  otpCode: string;
  expiresAt: Date;
  verifiedAt?: Date;
  attempts: number;
}

interface EmailVerification {
  id: string;
  email: string;
  verificationCode: string;
  expiresAt: Date;
  verifiedAt?: Date;
}
```

### Pricing Model
```typescript
interface PricingPlan {
  id: string;
  name: string;
  price: number;
  features: string[];
  limits: Record<string, number>;
  active: boolean;
}
```

## Error Handling

### Database Constraint Violations
**Design Decision**: Use database unique constraints as the primary duplicate prevention mechanism, with application-level checks as secondary validation.

- **Duplicate Phone**: Return specific error code and message
- **Duplicate Email**: Return specific error code and message  
- **Database Connection**: Implement retry logic with exponential backoff
- **Query Failures**: Log errors and return user-friendly messages

### Authentication Errors
- **Invalid OTP**: Allow retries with rate limiting
- **Expired Verification**: Provide re-send options
- **Auth0 Failures**: Graceful fallback to other login methods
- **Session Expiry**: Automatic refresh token handling

### Pricing System Errors
- **Database Unavailable**: Display cached/fallback pricing
- **Missing Data**: Recreate pricing tables with seed data
- **API Failures**: Return default pricing structure

## Testing Strategy

### Unit Testing
- **Authentication Services**: Mock external services (Auth0, Twilio, SendGrid)
- **Database Operations**: Use test database with transaction rollback
- **Validation Logic**: Test all constraint violations and edge cases
- **Error Handling**: Verify proper error responses and logging

### Integration Testing
- **Multi-Step Flows**: Test complete signup processes end-to-end
- **Database Constraints**: Verify unique constraint enforcement
- **External Services**: Test with sandbox/test environments
- **API Endpoints**: Validate request/response formats and error codes

### End-to-End Testing
- **Complete User Journeys**: Test all signup and login flows
- **Cross-Browser Compatibility**: Ensure consistent behavior
- **Mobile Responsiveness**: Test on various device sizes
- **Performance**: Verify acceptable load times for pricing data

### Database Testing
- **Schema Validation**: Ensure all tables and constraints exist
- **Data Integrity**: Test foreign key relationships and cascades
- **Migration Testing**: Verify schema updates don't break existing data
- **Backup/Recovery**: Test data persistence and recovery procedures

## Security Considerations

### Authentication Security
- **Password Hashing**: Use bcrypt with appropriate salt rounds
- **JWT Security**: Short-lived access tokens with secure refresh mechanism
- **OTP Security**: Time-limited codes with attempt limiting
- **Session Management**: Secure token storage and invalidation

### Database Security
- **Input Validation**: Prevent SQL injection with parameterized queries
- **Access Control**: Principle of least privilege for database connections
- **Encryption**: Encrypt sensitive data at rest and in transit
- **Audit Logging**: Track all authentication attempts and failures

### API Security
- **Rate Limiting**: Prevent brute force attacks on all endpoints
- **CORS Configuration**: Proper cross-origin request handling
- **Input Sanitization**: Validate and sanitize all user inputs
- **Error Information**: Avoid leaking sensitive information in error messages

## Performance Optimization

### Database Performance
- **Indexing Strategy**: Index on email, phone, and auth0_id for fast lookups
- **Connection Pooling**: Efficient database connection management
- **Query Optimization**: Use prepared statements and avoid N+1 queries
- **Caching**: Cache pricing data and frequently accessed user information

### Frontend Performance
- **Code Splitting**: Lazy load authentication components
- **State Management**: Efficient state updates during multi-step flows
- **API Caching**: Cache pricing data and user session information
- **Bundle Optimization**: Minimize JavaScript bundle size

### Scalability Considerations
- **Horizontal Scaling**: Stateless API design for load balancing
- **Database Scaling**: Read replicas for pricing data queries
- **CDN Integration**: Cache static assets and API responses
- **Monitoring**: Performance metrics and alerting for critical paths