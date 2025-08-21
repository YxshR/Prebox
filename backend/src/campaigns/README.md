# Campaign Management System

This module provides comprehensive campaign and template management for the bulk email platform, including email composition, bulk sending with queue processing, campaign scheduling, and delivery tracking.

## Features

- **Template Management**: Create, update, and manage email templates with variable support
- **Campaign Creation**: Create and manage email campaigns with scheduling capabilities
- **Bulk Email Sending**: Queue-based bulk email processing with real-time tracking
- **Delivery Tracking**: Real-time email delivery status and engagement tracking
- **Campaign Analytics**: Comprehensive metrics and performance analytics
- **Queue Management**: Monitor and control email sending queues

## Architecture

```
Campaign Management
├── Template System
├── Campaign Creation & Management
├── Queue-Based Email Processing
├── Delivery Tracking & Analytics
└── Real-time Status Updates
```

## API Endpoints

### Template Management

#### Create Template
```http
POST /api/campaigns/templates
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Welcome Email",
  "subject": "Welcome {{firstName}}!",
  "htmlContent": "<h1>Welcome {{firstName}} {{lastName}}!</h1><p>Thanks for joining us.</p>",
  "textContent": "Welcome {{firstName}} {{lastName}}! Thanks for joining us.",
  "variables": [
    {
      "name": "firstName",
      "type": "text",
      "required": true
    },
    {
      "name": "lastName", 
      "type": "text",
      "required": false
    }
  ],
  "isAIGenerated": false
}
```

#### List Templates
```http
GET /api/campaigns/templates
Authorization: Bearer <token>
```

#### Get Template
```http
GET /api/campaigns/templates/{templateId}
Authorization: Bearer <token>
```

#### Update Template
```http
PUT /api/campaigns/templates/{templateId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Welcome Email",
  "subject": "Welcome to our platform {{firstName}}!"
}
```

### Campaign Management

#### Create Campaign
```http
POST /api/campaigns/campaigns
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Q1 Newsletter Campaign",
  "templateId": "template_123",
  "listIds": ["list_456", "list_789"],
  "scheduledAt": "2024-01-15T10:00:00Z",
  "priority": "normal"
}
```

#### List Campaigns
```http
GET /api/campaigns/campaigns
Authorization: Bearer <token>
```

#### Get Campaign
```http
GET /api/campaigns/campaigns/{campaignId}
Authorization: Bearer <token>
```

#### Send Campaign
```http
POST /api/campaigns/campaigns/{campaignId}/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "contacts": [
    {
      "email": "user1@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "customFields": {
        "company": "Acme Corp"
      }
    },
    {
      "email": "user2@example.com", 
      "firstName": "Jane",
      "lastName": "Smith"
    }
  ],
  "variables": {
    "companyName": "Our Company",
    "year": "2024"
  }
}
```

#### Schedule Campaign
```http
POST /api/campaigns/campaigns/{campaignId}/schedule
Authorization: Bearer <token>
Content-Type: application/json

{
  "scheduledAt": "2024-01-20T14:30:00Z"
}
```

#### Update Campaign Status
```http
PATCH /api/campaigns/campaigns/{campaignId}/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "paused"
}
```

### Analytics and Monitoring

#### Get Campaign Metrics
```http
GET /api/campaigns/campaigns/{campaignId}/metrics
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "data": {
    "totalRecipients": 1000,
    "delivered": 950,
    "bounced": 25,
    "opened": 380,
    "clicked": 95,
    "unsubscribed": 5,
    "complained": 2
  }
}
```

#### Get Queue Statistics
```http
GET /api/campaigns/queue/stats
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "data": {
    "waiting": 150,
    "active": 5,
    "completed": 2340,
    "failed": 12,
    "delayed": 45
  }
}
```

#### Get Job Status
```http
GET /api/campaigns/jobs/{jobId}/status
Authorization: Bearer <token>
```

#### Cancel Job
```http
DELETE /api/campaigns/jobs/{jobId}
Authorization: Bearer <token>
```

#### Retry Failed Job
```http
POST /api/campaigns/jobs/{jobId}/retry
Authorization: Bearer <token>
```

## Usage Examples

### Creating and Sending a Campaign

