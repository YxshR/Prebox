# Deliverability Monitoring System

## Overview

The Deliverability Monitoring System provides comprehensive monitoring and optimization capabilities for email deliverability. It implements automated monitoring, spam score analysis, authentication validation, and reputation tracking to ensure optimal email delivery rates.

## Features

### 1. Email Authentication Validation
- **SPF Record Validation**: Checks for proper SPF configuration
- **DKIM Signature Validation**: Verifies DKIM setup and signing
- **DMARC Policy Validation**: Ensures DMARC policy is properly configured
- **Overall Authentication Score**: Weighted score based on all authentication methods

### 2. Spam Score Checking and Content Analysis
- **Subject Line Analysis**: Detects spam keywords, excessive capitalization, and punctuation
- **Content Analysis**: Identifies excessive links, image-heavy content, and short content
- **Sender Analysis**: Checks for no-reply addresses and sender/domain mismatches
- **Recommendations**: Provides actionable suggestions to improve content

### 3. Sender Reputation Monitoring
- **Multi-Factor Scoring**: Combines sender, domain, and IP reputation scores
- **Trend Analysis**: Tracks reputation changes over time (improving/stable/declining)
- **Factor Identification**: Identifies specific factors affecting reputation
- **Historical Tracking**: Maintains reputation history for analysis

### 4. Delivery Rate Optimization
- **Performance Analysis**: Analyzes current delivery metrics and identifies issues
- **Optimization Recommendations**: Provides specific actions to improve delivery rates
- **Estimated Impact**: Calculates potential improvement from recommendations
- **Action Prioritization**: Ranks recommendations by impact and effort

## API Endpoints

### Metrics and Analytics

#### Get Deliverability Metrics
```http
GET /api/emails/deliverability/metrics/:tenantId?days=7
```
Returns comprehensive deliverability metrics including delivery rates, bounce rates, engagement metrics, and reputation scores.

#### Get Dashboard Summary
```http
GET /api/emails/deliverability/dashboard/:tenantId?days=7
```
Returns a complete dashboard summary with metrics, alerts, reputation, and top recommendations.

### Authentication and Validation

#### Validate Email Authentication
```http
GET /api/emails/deliverability/authentication/:domain
```
Validates SPF, DKIM, and DMARC configuration for a specific domain.

#### Analyze Spam Score
```http
POST /api/emails/deliverability/spam-analysis
Content-Type: application/json

{
  "subject": "Your email subject",
  "htmlContent": "<html>Email content</html>",
  "textContent": "Plain text version",
  "fromEmail": "sender@example.com",
  "fromName": "Sender Name"
}
```
Analyzes email content for spam indicators and provides recommendations.

### Reputation and Optimization

#### Monitor Sender Reputation
```http
GET /api/emails/deliverability/reputation/:tenantId
```
Returns detailed sender reputation metrics and trend analysis.

#### Get Optimization Recommendations
```http
GET /api/emails/deliverability/optimization/:tenantId
```
Provides personalized recommendations to improve delivery rates.

### Alerts and Monitoring

#### Get Deliverability Alerts
```http
GET /api/emails/deliverability/alerts/:tenantId?limit=50&offset=0&severity=high&resolved=false
```
Retrieves deliverability alerts with filtering and pagination.

#### Resolve Alert
```http
PUT /api/emails/deliverability/alerts/:alertId/resolve
Content-Type: application/json

{
  "tenantId": "tenant-uuid"
}
```
Marks a deliverability alert as resolved.

#### Run Manual Check
```http
POST /api/emails/deliverability/check/:tenantId
```
Triggers an immediate deliverability check for a specific tenant.

### Administrative

#### Start Monitoring
```http
POST /api/emails/deliverability/monitoring/start
Content-Type: application/json

{
  "intervalMinutes": 30
}
```
Starts automated deliverability monitoring (Admin only).

#### Stop Monitoring
```http
POST /api/emails/deliverability/monitoring/stop
```
Stops automated deliverability monitoring (Admin only).

## Database Schema

### Core Tables

