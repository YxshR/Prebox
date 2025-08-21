# Scheduled Email System

This document describes the scheduled email system implementation that allows users to schedule emails for future delivery with automatic sending capabilities.

## Overview

The scheduled email system provides the following functionality:
- Schedule emails for future delivery (up to 14 days for subscription users, unlimited for recharge users)
- Automatic email sending without user intervention
- Subscription expiry validation for scheduled emails
- Recharge balance validation before sending scheduled emails
- Manual trigger function for system recovery

## Requirements Implemented

### Requirement 17.1 - Email Scheduling with Time Limits
- **Subscription Users**: Can schedule emails up to 14 days in advance
- **Recharge Users**: No time limit for scheduling
- Validation ensures scheduling dates are appropriate for user type

### Requirement 17.2 - Automatic Email Sending
- Cron job runs every minute to process due scheduled emails
- No user intervention required for sending
- Automatic retry mechanism for failed sends

### Requirement 17.3 - Subscription Expiry Validation
- Scheduled emails are cancelled if subscription expires before send time
- Pre-send validation checks subscription status
- Clear error messages for expired subscriptions

### Requirement 17.4 - Recharge Balance Validation
- Wallet balance checked before scheduling and sending
- Automatic deduction from wallet when emails are sent
- Clear error messages for insufficient balance

### Requirement 17.5 - Manual Trigger Function
- Admin endpoint for manual processing of scheduled emails
- System recovery functionality for failed cron jobs
- Ability to trigger specific scheduled emails or all due emails

## Architecture

### Core Components

1. **ScheduledEmailService** - Main business logic
2. **ScheduledEmailController** - API endpoints
3. **ScheduledEmailCron** - Automatic processing
4. **Database Schema** - Persistent storage

### Database Schema

```sql
CREATE TABLE scheduled_emails (
    id VARCHAR(255) PRIMARY KEY,
    tenant_id VARCHAR(255) NOT NULL,
    campaign_id VARCHAR(255),
    email_job JSONB NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('subscription', 'recharge')),
    estimated_cost DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3
);
```

### Status Flow

```
PENDING → PROCESSING → SENT
   ↓           ↓
CANCELLED   FAILED
```

## API Endpoints

### Schedule Email
```http
POST /api/emails/schedule
Content-Type: application/json

{
  "tenantId": "tenant_123",
  "campaignId": "campaign_456", // optional
  "emailJob": {
    "to": ["recipient@example.com"],
    "from": "sender@example.com",
    "subject": "Scheduled Email",
    "htmlContent": "<h1>Hello World</h1>",
    "textContent": "Hello World"
  },
  "scheduledAt": "2024-12-25T10:00:00Z",
  "userType": "subscription" // or "recharge"
}
```

### Cancel Scheduled Email
```http
DELETE /api/emails/schedule/{scheduleId}
Content-Type: application/json

{
  "reason": "User requested cancellation"
}
```

### Get Scheduled Emails
```http
GET /api/emails/schedule?tenantId=tenant_123&status=pending&limit=50&offset=0
```

### Validate Scheduling
```http
POST /api/emails/schedule/validate
Content-Type: application/json

{
  "tenantId": "tenant_123",
  "scheduledAt": "2024-12-25T10:00:00Z",
  "userType": "subscription",
  "recipientCount": 100
}
```

### Manual Trigger (Admin)
```http
POST /api/emails/schedule/trigger
Content-Type: application/json

{
  "scheduleIds": ["schedule_1", "schedule_2"] // optional, triggers all if empty
}
```

### Process Scheduled Emails (System)
```http
POST /api/emails/schedule/process
```

## Usage Examples

### Scheduling an Email for Subscription User

