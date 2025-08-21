# Security Database Setup

This document describes the enhanced security database schema implemented for the home page redesign project.

## Overview

The security database enhancements provide:
- Per-user JWT secrets for enhanced authentication security
- Secure OTP management with rate limiting and expiration
- JWT-protected pricing data to prevent client-side manipulation
- Media assets management for the redesigned home page

## Database Schema

### Enhanced Users Table

The existing `users` table has been enhanced with security columns:

```sql
ALTER TABLE users ADD COLUMN:
- jwt_secret VARCHAR(255) NOT NULL          -- Individual JWT secret per user
- jwt_refresh_secret VARCHAR(255) NOT NULL  -- Individual refresh token secret
- phone_number VARCHAR(20) UNIQUE           -- Phone number for authentication
- is_phone_verified BOOLEAN DEFAULT FALSE   -- Phone verification status
```

**Key Features:**
- Automatic JWT secret generation for new users via database trigger
- Unique phone number constraint
- Optimized indexes for security queries

### OTP Verifications Table

Secure storage for one-time passwords with built-in security features:

```sql
CREATE TABLE otp_verifications (
  id UUID PRIMARY KEY,
  phone_number VARCHAR(20) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  is_used BOOLEAN DEFAULT FALSE,
  is_expired BOOLEAN DEFAULT FALSE,
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Key Features:**
- Automatic expiration handling via database triggers
- Rate limiting with configurable max attempts
- Cleanup function for expired OTPs
- Built-in validation function with security checks

### Secure Pricing Table

JWT-protected pricing data to prevent client-side manipulation:

```sql
CREATE TABLE secure_pricing (
  id UUID PRIMARY KEY,
  plan_id VARCHAR(50) UNIQUE NOT NULL,
  plan_name VARCHAR(100) NOT NULL,
  price_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  billing_cycle VARCHAR(20) DEFAULT 'monthly',
  features JSONB NOT NULL,
  limits JSONB NOT NULL,
  jwt_signature TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  is_popular BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Key Features:**
- Automatic JWT signature generation via database triggers
- Server-side pricing validation functions
- Structured feature and limits storage using JSONB
- Display ordering and popularity flags

### Media Assets Table

Management of images, videos, and animations for the home page:

```sql
CREATE TABLE media_assets (
  id UUID PRIMARY KEY,
  asset_type VARCHAR(20) CHECK (asset_type IN ('image', 'video', 'animation', 'icon')),
  file_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  alt_text VARCHAR(255),
  caption TEXT,
  section VARCHAR(50) CHECK (section IN ('hero', 'features', 'pricing', 'testimonials', 'footer')),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  is_optimized BOOLEAN DEFAULT FALSE,
  optimization_settings JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Key Features:**
- Structured media organization by page sections
- Optimization tracking and settings
- Flexible metadata storage for dimensions, duration, etc.
- Cleanup functions for unused assets

## Database Functions

### Security Functions

1. **`generate_user_jwt_secrets()`** - Auto-generates JWT secrets for new users
2. **`validate_otp(phone_number, otp_code)`** - Validates OTP with rate limiting
3. **`cleanup_expired_otps()`** - Removes expired OTP records
4. **`generate_pricing_jwt_signature()`** - Creates JWT signatures for pricing data
5. **`validate_pricing_signature()`** - Validates pricing data integrity
6. **`get_secure_pricing(plan_id)`** - Retrieves pricing with signatures
7. **`get_media_assets_by_section(section)`** - Gets media assets by page section
8. **`get_hero_media_assets()`** - Gets optimized hero section media

### Utility Functions

- **`update_updated_at_column()`** - Updates timestamp on record changes
- **`mark_expired_otps()`** - Automatically marks expired OTPs
- **`mark_media_optimized()`** - Tracks media optimization status
- **`cleanup_unused_media_assets()`** - Soft-deletes unused media

## Installation

### 1. Run Security Migrations

```bash
cd backend
node run-security-migration.js
```

This will create all security tables, indexes, functions, and triggers.

### 2. Seed Initial Data

```bash
node run-security-seed.js
```

This will populate:
- Secure pricing plans with JWT signatures
- Sample media assets for development
- Verification of data integrity

### 3. Test Setup

```bash
node test-security-database.js
```

This will verify:
- All tables and indexes are created
- Functions work correctly
- Data integrity is maintained
- Security features are operational

## Usage Examples

### TypeScript Service Integration

```typescript
import { SecurityDatabaseService } from './src/config/security-database';

// Get user security data
const userSecurity = await SecurityDatabaseService.getUserSecurityData(userId);

// Validate OTP
const otpResult = await SecurityDatabaseService.validateOTP(phoneNumber, otpCode);

// Get secure pricing
const pricing = await SecurityDatabaseService.getSecurePricing();

// Validate pricing signature
const isValid = await SecurityDatabaseService.validatePricingSignature(
  planId, priceAmount, currency, billingCycle, signature
);
```

### Direct SQL Usage

```sql
-- Create OTP for phone verification
INSERT INTO otp_verifications (phone_number, otp_code, expires_at)
VALUES ('1234567890', '123456', CURRENT_TIMESTAMP + INTERVAL '10 minutes');

-- Validate OTP with rate limiting
SELECT * FROM validate_otp('1234567890', '123456');

-- Get secure pricing data
SELECT * FROM get_secure_pricing('starter');

-- Get hero section media
SELECT * FROM get_hero_media_assets();
```

## Security Considerations

### JWT Secrets
- Each user has individual JWT secrets stored securely in the database
- Secrets are automatically generated using cryptographically secure random bytes
- Rotation capability built-in for security incidents

### OTP Security
- Rate limiting prevents brute force attacks
- Automatic expiration prevents replay attacks
- Attempt tracking with configurable limits
- Secure cleanup of expired codes

### Pricing Protection
- All pricing data is JWT-signed at the database level
- Client-side pricing manipulation is detected and rejected
- Server-side validation ensures payment integrity
- Audit trail for pricing changes

### Media Security
- File path validation prevents directory traversal
- Optimization tracking for performance monitoring
- Soft deletion for audit trails
- Section-based access control

## Performance Optimizations

### Indexes
- Optimized indexes for all security queries
- Composite indexes for common query patterns
- Partial indexes for active records only

### Query Optimization
- Database functions reduce round-trip queries
- Efficient pagination for large datasets
- Connection pooling for high concurrency

### Cleanup Jobs
- Automated cleanup of expired OTPs
- Media asset optimization tracking
- Unused asset identification

## Monitoring and Maintenance

### Health Checks
```typescript
const health = await SecurityDatabaseService.healthCheck();
// Returns: { database: boolean, securityTables: boolean, indexesOptimal: boolean }
```

### Cleanup Tasks
```sql
-- Run daily cleanup of expired OTPs
SELECT cleanup_expired_otps();

-- Run weekly cleanup of unused media
SELECT cleanup_unused_media_assets();
```

### Performance Monitoring
- Monitor index usage with `pg_stat_user_indexes`
- Track query performance with `pg_stat_statements`
- Monitor connection pool usage

## Troubleshooting

### Common Issues

1. **Migration Failures**
   - Ensure base schema is applied first
   - Check database permissions
   - Verify PostgreSQL version compatibility

2. **JWT Secret Generation**
   - Ensure `gen_random_bytes()` function is available
   - Check trigger installation
   - Verify user creation process

3. **OTP Validation Issues**
   - Check function installation
   - Verify rate limiting settings
   - Monitor cleanup job execution

4. **Pricing Signature Validation**
   - Ensure consistent signature generation
   - Check JWT secret configuration
   - Verify data integrity

### Debug Queries

```sql
-- Check table structures
\d+ users
\d+ otp_verifications
\d+ secure_pricing
\d+ media_assets

-- Check function definitions
\df validate_otp
\df get_secure_pricing

-- Monitor active connections
SELECT * FROM pg_stat_activity WHERE application_name = 'bulk-email-platform';
```

## Migration Rollback

If needed, security enhancements can be rolled back:

```sql
-- Remove added columns from users table
ALTER TABLE users 
DROP COLUMN IF EXISTS jwt_secret,
DROP COLUMN IF EXISTS jwt_refresh_secret,
DROP COLUMN IF EXISTS phone_number,
DROP COLUMN IF EXISTS is_phone_verified;

-- Drop security tables
DROP TABLE IF EXISTS otp_verifications CASCADE;
DROP TABLE IF EXISTS secure_pricing CASCADE;
DROP TABLE IF EXISTS media_assets CASCADE;

-- Drop security functions
DROP FUNCTION IF EXISTS validate_otp CASCADE;
DROP FUNCTION IF EXISTS get_secure_pricing CASCADE;
-- ... (other functions)
```

## Next Steps

After database setup completion:
1. Implement UserSecurityManager service (Task 2)
2. Build OTP management system (Task 3)
3. Create pricing protection service (Task 4)
4. Integrate with frontend authentication flow