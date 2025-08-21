# API Authentication and Security System

This document describes the comprehensive API authentication and security system implemented for the bulk email platform.

## Overview

The API authentication system provides secure access control, rate limiting, and usage tracking for the bulk email platform. It supports both JWT tokens for web applications and API keys for programmatic access.

## ✅ Task 23 Implementation Status

This implementation covers all requirements for Task 23: "Implement API authentication and security":

- ✅ **API Key Generation and Management System**: Complete with tier-based limits and scoping
- ✅ **Rate Limiting per Subscription Tier**: Redis-backed with multiple time windows
- ✅ **Request Validation and Error Handling**: Comprehensive validation with Joi schemas
- ✅ **API Usage Tracking and Analytics**: Detailed logging and aggregated analytics
- ✅ **Enhanced Security Features**: Input sanitization, CORS protection, security headers
- ✅ **Comprehensive Error Handling**: Standardized error responses with security logging

## Features

### 1. API Key Management
- **Generation**: Create API keys with custom names and scopes
- **Validation**: Secure API key validation with bcrypt hashing
- **Scoping**: Fine-grained permissions based on subscription tiers
- **Expiration**: Optional expiration dates for enhanced security
- **Revocation**: Instant API key deactivation

### 2. Rate Limiting
- **Tier-based Limits**: Different rate limits per subscription tier
- **Multiple Windows**: Hourly, daily, and monthly rate limiting
- **Redis-backed**: Fast, distributed rate limiting using Redis
- **IP-based Limiting**: Protection against unauthenticated abuse
- **Graceful Degradation**: Fallback behavior when Redis is unavailable

### 3. Usage Tracking and Analytics
- **Detailed Logging**: Track every API call with metadata
- **Performance Metrics**: Response times, data transfer, error rates
- **Daily Aggregation**: Efficient analytics storage and retrieval
- **Dashboard Integration**: Real-time usage statistics

### 4. Security Features
- **Request Validation**: Comprehensive input validation with Joi
- **Error Handling**: Secure error responses without information leakage
- **Security Headers**: CORS, CSP, and other security headers
- **Request Size Limiting**: Protection against large payload attacks
- **Timeout Handling**: Prevent resource exhaustion

## Database Schema

### API Keys Table
```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    tenant_id UUID REFERENCES tenants(id),
    key_hash VARCHAR(255) UNIQUE,
    name VARCHAR(100),
    scopes JSONB,
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Rate Limits Table
```sql
CREATE TABLE rate_limits (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    api_key_id UUID REFERENCES api_keys(id),
    limit_type VARCHAR(50), -- 'hourly', 'daily', 'monthly'
    limit_value INTEGER,
    current_usage INTEGER DEFAULT 0,
    reset_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### API Usage Table
```sql
CREATE TABLE api_usage (
    id UUID PRIMARY KEY,
    api_key_id UUID REFERENCES api_keys(id),
    tenant_id UUID REFERENCES tenants(id),
    endpoint VARCHAR(255),
    method VARCHAR(10),
    status_code INTEGER,
    response_time_ms INTEGER,
    request_size_bytes INTEGER,
    response_size_bytes INTEGER,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### API Key Management

#### Create API Key
```http
POST /api/auth/api-keys
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "My API Key",
  "scopes": ["email:send", "email:read"],
  "expiresAt": "2024-12-31T23:59:59Z" // optional
}
```

#### List API Keys
```http
GET /api/auth/api-keys
Authorization: Bearer <jwt_token>
```

#### Get API Key Usage
```http
GET /api/auth/api-keys/{keyId}/usage?days=30
Authorization: Bearer <jwt_token>
```

#### Update API Key
```http
PUT /api/auth/api-keys/{keyId}
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Updated Key Name",
  "scopes": ["email:send", "templates:read"]
}
```

#### Revoke API Key
```http
DELETE /api/auth/api-keys/{keyId}
Authorization: Bearer <jwt_token>
```

#### Test API Key
```http
GET /api/auth/api-keys/test
X-API-Key: bep_your_api_key_here
```

### Analytics

#### Get API Analytics
```http
GET /api/auth/api-keys/analytics?days=30&apiKeyId=key-123
Authorization: Bearer <jwt_token>
```

## Subscription Tier Limits

### Free Tier
- **API Keys**: 1 maximum
- **Scopes**: `email:send`, `email:read`
- **Rate Limits**: 50/hour, 100/day, 2,000/month

### Paid Standard Tier
- **API Keys**: 3 maximum
- **Scopes**: Basic + `templates:read`, `templates:write`, `contacts:read`
- **Rate Limits**: 500/hour, 1,000/day, 30,000/month

### Premium Tier
- **API Keys**: 10 maximum
- **Scopes**: Standard + `contacts:write`, `analytics:read`, `domains:read`
- **Rate Limits**: 2,000/hour, 5,000/day, 100,000/month

### Enterprise Tier
- **API Keys**: 50 maximum
- **Scopes**: All scopes including `domains:write`, `admin:read`
- **Rate Limits**: 10,000/hour, 25,000/day, 1,000,000/month

## Available Scopes

| Scope | Description | Minimum Tier |
|-------|-------------|---------------|
| `email:send` | Send emails via API | Free |
| `email:read` | Read email status and history | Free |
| `templates:read` | View email templates | Paid Standard |
| `templates:write` | Create/modify templates | Paid Standard |
| `contacts:read` | View contact lists | Paid Standard |
| `contacts:write` | Manage contacts and lists | Premium |
| `analytics:read` | Access analytics data | Premium |
| `domains:read` | View domain settings | Premium |
| `domains:write` | Manage domain configuration | Enterprise |
| `admin:read` | Administrative access | Enterprise |

## Usage Examples

### Using API Keys in Requests

#### With cURL
```bash
curl -X POST https://api.bulkemail.com/v1/emails/send \
  -H "X-API-Key: bep_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "recipient@example.com",
    "subject": "Test Email",
    "html": "<h1>Hello World</h1>"
  }'
