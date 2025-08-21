# Email Sending REST API Documentation

## Overview

This document describes the REST API endpoints for the bulk email platform's email sending functionality. The API supports single email sending, bulk operations, campaign management, and webhook handling with comprehensive rate limiting and quota enforcement.

## Authentication

All API endpoints require authentication using either:
- **Bearer Token**: `Authorization: Bearer <jwt_token>`
- **API Key**: `X-API-Key: <api_key>`

## Rate Limiting

API endpoints are subject to rate limiting based on subscription tiers:
- **Free Tier**: 100 emails/day, 300 recipients/month
- **Paid Standard**: 500-1000 emails/day, 1500-5000 recipients/month  
- **Premium**: 2000-5000 emails/day, 10000-25000 recipients/month
- **Enterprise**: Custom limits

## Email Sending Endpoints

### Send Single Email

Send a single email with validation and quota enforcement.

```http
POST /api/emails/send/single
Content-Type: application/json
Authorization: Bearer <token>

{
  "to": "recipient@example.com",
  "subject": "Email Subject",
  "htmlContent": "<h1>Hello World</h1>",
  "textContent": "Hello World",
  "replyTo": "noreply@example.com",
  "priority": "normal",
  "scheduledAt": "2024-12-25T10:00:00Z",
  "campaignId": "campaign_123",
  "metadata": {
    "source": "api",
    "customField": "value"
  },
  "headers": {
    "X-Custom-Header": "value"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job_1234567890_abc123",
    "emailId": "email_1234567890_def456",
    "status": "queued",
    "message": "Email queued for sending",
    "estimatedDeliveryTime": "Less than 1 minute"
  }
}
```

### Send Bulk Emails

Send multiple emails in a single batch operation.

```http
POST /api/emails/send/bulk
Content-Type: application/json
Authorization: Bearer <token>

{
  "emails": [
    {
      "to": "user1@example.com",
      "subject": "Subject 1",
      "htmlContent": "<h1>Hello User 1</h1>",
      "textContent": "Hello User 1"
    },
    {
      "to": "user2@example.com", 
      "subject": "Subject 2",
      "htmlContent": "<h1>Hello User 2</h1>",
      "textContent": "Hello User 2"
    }
  ],
  "priority": "normal",
  "campaignId": "campaign_123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "batchJobId": "batch_1234567890_xyz789",
    "emailCount": 2,
    "status": "queued",
    "message": "Batch emails queued for sending",
    "estimatedDeliveryTime": "Less than 1 minute"
  }
}
```

### Send Campaign Emails

Send personalized emails to multiple recipients using templates.

```http
POST /api/emails/send/campaign
Content-Type: application/json
Authorization: Bearer <token>

{
  "campaignId": "campaign_123",
  "templateId": "template_456",
  "recipients": [
    {
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "customFields": {
        "company": "Acme Corp"
      }
    },
    {
      "email": "jane@example.com",
      "firstName": "Jane", 
      "lastName": "Smith",
      "customFields": {
        "company": "Tech Inc"
      }
    }
  ],
  "variables": {
    "subject": "Welcome {{firstName}}!",
    "htmlContent": "<h1>Hello {{firstName}} {{lastName}}</h1><p>Welcome to {{company}}!</p>",
    "textContent": "Hello {{firstName}} {{lastName}}, Welcome to {{company}}!"
  },
  "scheduledAt": "2024-12-25T10:00:00Z",
  "priority": "normal"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "campaignId": "campaign_123",
    "batchJobId": "batch_1234567890_campaign",
    "recipientCount": 2,
    "status": "scheduled",
    "scheduledAt": "2024-12-25T10:00:00Z",
    "estimatedDeliveryTime": "Less than 1 minute"
  }
}
```

## Job Management Endpoints

### Get Job Status

Get the status of a specific email job.

```http
GET /api/emails/jobs/{jobId}/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job_1234567890_abc123",
    "status": "completed",
    "progress": 100,
    "createdAt": "2024-01-15T10:00:00Z",
    "processedOn": "2024-01-15T10:00:05Z",
    "finishedOn": "2024-01-15T10:00:10Z",
    "failedReason": null,
    "returnValue": {
      "messageId": "msg_abc123",
      "provider": "amazon-ses"
    }
  }
}
```

### Cancel Job

Cancel a queued or active email job.

```http
DELETE /api/emails/jobs/{jobId}
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job_1234567890_abc123",
    "message": "Job cancelled successfully"
  }
}
```

### Retry Failed Job

Retry a failed email job.

```http
POST /api/emails/jobs/{jobId}/retry
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "job_1234567890_abc123",
    "message": "Job retry initiated successfully"
  }
}
```

### Get User Jobs

Get a list of email jobs for the authenticated user.

```http
GET /api/emails/jobs?status=completed&limit=50&offset=0
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobs": [
      {
        "id": "job_1234567890_abc123",
        "status": "completed",
        "data": {
          "to": "user@example.com",
          "subject": "Test Email",
          "campaignId": "campaign_123",
          "priority": "normal"
        },
        "createdAt": "2024-01-15T10:00:00Z",
        "processedOn": "2024-01-15T10:00:05Z",
        "finishedOn": "2024-01-15T10:00:10Z",
        "failedReason": null,
        "progress": 100
      }
    ],
    "total": 1,
    "limit": 50,
    "offset": 0
  }
}
```

## System Monitoring Endpoints

### Get Queue Statistics

Get email queue statistics and performance metrics.

```http
GET /api/emails/queue/stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "waiting": 150,
    "active": 5,
    "completed": 1000,
    "failed": 10,
    "delayed": 25,
    "paused": 0
  }
}
```

### Get Provider Status

