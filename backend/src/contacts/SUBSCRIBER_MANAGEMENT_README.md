# Subscriber Management System

This module implements comprehensive subscriber management features for the bulk email platform, including unsubscribe handling, preference management, contact deduplication, and engagement analytics.

## Features

### 1. One-Click Unsubscribe Support
- **RFC-compliant unsubscribe headers** for email clients
- **Secure token-based unsubscribe links** with expiration
- **Public unsubscribe endpoint** that doesn't require authentication
- **Branded unsubscribe pages** with success/error feedback
- **Automatic suppression list management**

### 2. Subscriber Preference Management
- **Granular communication preferences** (marketing, transactional, newsletters, promotions)
- **Frequency controls** (daily, weekly, monthly, never)
- **Category-based subscriptions** for targeted content
- **Preference center interface** for self-service management
- **Audit trail** for preference changes

### 3. Contact Deduplication System
- **Intelligent duplicate detection** based on email addresses
- **Merge strategy** that preserves engagement history
- **Batch processing** for large contact databases
- **Audit logging** for deduplication operations
- **Rollback capabilities** through detailed merge logs

### 4. Contact History and Engagement Analytics
- **Comprehensive engagement tracking** (opens, clicks, bounces, complaints)
- **Engagement scoring** algorithm (0-100 scale)
- **Trend analysis** (increasing, decreasing, stable)
- **Risk assessment** (low, medium, high)
- **Actionable recommendations** based on engagement patterns

## API Endpoints

### Public Endpoints (No Authentication Required)

#### One-Click Unsubscribe
```
GET /api/contacts/unsubscribe/:token
```
- Processes one-click unsubscribe requests
- Returns branded HTML page with success/error message
- Automatically adds to suppression list
- Records engagement event

### Authenticated Endpoints

#### Manual Unsubscribe
```
POST /api/contacts/unsubscribe
Content-Type: application/json

{
  "email": "user@example.com",
  "reason": "user_request",
  "campaignId": "optional-campaign-id"
}
```

#### Get Subscriber Preferences
```
GET /api/contacts/:contactId/preferences
```

#### Update Subscriber Preferences
```
PUT /api/contacts/:contactId/preferences
Content-Type: application/json

{
  "preferences": {
    "marketing": true,
    "transactional": true,
    "newsletters": false,
    "promotions": true
  },
  "frequency": "weekly",
  "categories": ["tech", "business"]
}
```

#### Deduplicate Contacts
```
POST /api/contacts/deduplicate
```

#### Get Contact History
```
GET /api/contacts/:contactId/history?limit=50&offset=0
```

#### Get Contact Analytics
```
GET /api/contacts/:contactId/analytics
```

#### Generate Unsubscribe Token
```
POST /api/contacts/generate-unsubscribe-token
Content-Type: application/json

{
  "email": "user@example.com",
  "campaignId": "optional-campaign-id"
}
```

## Database Schema

### Contact Preferences Table
```sql
CREATE TABLE contact_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    preferences JSONB DEFAULT '{
        "marketing": true,
        "transactional": true,
        "newsletters": true,
        "promotions": true
    }',
    frequency VARCHAR(20) DEFAULT 'weekly',
    categories TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Unsubscribe Tokens Table
```sql
CREATE TABLE unsubscribe_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    campaign_id UUID,
    tenant_id UUID NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### Contact Deduplication Logs Table
```sql
CREATE TABLE contact_deduplication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    operation_id UUID DEFAULT gen_random_uuid(),
    primary_contact_id UUID NOT NULL,
    merged_contact_ids UUID[] NOT NULL,
    email VARCHAR(255) NOT NULL,
    merge_strategy VARCHAR(50) DEFAULT 'keep_oldest',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Usage Examples

### Implementing One-Click Unsubscribe in Emails

```typescript
import { SubscriberManagementService } from './subscriber-management.service';

const subscriberService = new SubscriberManagementService();

// Generate unsubscribe token for email
const token = subscriberService.generateUnsubscribeToken(
  'user@example.com', 
  'campaign-123'
);

// Add to email headers (RFC 2369 compliant)
const unsubscribeUrl = `https://yourdomain.com/api/contacts/unsubscribe/${token}`;
const headers = {
  'List-Unsubscribe': `<${unsubscribeUrl}>`,
  'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
};

// Add to email footer
const footer = `
  <p>
    <a href="${unsubscribeUrl}">Unsubscribe</a> from future emails
  </p>
`;
```

### Managing Subscriber Preferences

```typescript
// Get current preferences
const preferences = await subscriberService.getSubscriberPreferences(
  'tenant-123', 
  'contact-456'
);