#### deliverability_alerts
Stores alerts for deliverability issues:
- `id`: Unique alert identifier
- `tenant_id`: Associated tenant
- `type`: Alert type (high_bounce_rate, low_delivery_rate, etc.)
- `severity`: Alert severity (low, medium, high, critical)
- `message`: Human-readable alert message
- `metrics`: JSON object with relevant metrics
- `recommendations`: JSON array of recommended actions
- `is_resolved`: Resolution status
- `created_at`, `resolved_at`: Timestamps

#### tenant_deliverability_scores
Current deliverability scores for each tenant:
- `tenant_id`: Tenant identifier (primary key)
- `delivery_rate`, `bounce_rate`, `complaint_rate`: Core metrics
- `open_rate`, `click_rate`: Engagement metrics
- `reputation_score`, `authentication_score`: Calculated scores
- `updated_at`: Last update timestamp

#### deliverability_metrics_history
Historical daily metrics for trend analysis:
- `tenant_id`, `date`: Composite key
- All rate and score fields from current scores
- `total_emails_sent`: Volume metric
- `created_at`: Record creation timestamp

#### spam_analysis_results
Results of spam score analysis:
- `tenant_id`, `campaign_id`: Associated entities
- `email_subject`: Analyzed subject line
- `spam_score`: Calculated spam score (0-100)
- `factors`: JSON array of contributing factors
- `recommendations`: JSON array of improvements
- `is_likely_spam`: Boolean flag
- `analyzed_at`: Analysis timestamp

#### authentication_check_results
Email authentication validation results:
- `domain_id`, `tenant_id`: Associated entities
- `spf_valid`, `dkim_valid`, `dmarc_valid`: Individual checks
- `spf_score`, `dkim_score`, `dmarc_score`: Individual scores
- `overall_score`: Weighted overall score
- `checked_at`: Check timestamp

#### reputation_monitoring
Sender reputation tracking:
- `tenant_id`: Associated tenant
- `sender_score`, `domain_score`, `ip_score`: Component scores
- `overall_score`: Combined reputation score
- `factors`: JSON array of reputation factors
- `trend`: Reputation trend (improving/stable/declining)
- `monitored_at`: Monitoring timestamp

### Performance Optimizations

#### Materialized View: deliverability_dashboard_stats
Pre-calculated statistics for dashboard performance:
- Aggregates email events by tenant and date
- Calculates all rates and metrics
- Refreshed automatically via scheduled function
- Indexed for fast tenant-specific queries

#### Indexes
- Tenant-based indexes for fast filtering
- Time-based indexes for historical queries
- Composite indexes for common query patterns
- Partial indexes for unresolved alerts

## Monitoring Thresholds

### Default Alert Thresholds
```typescript
const thresholds = {
  deliveryRate: { warning: 95, critical: 90 },
  bounceRate: { warning: 5, critical: 10 },
  complaintRate: { warning: 0.1, critical: 0.5 },
  spamScore: { warning: 50, critical: 70 },
  reputationScore: { warning: 70, critical: 50 }
};
```

### Alert Types
- `HIGH_BOUNCE_RATE`: Bounce rate exceeds thresholds
- `HIGH_COMPLAINT_RATE`: Complaint rate exceeds thresholds
- `LOW_DELIVERY_RATE`: Delivery rate below thresholds
- `AUTHENTICATION_FAILURE`: SPF/DKIM/DMARC issues
- `REPUTATION_DECLINE`: Sender reputation declining
- `SPAM_CONTENT_DETECTED`: High spam score detected
- `BLACKLIST_DETECTION`: IP/domain blacklisted

## Spam Analysis Factors

### Subject Line Factors
- **Excessive Capitalization**: >50% capital letters
- **Spam Keywords**: Common promotional terms
- **Excessive Punctuation**: Multiple exclamation/question marks

### Content Factors
- **Very Short Content**: <50 characters
- **Excessive Links**: High link-to-content ratio
- **Image-Heavy Content**: Mostly images with little text

### Sender Factors
- **No-Reply Sender**: Using no-reply addresses
- **Sender Mismatch**: Name doesn't match domain

## Authentication Scoring

