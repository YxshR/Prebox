# Configuration Guide

This document provides comprehensive guidance on configuring the Bulk Email Platform for different environments.

## Table of Contents

- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Application Configuration](#application-configuration)
- [Database Setup](#database-setup)
- [External Services](#external-services)
- [Security Configuration](#security-configuration)
- [Deployment Environments](#deployment-environments)
- [Troubleshooting](#troubleshooting)

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 13+
- Redis 6+
- Git

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd bulk-email-platform
   ```

2. **Install dependencies**
   ```bash
   npm run install:all
   ```

3. **Set up environment files**
   ```bash
   npm run setup:env
   ```

4. **Configure your environment variables** (see [Environment Variables](#environment-variables))

5. **Start development servers**
   ```bash
   npm run dev
   ```

## Environment Variables

### Required Environment Variables

Each application requires specific environment variables. Use the provided `.env.example` files as templates.

#### Frontend (.env)
```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Google OAuth
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

#### Backend (.env)
```bash
# Server Configuration
PORT=8000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/bulk_email_platform

# Redis
REDIS_URL=redis://localhost:6379

# JWT Secrets
JWT_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key

# Email Service (choose one)
SENDGRID_API_KEY=your-sendgrid-api-key
# OR
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key

# Payment Gateway
STRIPE_SECRET_KEY=sk_test_your_stripe_test_key
RAZORPAY_KEY_SECRET=your-razorpay-secret-key

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

#### Admin Frontend (.env)
```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### Environment Variable Validation

Run the validation script to ensure your configuration is secure:

```bash
npm run validate:env
```

This script checks for:
- Production credentials in development files
- Missing required variables
- Proper .gitignore configuration
- Security best practices

## Application Configuration

### Port Configuration

Default ports:
- Frontend: `3000`
- Admin Frontend: `3002`
- Backend API: `8000`

To change ports, update the respective environment variables:
- Frontend: Update `package.json` dev script
- Admin Frontend: Update `package.json` dev script with `--port` flag
- Backend: Update `PORT` in `.env`

### CORS Configuration

Configure CORS origins in backend `.env`:
```bash
CORS_ORIGIN=http://localhost:3000,http://localhost:3002,http://localhost:8000
```

For production, update with your actual domains:
```bash
CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com
```

## Database Setup

### PostgreSQL Configuration

1. **Install PostgreSQL** (version 13 or higher)

2. **Create database and user**
   ```sql
   CREATE DATABASE bulk_email_platform;
   CREATE USER your_username WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE bulk_email_platform TO your_username;
   ```

3. **Update DATABASE_URL in backend .env**
   ```bash
   DATABASE_URL=postgresql://your_username:your_password@localhost:5432/bulk_email_platform
   ```

4. **Run migrations**
   ```bash
   cd backend
   npm run migrate
   ```

### Redis Configuration

1. **Install Redis** (version 6 or higher)

2. **Start Redis server**
   ```bash
   redis-server
   ```

3. **Update REDIS_URL in backend .env**
   ```bash
   REDIS_URL=redis://localhost:6379
   ```

### Database Connection Testing

Test your database connections:
```bash
cd backend
node test-all-connections.js
```

## External Services

### Email Service Providers

#### SendGrid (Recommended)
1. Create account at [SendGrid](https://sendgrid.com)
2. Generate API key
3. Configure in backend `.env`:
   ```bash
   SENDGRID_API_KEY=SG.your-api-key
   SENDGRID_FROM_EMAIL=noreply@yourdomain.com
   PRIMARY_EMAIL_PROVIDER=sendgrid
   ```

#### Amazon SES (Alternative)
1. Set up AWS account and SES
2. Configure in backend `.env`:
   ```bash
   AWS_ACCESS_KEY_ID=your-access-key
   AWS_SECRET_ACCESS_KEY=your-secret-key
   AWS_REGION=us-east-1
   SES_FROM_EMAIL=noreply@yourdomain.com
   PRIMARY_EMAIL_PROVIDER=amazon-ses
   ```

### Payment Gateways

#### Stripe (Recommended)
1. Create account at [Stripe](https://stripe.com)
2. Get test keys from dashboard
3. Configure in backend `.env`:
   ```bash
   STRIPE_SECRET_KEY=sk_test_your_test_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   ```

#### Razorpay (Alternative)
1. Create account at [Razorpay](https://razorpay.com)
2. Configure in backend `.env`:
   ```bash
   RAZORPAY_KEY_ID=your-key-id
   RAZORPAY_KEY_SECRET=your-key-secret
   ```

### Google OAuth

1. **Create Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create new project or select existing

2. **Enable Google+ API**
   - Navigate to APIs & Services > Library
   - Search for "Google+ API" and enable

3. **Create OAuth 2.0 Credentials**
   - Go to APIs & Services > Credentials
   - Create OAuth 2.0 Client ID
   - Add authorized redirect URIs:
     - `http://localhost:8000/api/auth/google/callback` (development)
     - `https://api.yourdomain.com/api/auth/google/callback` (production)

4. **Configure in environment files**
   ```bash
   # Backend .env
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   
   # Frontend .env
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id
   ```

### AI Services (Optional)

#### OpenRouter
```bash
OPENROUTER_API_KEY=sk-or-v1-your-api-key
OPENROUTER_SITE_URL=http://localhost:8000
OPENROUTER_SITE_NAME=Your Platform Name
```

#### OpenAI
```bash
OPENAI_API_KEY=sk-your-openai-api-key
```

#### Google Gemini
```bash
GEMINI_API_KEY=your-gemini-api-key
```

## Security Configuration

### JWT Configuration

Generate secure secrets for production:
```bash
# Generate 256-bit secrets
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Configure in backend `.env`:
```bash
JWT_SECRET=your-generated-secret
JWT_REFRESH_SECRET=your-generated-refresh-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### Encryption Keys

Generate encryption key for sensitive data:
```bash
# Generate 256-bit encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Configure in backend `.env`:
```bash
ENCRYPTION_KEY=your-generated-encryption-key
```

### Security Headers

Configure security headers in backend `.env`:
```bash
HELMET_ENABLED=true
CSP_ENABLED=true
HSTS_MAX_AGE=31536000
HSTS_INCLUDE_SUBDOMAINS=true
```

### Rate Limiting

Configure rate limiting:
```bash
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100  # Max requests per window
```

## Deployment Environments

### Development Environment

Use the default `.env` files with local services:
- Database: Local PostgreSQL
- Redis: Local Redis
- Email: SendGrid test keys
- Payments: Stripe test keys

### Staging Environment

Create staging-specific environment files:
- Use staging database and Redis instances
- Use test keys for external services
- Enable debug logging

### Production Environment

Use the template files in `infrastructure/` folder:
- `production.env.example` for backend
- `frontend-production.env.example` for frontend

Key production considerations:
- Use environment variable substitution (e.g., `${DATABASE_URL}`)
- Enable TLS/SSL
- Use production keys for all services
- Enable security monitoring
- Configure proper logging levels

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```
Error: Connection refused
```

**Solutions:**
- Ensure PostgreSQL is running
- Check DATABASE_URL format
- Verify database exists and user has permissions
- Check firewall settings

#### 2. Redis Connection Failed
```
Error: Redis connection failed
```

**Solutions:**
- Ensure Redis server is running
- Check REDIS_URL format
- Verify Redis is accessible on specified port

#### 3. Google OAuth Error
```
Error: Google OAuth is not configured
```

**Solutions:**
- Ensure NEXT_PUBLIC_GOOGLE_CLIENT_ID is set in frontend
- Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend
- Check OAuth redirect URIs in Google Console

#### 4. Email Service Error
```
Error: Email service not configured
```

**Solutions:**
- Verify email service API keys
- Check PRIMARY_EMAIL_PROVIDER setting
- Ensure FROM_EMAIL is configured

#### 5. Payment Gateway Error
```
Error: Stripe key not configured
```

**Solutions:**
- Verify Stripe keys are set
- Use test keys for development
- Check webhook endpoints are configured

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug
NODE_ENV=development
```

### Health Checks

Check application health:
```bash
# Backend health
curl http://localhost:8000/api/health

# Detailed health check
curl http://localhost:8000/api/health/detailed
```

### Validation Scripts

Run configuration validation:
```bash
# Validate environment security
npm run validate:env

# Test database connections
cd backend && node test-all-connections.js

# Test API endpoints
cd backend && node test-api-simple.js
```

## Support

For additional support:
1. Check the troubleshooting section above
2. Review application logs
3. Run validation scripts
4. Check external service status pages
5. Consult service-specific documentation

## Security Best Practices

1. **Never commit .env files** - Use .env.example templates
2. **Use strong secrets** - Generate cryptographically secure keys
3. **Rotate keys regularly** - Especially in production
4. **Use HTTPS in production** - Configure TLS certificates
5. **Monitor security logs** - Enable security monitoring
6. **Keep dependencies updated** - Run security audits regularly
7. **Use environment-specific configurations** - Separate dev/staging/prod
8. **Validate configurations** - Use provided validation scripts