# Email Service Provider Integration

This module provides comprehensive email service provider integration for the bulk email platform, supporting Amazon SES and SendGrid with queue-based processing, bounce/complaint handling, and webhook processing.

## Features

- **Multi-Provider Support**: Amazon SES and SendGrid integration with automatic failover
- **Queue-Based Processing**: Redis/Bull queue system for reliable email delivery
- **Bounce & Complaint Handling**: Automatic suppression list management
- **Webhook Processing**: Real-time delivery event processing
- **Rate Limiting**: Respect provider rate limits and quotas
- **Retry Logic**: Exponential backoff for failed sends
- **Monitoring**: Queue statistics and provider status monitoring

## Architecture

```
Email Service
├── Providers (SES, SendGrid)
├── Queue System (Bull/Redis)
├── Webhook Handlers
├── Event Processing
└── API Controllers
```

## Configuration

### Environment Variables

```bash
# Primary and fallback providers
PRIMARY_EMAIL_PROVIDER=amazon-ses
FALLBACK_EMAIL_PROVIDER=sendgrid

# Amazon SES Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
SES_FROM_EMAIL=noreply@yourdomain.com

# SendGrid Configuration
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_WEBHOOK_SECRET=your-webhook-secret

# Redis Configuration (for queues)
REDIS_URL=redis://localhost:6379
```

## API Endpoints

### Send Single Email
```http
POST /api/emails/send/single
Authorization: Bearer <token>
Content-Type: application/json

{
  "to": "recipient@example.com",
  "subject": "Test Email",
  "htmlContent": "<h1>Hello World</h1>",
  "textContent": "Hello World",
  "replyTo": "reply@example.com",
  "priority": "normal",
  "scheduledAt": "2024-01-01T12:00:00Z"
}
```

### Send Batch Emails
```http
POST /api/emails/send/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "emails": [
    {
      "to": "recipient1@example.com",
      "subject": "Test Email 1",
      "htmlContent": "<h1>Hello World 1</h1>"
    },
    {
      "to": "recipient2@example.com",
      "subject": "Test Email 2",
      "htmlContent": "<h1>Hello World 2</h1>"
    }
  ],
  "priority": "normal"
}
```

### Get Job Status
```http
GET /api/emails/jobs/{jobId}/status
Authorization: Bearer <token>
```

### Get Queue Statistics
```http
GET /api/emails/queue/stats
Authorization: Bearer <token>
```

### Get Provider Status
```http
GET /api/emails/providers/status
Authorization: Bearer <token>
```

## Webhook Endpoints

### Amazon SES Webhooks
```http
POST /api/emails/webhooks/ses
Content-Type: application/json

# SNS notification payload
```

### SendGrid Webhooks
```http
POST /api/emails/webhooks/sendgrid
Content-Type: application/json

# SendGrid event payload
```

## Usage Examples

### Basic Email Sending

```typescript
import { EmailService, EmailPriority } from './emails';

const emailService = new EmailService();

// Create and send email job
const emailJob = emailService.createEmailJob({
  tenantId: 'tenant-123',
  to: 'user@example.com',
  from: 'noreply@yourdomain.com',
  subject: 'Welcome!',
  htmlContent: '<h1>Welcome to our platform!</h1>',
  priority: EmailPriority.HIGH
});

const result = await emailService.sendSingleEmail(emailJob);
console.log('Email sent:', result.messageId);
```

### Queue Management

```typescript
import { EmailQueue } from './emails';

const emailQueue = new EmailQueue(emailService);

// Add email to queue
const job = await emailQueue.addEmailJob(emailJob);

// Get queue statistics
const stats = await emailQueue.getJobStats();
console.log('Queue stats:', stats);

// Pause/resume queue
await emailQueue.pauseQueue();
await emailQueue.resumeQueue();
```

### Webhook Processing

```typescript
import { WebhookHandler } from './emails';

const webhookHandler = new WebhookHandler();

// In your Express route
app.post('/webhooks/ses', webhookHandler.handleSESWebhook.bind(webhookHandler));
app.post('/webhooks/sendgrid', webhookHandler.handleSendGridWebhook.bind(webhookHandler));
```

## Event Types

The system processes the following email events:

- **SENT**: Email was sent to the provider
- **DELIVERED**: Email was delivered to recipient
- **BOUNCED**: Email bounced (permanent or temporary)
- **COMPLAINED**: Recipient marked email as spam
- **OPENED**: Recipient opened the email
- **CLICKED**: Recipient clicked a link in the email
- **UNSUBSCRIBED**: Recipient unsubscribed

## Bounce and Complaint Handling

The system automatically:

1. **Processes bounce events** and adds permanent bounces to suppression list
2. **Handles complaints** by immediately suppressing complainants
3. **Updates contact status** based on engagement events
4. **Maintains suppression lists** to prevent future sends to problematic addresses

## Queue Configuration

Default queue settings:

```typescript
{
  concurrency: 5,           // Concurrent job processing
  retryAttempts: 3,         // Number of retry attempts
  retryDelay: 5000,         // Initial retry delay (ms)
  removeOnComplete: 100,    // Keep completed jobs
  removeOnFail: 50          // Keep failed jobs
}
```

## Monitoring and Observability

### Queue Statistics
- Waiting jobs count
- Active jobs count
- Completed jobs count
- Failed jobs count
- Delayed jobs count

### Provider Status
- Configuration validation
- Send quota information (SES)
- Rate limit status
- Health check results

## Error Handling

The service implements comprehensive error handling:

1. **Provider Failover**: Automatic fallback to secondary provider
2. **Retry Logic**: Exponential backoff for transient failures
3. **Dead Letter Queue**: Failed jobs are preserved for analysis
4. **Error Logging**: Detailed error logging for debugging

## Security Considerations

1. **Webhook Signature Verification**: Validates incoming webhook signatures
2. **Rate Limiting**: Prevents abuse through quota enforcement
3. **Input Validation**: Comprehensive request validation using Joi
4. **Authentication**: All API endpoints require valid JWT tokens

## Testing

Run the email service tests:

```bash
npm test -- --testPathPattern=email
```

## Requirements Satisfied

This implementation satisfies the following requirements:

- **2.2**: Queue-based email processing system
- **2.3**: Integration with Amazon SES/SendGrid
- **2.5**: Retry logic with exponential backoff
- **4.4**: Webhook processing for delivery events

## Next Steps

1. Implement database models for email events and suppression lists
2. Add campaign-specific metrics tracking
3. Implement advanced analytics and reporting
4. Add support for additional email providers
5. Implement email template management integration