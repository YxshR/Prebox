# Secure OTP Management System

## Overview

This document describes the comprehensive secure OTP (One-Time Password) management system implemented for the home page redesign project. The system provides robust security features including rate limiting, attempt tracking, secure storage, and automated cleanup.

## Components

### 1. SecureOTPService (`secure-otp.service.ts`)

The main service for OTP generation, validation, and management.

#### Key Features:
- **Cryptographically Secure Code Generation**: Uses Node.js crypto module for secure random number generation
- **Hashed Storage**: OTP codes are hashed with SHA-256 before database storage
- **Rate Limiting**: Prevents abuse with configurable rate limits per phone number
- **Attempt Tracking**: Tracks failed validation attempts with automatic lockout
- **Timing Attack Protection**: Uses timing-safe comparison for validation
- **Multiple OTP Types**: Supports registration, login, and password reset flows
- **Resend Functionality**: Secure OTP resending with anti-spam protection

#### Configuration Options:
```typescript
interface SecureOTPConfig {
  expiryMinutes: number;        // Default: 10 minutes
  maxAttempts: number;          // Default: 3 attempts
  rateLimitWindow: number;      // Default: 60 minutes
  maxOTPsPerWindow: number;     // Default: 5 OTPs per window
  codeLength: number;           // Default: 6 digits
}
```

#### Main Methods:
- `generateOTP(phoneNumber, type, userId?)`: Generate and send new OTP
- `validateOTP(otpId, code)`: Validate OTP with security checks
- `resendOTP(otpId)`: Resend OTP with rate limiting
- `getOTPAttemptInfo(phoneNumber, type)`: Get attempt statistics
- `cleanupExpiredOTPs()`: Remove expired OTP records
- `getHealthStatus()`: Service health monitoring

### 2. OTPCleanupService (`otp-cleanup.service.ts`)

Automated cleanup service for expired and used OTP records.

#### Key Features:
- **Scheduled Cleanup**: Configurable cron-based cleanup schedule
- **Batch Processing**: Efficient cleanup of large datasets
- **Redis Integration**: Cleans up associated Redis keys
- **Database Optimization**: Runs VACUUM ANALYZE after significant cleanups
- **Monitoring**: Tracks cleanup statistics and history
- **Error Handling**: Graceful error handling with rollback support

#### Configuration Options:
```typescript
interface CleanupConfig {
  enabled: boolean;             // Enable/disable cleanup
  cronSchedule: string;         // Cron schedule (default: every 6 hours)
  batchSize: number;           // Records per batch (default: 1000)
  maxAge: number;              // Hours to keep records (default: 24)
  logResults: boolean;         // Log cleanup results
}
```

### 3. Database Schema

The OTP system uses a comprehensive database table:

```sql
CREATE TABLE otp_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    phone_number VARCHAR(20) NOT NULL,
    otp_code VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    is_used BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_attempt_at TIMESTAMP WITH TIME ZONE
);
```

#### Indexes for Performance:
- `idx_otp_user_id`: User ID lookup
- `idx_otp_phone_number`: Phone number lookup
- `idx_otp_expires_at`: Expiration-based queries
- `idx_otp_is_used`: Used status filtering
- `idx_otp_type`: OTP type filtering
- `idx_otp_phone_type`: Composite phone + type lookup

## Security Features

### 1. Cryptographic Security
- **Secure Random Generation**: Uses `crypto.randomBytes()` for OTP generation
- **Hash Storage**: OTP codes stored as SHA-256 hashes with salt
- **Timing Attack Protection**: Constant-time comparison using `crypto.timingSafeEqual()`

### 2. Rate Limiting
- **Per-Phone Limits**: Maximum OTPs per phone number per time window
- **Redis-Based Tracking**: Fast rate limit checking using Redis
- **Configurable Windows**: Adjustable rate limiting time windows

### 3. Attempt Tracking
- **Failed Attempt Counting**: Tracks invalid OTP attempts
- **Automatic Lockout**: Locks OTP after maximum failed attempts
- **Attempt History**: Maintains attempt timestamps and counts

### 4. Anti-Abuse Measures
- **Resend Throttling**: Minimum time between resend requests
- **Expiration Enforcement**: Automatic OTP expiration
- **Usage Tracking**: Prevents OTP reuse

## Integration Points

### 1. SMS Integration
- **Twilio Support**: Production SMS sending via Twilio
- **Mock Mode**: Development/demo mode with console logging
- **Error Handling**: Graceful SMS failure handling

### 2. Redis Integration
- **Rate Limiting**: Redis-based rate limit counters
- **Attempt Tracking**: Fast attempt count storage
- **Health Monitoring**: Redis connection health checks

### 3. Database Integration
- **PostgreSQL**: Primary storage for OTP records
- **Transaction Support**: ACID compliance for critical operations
- **Connection Pooling**: Efficient database connection management

## Testing

### 1. Unit Tests (`secure-otp.service.test.ts`)
- OTP generation and validation
- Rate limiting functionality
- Attempt tracking
- Security features (timing attacks, hash storage)
- Error handling scenarios