### SPF (30% weight)
- 100 points: Valid SPF record with proper policy
- 50 points: SPF record present but has issues
- 0 points: No SPF record found

### DKIM (40% weight)
- 100 points: Valid DKIM signature and public key
- 60 points: DKIM record present but validation fails
- 0 points: No DKIM configuration

### DMARC (30% weight)
- 100 points: Valid DMARC policy (p=reject/quarantine)
- 40 points: DMARC record present but needs adjustment
- 0 points: No DMARC record

## Reputation Calculation

### Sender Score Factors
- Delivery rate impact: Direct multiplier
- Bounce rate penalty: Reduces score
- Complaint rate penalty: Significant reduction
- Engagement bonus: Open/click rates boost score

### Domain Score
- Based on authentication score for custom domains
- Default score for shared domains
- External reputation service integration (future)

### IP Score
- Based on recent sending behavior
- Bounce and complaint rate impact
- Shared IP reputation (simulated)

## Usage Examples

### Basic Monitoring Setup
```typescript
import { DeliverabilityMonitoringService } from './deliverability-monitoring.service';
import { DomainService } from '../domains/domain.service';

const domainService = new DomainService(db);
const deliverabilityService = new DeliverabilityMonitoringService(db, domainService);

// Start automated monitoring every 30 minutes
deliverabilityService.startMonitoring(30);

// Get metrics for a tenant
const metrics = await deliverabilityService.getDeliverabilityMetrics('tenant-123');
console.log('Delivery rate:', metrics.deliveryRate);
```

### Spam Analysis
```typescript
const spamResult = await deliverabilityService.analyzeSpamScore({
  subject: 'Monthly Newsletter',
  htmlContent: '<p>Newsletter content...</p>',
  fromEmail: 'newsletter@company.com',
  fromName: 'Company Newsletter'
});

if (spamResult.isLikelySpam) {
  console.log('Recommendations:', spamResult.recommendations);
}
```

### Authentication Validation
```typescript
const authResult = await deliverabilityService.validateEmailAuthentication('company.com');

if (!authResult.isValid) {
  console.log('SPF issues:', authResult.spf.recommendations);
  console.log('DKIM issues:', authResult.dkim.recommendations);
  console.log('DMARC issues:', authResult.dmarc.recommendations);
}
```

## Maintenance and Cleanup

### Automated Cleanup
The system includes automated cleanup functions:
- Resolved alerts older than 90 days are archived
- Metrics history older than 1 year is removed
- Spam analysis results older than 30 days are cleaned
- Authentication results keep only the latest per domain

### Manual Maintenance
```sql
-- Refresh dashboard statistics
SELECT refresh_deliverability_dashboard_stats();

-- Run cleanup function
SELECT archive_old_deliverability_data();
```

## Integration Points

### Email Service Integration
The deliverability monitoring integrates with:
- Email sending service for real-time metrics
- Domain service for authentication validation
- Campaign service for content analysis
- Analytics service for historical data

### External Services (Future)
- DNS lookup services for authentication validation
- Reputation services (Sender Score, Return Path)
- Blacklist checking services
- Content analysis APIs

## Performance Considerations

### Monitoring Frequency
- Default: 30-minute intervals
- Adjustable based on sending volume
- Manual checks available for immediate analysis

### Database Performance
- Materialized views for dashboard queries
- Proper indexing for time-series data
- Automated cleanup to prevent bloat
- Connection pooling for concurrent checks

### Scalability
- Tenant-based partitioning ready
- Async processing for large tenants
- Batch operations for efficiency
- Caching for frequently accessed data

## Error Handling

### Graceful Degradation
- Continue monitoring if individual checks fail
- Default scores when external services unavailable
- Retry logic for transient failures
- Comprehensive error logging

### Alert Management
- Duplicate alert prevention
- Alert severity escalation
- Automatic resolution for resolved issues
- Admin notification for critical alerts

## Security Considerations

### Data Protection
- Tenant isolation in all queries
- Sensitive data encryption
- Audit logging for admin actions
- Rate limiting on API endpoints

### Access Control
- Authentication required for all endpoints
- Tenant-based authorization
- Admin-only monitoring controls
- API key validation for external access