Get the status of email service providers.

```http
GET /api/emails/providers/status
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "providers": {
      "amazon-ses": true,
      "sendgrid": true
    },
    "availableProviders": ["amazon-ses", "sendgrid"],
    "primaryProvider": "amazon-ses",
    "fallbackProvider": "sendgrid"
  }
}
```

## Webhook Endpoints

### Amazon SES Webhook

Receive delivery events from Amazon SES via SNS.

```http
POST /api/emails/webhooks/ses
Content-Type: application/json
X-Amz-Sns-Message-Type: Notification

{
  "Type": "Notification",
  "Message": "{\"eventType\":\"delivery\",\"mail\":{\"messageId\":\"msg_123\"}}"
}
```

### SendGrid Webhook

Receive delivery events from SendGrid.

```http
POST /api/emails/webhooks/sendgrid
Content-Type: application/json
X-Twilio-Email-Event-Webhook-Signature: sha256=signature
X-Twilio-Email-Event-Webhook-Timestamp: 1234567890

[
  {
    "email": "user@example.com",
    "event": "delivered",
    "sg_message_id": "msg_123",
    "timestamp": 1234567890
  }
]
```

### Generic Webhook

Receive events from other email providers.

```http
POST /api/emails/webhooks/{provider}
Content-Type: application/json
X-Webhook-Signature: sha256=signature
X-Webhook-Timestamp: 1234567890

{
  "eventType": "delivered",
  "messageId": "msg_123",
  "email": "user@example.com",
  "timestamp": 1234567890
}
```

## Admin Endpoints

### Pause Queue

Pause the email processing queue (admin only).

```http
POST /api/emails/admin/queue/pause
Authorization: Bearer <admin_token>
```

### Resume Queue

Resume the email processing queue (admin only).

```http
POST /api/emails/admin/queue/resume
Authorization: Bearer <admin_token>
```

### Clean Queue

Clean completed and failed jobs from the queue (admin only).

```http
POST /api/emails/admin/queue/clean
Authorization: Bearer <admin_token>

{
  "grace": 5000
}
```

### Switch Provider

Switch the primary email provider (admin only).

```http
POST /api/emails/admin/providers/switch
Authorization: Bearer <admin_token>

{
  "provider": "sendgrid"
}
```

### Get All Jobs

Get all email jobs across all users (admin only).

```http
GET /api/emails/admin/jobs?status=failed&limit=100&offset=0
Authorization: Bearer <admin_token>
```

### Get Provider Health

Get detailed health information for all providers (admin only).

```http
GET /api/emails/admin/providers/health
Authorization: Bearer <admin_token>
```

### Get System Metrics

Get comprehensive system metrics (admin only).

```http
GET /api/emails/admin/metrics
Authorization: Bearer <admin_token>
```

### Get System Health

Get overall system health status (admin only).

```http
GET /api/emails/admin/health
Authorization: Bearer <admin_token>
```

## Error Responses

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      "field": "Additional error details"
    }
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR`: Request validation failed
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `QUOTA_EXCEEDED`: Usage quota exceeded
- `JOB_NOT_FOUND`: Email job not found
- `INTERNAL_ERROR`: Server error
- `WEBHOOK_SIGNATURE_INVALID`: Webhook signature verification failed
- `WEBHOOK_PROCESSING_ERROR`: Webhook processing failed

## Rate Limiting Headers

Rate-limited endpoints include headers with quota information:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
X-Quota-Type: daily_emails
X-Quota-Usage: 1
X-Quota-Limit: 1000
```

## Webhook Security

### HMAC Signature Verification

All webhooks include HMAC signatures for verification:

1. **SendGrid**: Uses `X-Twilio-Email-Event-Webhook-Signature` header
2. **Amazon SES**: Uses SNS signature verification
3. **Generic**: Uses `X-Webhook-Signature` header with `sha256=` prefix

### Signature Calculation

```javascript
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(timestamp + '.' + requestBody)
  .digest('hex');
```

## SDK Examples

### Node.js

```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'https://api.bulkemail.com',
  headers: {
    'Authorization': 'Bearer your_jwt_token',
    'Content-Type': 'application/json'
  }
});

// Send single email
const response = await client.post('/api/emails/send/single', {
  to: 'user@example.com',
  subject: 'Hello World',
  htmlContent: '<h1>Hello World</h1>'
});

console.log(response.data);
```

### Python

```python
import requests

headers = {
    'Authorization': 'Bearer your_jwt_token',
    'Content-Type': 'application/json'
}

# Send single email
response = requests.post(
    'https://api.bulkemail.com/api/emails/send/single',
    headers=headers,
    json={
        'to': 'user@example.com',
        'subject': 'Hello World',
        'htmlContent': '<h1>Hello World</h1>'
    }
)

print(response.json())
```

### cURL

```bash
# Send single email
curl -X POST https://api.bulkemail.com/api/emails/send/single \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user@example.com",
    "subject": "Hello World", 
    "htmlContent": "<h1>Hello World</h1>"
  }'
```

## Scheduled Email Integration

The email API integrates with the scheduled email system:

- Emails with `scheduledAt` parameter are automatically queued for future delivery
- Subscription users limited to 14 days advance scheduling
- Recharge users have no time limit but require sufficient balance
- Scheduled emails are cancelled if subscription expires or balance insufficient

## Campaign Integration

The email API integrates with the campaign management system:

- Emails can be associated with campaigns using `campaignId`
- Campaign emails support template variables and personalization
- Campaign metrics are automatically tracked
- Bulk campaign operations are supported

This API provides comprehensive email sending capabilities with enterprise-grade features including rate limiting, quota enforcement, webhook handling, and detailed monitoring.