```typescript
import { CampaignService, CreateTemplateRequest, CreateCampaignRequest } from './campaigns';

const campaignService = new CampaignService(emailService);

// 1. Create a template
const template = await campaignService.createTemplate({
  tenantId: 'tenant-123',
  name: 'Product Launch Email',
  subject: 'Introducing {{productName}} - {{firstName}}!',
  htmlContent: `
    <h1>Hi {{firstName}}!</h1>
    <p>We're excited to introduce our new product: <strong>{{productName}}</strong></p>
    <p>Special launch price: <strong>{{price}}</strong></p>
    <a href="{{ctaLink}}">Learn More</a>
  `,
  variables: [
    { name: 'firstName', type: 'text', required: true },
    { name: 'productName', type: 'text', required: true },
    { name: 'price', type: 'text', required: true },
    { name: 'ctaLink', type: 'text', required: true }
  ]
});

// 2. Create a campaign
const campaign = await campaignService.createCampaign({
  tenantId: 'tenant-123',
  name: 'Product Launch Campaign',
  templateId: template.id,
  listIds: ['customers-list', 'prospects-list']
});

// 3. Send the campaign
const result = await campaignService.sendCampaign({
  campaignId: campaign.id,
  contacts: [
    {
      email: 'customer@example.com',
      firstName: 'Alice',
      customFields: { segment: 'premium' }
    }
  ],
  variables: {
    productName: 'SuperWidget Pro',
    price: '$99.99',
    ctaLink: 'https://example.com/superwidget-pro'
  }
});

console.log(`Campaign sent: ${result.totalJobs} emails queued`);
```

### Monitoring Campaign Performance

```typescript
// Get real-time campaign metrics
const metrics = await campaignService.getCampaignMetrics(campaign.id, 'tenant-123');
console.log(`Delivery rate: ${(metrics.delivered / metrics.totalRecipients * 100).toFixed(1)}%`);
console.log(`Open rate: ${(metrics.opened / metrics.delivered * 100).toFixed(1)}%`);
console.log(`Click rate: ${(metrics.clicked / metrics.delivered * 100).toFixed(1)}%`);

// Monitor queue status
const queueStats = await campaignService.getQueueStats();
console.log(`Queue status: ${queueStats.active} active, ${queueStats.waiting} waiting`);
```

### Template Variable System

Templates support dynamic content through variables using `{{variableName}}` syntax:

- **Basic Variables**: `{{firstName}}`, `{{email}}`
- **Custom Fields**: `{{company}}`, `{{segment}}`
- **Global Variables**: `{{companyName}}`, `{{year}}`

Variables are automatically extracted from template content and can be customized per campaign send.

## Campaign Status Flow

```
DRAFT → SCHEDULED → SENDING → SENT
  ↓         ↓         ↓        ↓
PAUSED   PAUSED   PAUSED   (final)
  ↓         ↓         ↓
FAILED   FAILED   FAILED
```

- **DRAFT**: Campaign created but not scheduled
- **SCHEDULED**: Campaign scheduled for future sending
- **SENDING**: Campaign currently being processed
- **SENT**: Campaign successfully completed
- **PAUSED**: Campaign temporarily paused
- **FAILED**: Campaign failed to send

## Queue Processing

The system uses Bull queues with Redis for reliable email processing:

- **Concurrency**: Configurable concurrent job processing
- **Retry Logic**: Automatic retry with exponential backoff
- **Priority Handling**: Support for different priority levels
- **Batch Processing**: Efficient bulk email handling
- **Monitoring**: Real-time queue statistics and job tracking

## Delivery Tracking

Real-time tracking of email delivery events:

- **SENT**: Email accepted by provider
- **DELIVERED**: Email delivered to recipient
- **BOUNCED**: Email bounced (permanent/temporary)
- **OPENED**: Recipient opened the email
- **CLICKED**: Recipient clicked a link
- **COMPLAINED**: Recipient marked as spam
- **UNSUBSCRIBED**: Recipient unsubscribed

## Error Handling

Comprehensive error handling with specific error codes:

- **TEMPLATE_CREATION_FAILED**: Template validation or creation error
- **CAMPAIGN_CREATION_FAILED**: Campaign validation or creation error
- **CAMPAIGN_SEND_FAILED**: Campaign sending error
- **VALIDATION_ERROR**: Request validation failure
- **CAMPAIGN_NOT_FOUND**: Campaign or template not found

## Testing

Run campaign service tests:

```bash
npm test -- --testPathPattern=campaign
```

## Requirements Satisfied

This implementation satisfies the following requirements:

- **2.1**: Template-based email composition with variables
- **6.1**: Drag-and-drop template editor support (backend API)
- **6.3**: Campaign scheduling functionality
- **13.2**: Real-time campaign status tracking with animated badges

## Integration Points

- **Email Service**: Integrates with email providers for sending
- **Queue System**: Uses Bull/Redis for reliable processing
- **Analytics Service**: Provides metrics for dashboard display
- **Webhook System**: Processes delivery events from providers

## Next Steps

1. Add database persistence for campaigns and templates
2. Implement A/B testing functionality
3. Add advanced segmentation and targeting
4. Implement campaign automation workflows
5. Add more sophisticated analytics and reporting