```

#### With JavaScript
```javascript
const response = await fetch('https://api.bulkemail.com/v1/emails/send', {
  method: 'POST',
  headers: {
    'X-API-Key': 'bep_your_api_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    to: 'recipient@example.com',
    subject: 'Test Email',
    html: '<h1>Hello World</h1>'
  })
});
```

#### With Python
```python
import requests

headers = {
    'X-API-Key': 'bep_your_api_key_here',
    'Content-Type': 'application/json'
}

data = {
    'to': 'recipient@example.com',
    'subject': 'Test Email',
    'html': '<h1>Hello World</h1>'
}

response = requests.post(
    'https://api.bulkemail.com/v1/emails/send',
    headers=headers,
    json=data
)
```

## Rate Limit Headers

All API responses include rate limit information:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
Retry-After: 3600
```

## Error Responses

### Rate Limit Exceeded
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "API rate limit exceeded",
    "details": {
      "limit": 1000,
      "resetTime": "2024-01-01T12:00:00Z",
      "retryAfter": 3600
    },
    "timestamp": "2024-01-01T11:00:00Z",
    "requestId": "req_123456789"
  }
}
```

### Invalid API Key
```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "Invalid API key",
    "timestamp": "2024-01-01T11:00:00Z",
    "requestId": "req_123456789"
  }
}
```

### Insufficient Scope
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_SCOPE",
    "message": "Required scope: templates:write",
    "details": {
      "requiredScope": "templates:write",
      "availableScopes": ["email:send", "email:read"]
    },
    "timestamp": "2024-01-01T11:00:00Z",
    "requestId": "req_123456789"
  }
}
```

## Security Best Practices

### API Key Security
1. **Store Securely**: Never commit API keys to version control
2. **Use Environment Variables**: Store keys in secure environment variables
3. **Rotate Regularly**: Generate new keys periodically
4. **Minimal Scopes**: Only grant necessary permissions
5. **Monitor Usage**: Regularly review API key usage patterns

### Rate Limiting
1. **Implement Exponential Backoff**: Handle rate limits gracefully
2. **Cache Responses**: Reduce API calls where possible
3. **Batch Operations**: Use bulk endpoints when available
4. **Monitor Limits**: Track usage against quotas

### Error Handling
1. **Don't Expose Internals**: Sanitize error messages
2. **Log Security Events**: Monitor for suspicious activity
3. **Implement Retry Logic**: Handle transient failures
4. **Validate All Inputs**: Never trust client data

## Monitoring and Alerting

### Key Metrics to Monitor
- API key usage patterns
- Rate limit violations
- Error rates by endpoint
- Response time trends
- Suspicious IP activity

### Recommended Alerts
- High error rates (>5%)
- Rate limit violations
- Unusual usage patterns
- Failed authentication attempts
- API key creation/deletion

## Testing

### Unit Tests
```bash
npm test src/auth/api-key.service.test.ts
npm test src/auth/rate-limiter.service.test.ts
```

### Integration Tests
```bash
npm test src/auth/api-key.integration.test.ts
```

### Load Testing
```bash
# Test rate limiting under load
npm run test:load -- --endpoint=/api/keys/test --concurrent=100
```

## Deployment Considerations

### Environment Variables
```bash
# Required
JWT_SECRET=your-jwt-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@localhost/db

# Optional
API_RATE_LIMIT_WINDOW_MS=3600000
API_RATE_LIMIT_MAX_REQUESTS=1000
API_KEY_EXPIRY_DAYS=365
USAGE_RETENTION_DAYS=90
```

### Redis Configuration
- Enable persistence for rate limit data
- Configure appropriate memory limits
- Set up Redis clustering for high availability
- Monitor Redis performance and memory usage

### Database Optimization
- Index frequently queried columns
- Partition large tables by date
- Regular cleanup of old usage records
- Monitor query performance

## Troubleshooting

### Common Issues

#### Rate Limits Not Working
1. Check Redis connectivity
2. Verify rate limit configuration
3. Check system clock synchronization
4. Review Redis memory usage

#### API Keys Not Validating
1. Verify bcrypt hash comparison
2. Check database connectivity
3. Ensure API key format is correct
4. Review expiration dates

#### High Response Times
1. Check database query performance
2. Monitor Redis latency
3. Review rate limiting overhead
4. Optimize frequently used queries

### Debug Mode
Enable debug logging:
```bash
DEBUG=auth:* npm start
```

This will provide detailed logging for authentication and rate limiting operations.