### 2. Cleanup Tests (`otp-cleanup.service.test.ts`)
- Automated cleanup functionality
- Batch processing
- Redis key cleanup
- Performance testing
- Error handling

### 3. Integration Tests (`otp-integration.test.ts`)
- End-to-end OTP flows
- Concurrent operations
- Security validation
- Performance under load
- Health monitoring

### 4. Manual Testing (`test-otp-simple.js`)
- Basic functionality verification
- Database schema validation
- Redis operations
- Cleanup functionality

## Usage Examples

### Basic OTP Generation
```typescript
const otpService = new SecureOTPService();

// Generate OTP for registration
const result = await otpService.generateOTP(
  '+1234567890',
  'registration',
  'user-id-123'
);

console.log('OTP ID:', result.otpId);
console.log('Expires at:', result.expiresAt);
```

### OTP Validation
```typescript
// Validate OTP
const validation = await otpService.validateOTP(otpId, userEnteredCode);

if (validation.isValid) {
  console.log('OTP valid, user verified');
} else {
  console.log('Invalid OTP:', validation.errorMessage);
  console.log('Attempts remaining:', validation.attemptsRemaining);
}
```

### Cleanup Service Setup
```typescript
const cleanupService = new OTPCleanupService({
  enabled: true,
  cronSchedule: '0 */6 * * *', // Every 6 hours
  batchSize: 1000,
  maxAge: 24,
  logResults: true
});

cleanupService.start();
```

## Monitoring and Health Checks

### Health Status Monitoring
```typescript
const health = await otpService.getHealthStatus();
console.log('Database:', health.database);
console.log('Redis:', health.redis);
console.log('Twilio:', health.twilio);
console.log('Active OTPs:', health.activeOTPs);
```

### Cleanup Statistics
```typescript
const stats = cleanupService.getLastCleanup();
console.log('Deleted OTPs:', stats.deletedOTPs);
console.log('Cleaned Redis keys:', stats.cleanedRedisKeys);
console.log('Duration:', stats.duration + 'ms');
```

## Configuration

### Environment Variables
```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_number

# Database Configuration
DATABASE_URL=postgresql://user:pass@host:port/db

# Redis Configuration
REDIS_URL=redis://localhost:6379

# Security Configuration
JWT_SECRET=your_jwt_secret

# Demo Mode (disables SMS sending)
DEMO_MODE=false
```

### Service Configuration
```typescript
// OTP Service Configuration
const otpConfig = {
  expiryMinutes: 10,
  maxAttempts: 3,
  rateLimitWindow: 60,
  maxOTPsPerWindow: 5,
  codeLength: 6
};

// Cleanup Service Configuration
const cleanupConfig = {
  enabled: true,
  cronSchedule: '0 */6 * * *',
  batchSize: 1000,
  maxAge: 24,
  logResults: true
};
```

## Performance Considerations

### Database Optimization
- Proper indexing for fast lookups
- Batch cleanup operations
- Connection pooling
- Query optimization

### Redis Optimization
- Efficient key naming conventions
- Appropriate TTL values
- Pipeline operations for bulk updates
- Memory usage monitoring

### Scalability
- Horizontal scaling support
- Load balancing considerations
- Rate limiting distribution
- Cleanup job distribution

## Security Best Practices

1. **Never log OTP codes** in plain text
2. **Use HTTPS** for all OTP-related communications
3. **Implement proper rate limiting** to prevent abuse
4. **Monitor for suspicious patterns** in OTP requests
5. **Regularly rotate JWT secrets** used for hashing
6. **Implement proper error handling** without information leakage
7. **Use secure random number generation** for OTP codes
8. **Implement timing attack protection** in validation

## Troubleshooting

### Common Issues

1. **OTP Not Received**
   - Check Twilio configuration
   - Verify phone number format
   - Check SMS delivery logs

2. **Rate Limiting Issues**
   - Verify Redis connectivity
   - Check rate limit configuration
   - Monitor rate limit counters

3. **Database Connection Issues**
   - Verify database connectivity
   - Check connection pool settings
   - Monitor database performance

4. **Cleanup Not Running**
   - Check cron schedule configuration
   - Verify cleanup service is started
   - Monitor cleanup logs

### Debugging

Enable debug logging:
```typescript
const otpService = new SecureOTPService({
  // ... config
});

// Check health status
const health = await otpService.getHealthStatus();
console.log('Service Health:', health);

// Check attempt info
const attempts = await otpService.getOTPAttemptInfo(phoneNumber, type);
console.log('Attempt Info:', attempts);
```

## Requirements Satisfied

This implementation satisfies the following requirements from the home page redesign spec:

- **Requirement 6.4**: OTP generation and storage with expiration handling ✅
- **Requirement 8.3**: Rate limiting and attempt tracking for security ✅

### Additional Security Features Implemented:
- Cryptographically secure OTP generation
- Hashed storage with timing attack protection
- Comprehensive rate limiting
- Automated cleanup and maintenance
- Health monitoring and alerting
- Extensive test coverage

The OTP system is production-ready and provides enterprise-grade security for user authentication flows.