// Update preferences
const updated = await subscriberService.updateSubscriberPreferences(
  'tenant-123',
  'contact-456',
  {
    preferences: {
      marketing: false,
      newsletters: true
    },
    frequency: 'monthly'
  }
);
```

### Contact Deduplication

```typescript
// Run deduplication for tenant
const result = await subscriberService.deduplicateContacts('tenant-123');

console.log(`Processed ${result.contactsProcessed} contacts`);
console.log(`Found ${result.duplicatesFound} duplicate groups`);
console.log(`Removed ${result.duplicatesRemoved} duplicate contacts`);
console.log(`Merged contacts:`, result.mergedContacts);
```

### Engagement Analytics

```typescript
// Get comprehensive analytics for a contact
const analytics = await subscriberService.getContactEngagementAnalytics(
  'tenant-123',
  'contact-456'
);

console.log(`Engagement Score: ${analytics.engagementScore}/100`);
console.log(`Risk Level: ${analytics.riskLevel}`);
console.log(`Trend: ${analytics.engagementTrend}`);
console.log(`Recommendation: ${analytics.recommendedAction}`);
```

## Compliance Features

### CAN-SPAM Compliance
- ✅ One-click unsubscribe functionality
- ✅ Clear unsubscribe instructions
- ✅ Immediate processing of unsubscribe requests
- ✅ Suppression list management

### GDPR Compliance
- ✅ Right to be forgotten (contact deletion)
- ✅ Data portability (export functionality)
- ✅ Consent management (preferences)
- ✅ Audit trails for data processing

### RFC 2369 Compliance
- ✅ List-Unsubscribe header support
- ✅ List-Unsubscribe-Post header for one-click
- ✅ Proper unsubscribe URL format

## Security Considerations

### Token Security
- Tokens are base64-encoded with timestamp validation
- 24-hour expiration for security
- One-time use tracking
- IP address and user agent logging

### Data Protection
- All database operations use parameterized queries
- Tenant isolation enforced at all levels
- Sensitive data encrypted at rest
- Audit logging for compliance

## Performance Optimizations

### Database Indexes
```sql
-- Engagement analytics performance
CREATE INDEX idx_contact_engagement_events_contact_timestamp 
ON contact_engagement_events(contact_id, timestamp DESC);

-- Preference lookups
CREATE INDEX idx_contact_preferences_contact_id 
ON contact_preferences(contact_id);

-- Token validation
CREATE INDEX idx_unsubscribe_tokens_token 
ON unsubscribe_tokens(token);
```

### Materialized Views
```sql
-- Fast engagement summary queries
CREATE VIEW contact_engagement_summary AS
SELECT 
    c.id as contact_id,
    c.tenant_id,
    c.email,
    COUNT(cee.id) as total_events,
    COUNT(CASE WHEN cee.event_type = 'opened' THEN 1 END) as total_opened,
    -- ... other aggregations
FROM contacts c
LEFT JOIN contact_engagement_events cee ON c.id = cee.contact_id
GROUP BY c.id, c.tenant_id, c.email;
```

## Testing

The module includes comprehensive unit tests covering:
- ✅ One-click unsubscribe workflows
- ✅ Manual unsubscribe processing
- ✅ Preference management
- ✅ Contact deduplication
- ✅ Engagement analytics
- ✅ Token generation and validation
- ✅ Error handling scenarios

Run tests with:
```bash
npm test -- subscriber-management.service.test.ts
```

## Monitoring and Alerts

### Key Metrics to Monitor
- Unsubscribe rate trends
- Token validation failures
- Deduplication operation performance
- Engagement score distributions
- API endpoint response times

### Recommended Alerts
- High unsubscribe rates (>5% in 24h)
- Token validation errors (>1% failure rate)
- Deduplication operation failures
- Engagement analytics calculation errors

## Future Enhancements

### Planned Features
- [ ] Advanced segmentation based on engagement scores
- [ ] Automated re-engagement campaigns
- [ ] Machine learning-based engagement prediction
- [ ] Real-time preference center widget
- [ ] Bulk preference management tools
- [ ] Advanced deduplication strategies (fuzzy matching)

### Integration Opportunities
- [ ] CRM system synchronization
- [ ] Marketing automation platform integration
- [ ] Customer support ticket creation for high-risk contacts
- [ ] Business intelligence dashboard integration