```typescript
import { ScheduledEmailService } from './scheduled-email.service';

const service = new ScheduledEmailService();

const request = {
  tenantId: 'tenant_123',
  emailJob: {
    to: ['customer@example.com'],
    from: 'noreply@company.com',
    subject: 'Weekly Newsletter',
    htmlContent: '<h1>This Week in Tech</h1><p>...</p>'
  },
  scheduledAt: new Date('2024-12-25T09:00:00Z'),
  userType: 'subscription' as const
};

const scheduledEmail = await service.scheduleEmail(request);
console.log(`Email scheduled with ID: ${scheduledEmail.id}`);
```

### Validating Scheduling Limits

```typescript
const validation = await service.validateScheduling(
  'tenant_123',
  new Date('2024-12-25T09:00:00Z'),
  'subscription',
  100 // recipient count
);

if (!validation.isValid) {
  console.error(`Scheduling failed: ${validation.reason}`);
  if (validation.maxScheduleDate) {
    console.log(`Maximum schedule date: ${validation.maxScheduleDate}`);
  }
}
```

### Processing Scheduled Emails (Cron Job)

```typescript
import { scheduledEmailCron } from './scheduled-email.cron';

// Start automatic processing
scheduledEmailCron.start();

// Manual trigger for recovery
const result = await scheduledEmailCron.manualTrigger();
console.log(`Processed ${result.totalProcessed} emails`);
```

## Error Handling

### Common Error Scenarios

1. **Past Scheduling Date**
   - Error: "Scheduled time must be in the future"
   - Solution: Use a future date

2. **Subscription User Beyond 14 Days**
   - Error: "Subscription users can only schedule emails up to 14 days in advance"
   - Solution: Use recharge credits or schedule within limit

3. **Insufficient Wallet Balance**
   - Error: "Insufficient wallet balance. Required: ₹10.00, Available: ₹5.00"
   - Solution: Add funds to wallet

4. **Expired Subscription**
   - Error: "Subscription will expire before scheduled send time"
   - Solution: Renew subscription or use recharge credits

### Retry Logic

- Failed emails are retried up to 3 times
- Exponential backoff between retries
- After max retries, status changes to 'failed'

## Monitoring and Observability

### Logging

All operations are logged with appropriate levels:
- INFO: Successful operations
- WARN: Partial failures or warnings
- ERROR: System errors and failures

### Metrics to Monitor

1. **Processing Metrics**
   - Emails processed per minute
   - Success/failure rates
   - Processing latency

2. **Business Metrics**
   - Scheduled emails by user type
   - Cancellation rates
   - Cost estimation accuracy

3. **System Health**
   - Cron job execution status
   - Database connection health
   - Queue processing delays

## Configuration

### Environment Variables

```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bulk_email_platform
DB_USER=postgres
DB_PASSWORD=password

# Email Providers
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
SENDGRID_API_KEY=your_sendgrid_key

# Cron Job Settings
SCHEDULED_EMAIL_CRON_ENABLED=true
SCHEDULED_EMAIL_HIGH_FREQUENCY=false
```

### Deployment Considerations

1. **Database Indexes**: Ensure proper indexes are created for performance
2. **Cron Job Scaling**: Only run cron job on one instance in multi-instance deployments
3. **Monitoring**: Set up alerts for failed processing and high error rates
4. **Backup**: Regular backups of scheduled_emails table

## Testing

### Unit Tests

Run the test suite:
```bash
npm test scheduled-email.service.test.ts
```

### Integration Tests

Test with real database:
```bash
npm run test:integration
```

### Load Testing

Test scheduling and processing under load:
```bash
npm run test:load
```

## Security Considerations

1. **Authentication**: All endpoints require valid authentication
2. **Authorization**: Users can only access their own scheduled emails
3. **Input Validation**: All inputs are validated and sanitized
4. **Rate Limiting**: API endpoints have appropriate rate limits
5. **Data Encryption**: Sensitive data is encrypted at rest and in transit

## Future Enhancements

1. **Advanced Scheduling**: Support for recurring emails
2. **Time Zone Support**: Schedule emails in user's local time zone
3. **Template Integration**: Direct integration with email templates
4. **Bulk Scheduling**: Schedule multiple emails at once
5. **Analytics**: Detailed analytics for scheduled email performance