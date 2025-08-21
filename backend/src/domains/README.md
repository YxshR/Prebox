# Domain Management System

This module implements comprehensive custom domain management for the bulk email platform, allowing Premium users to send emails from their own domains with proper authentication.

## Features

### 1. Domain Verification System
- **DNS Record Generation**: Automatically generates SPF, DKIM, DMARC, and verification records
- **Step-by-Step Setup Wizard**: Provides clear instructions for DNS configuration
- **Automated Verification**: Checks DNS records and updates domain status
- **Multi-Provider Support**: Works with various DNS providers

### 2. Email Authentication
- **SPF Records**: Sender Policy Framework for authorized sending
- **DKIM Signing**: DomainKeys Identified Mail for message integrity
- **DMARC Policy**: Domain-based Message Authentication for policy enforcement
- **Domain Verification**: Ownership verification through DNS records

### 3. Domain Status Monitoring
- **Real-time Monitoring**: Continuous checking of DNS record validity
- **Automated Alerts**: Notifications for configuration issues
- **Status Tracking**: Pending, Verifying, Verified, Failed, Suspended states
- **Health Checks**: Regular validation of domain configuration

### 4. Reputation Tracking
- **Reputation Scoring**: Multi-factor reputation calculation
- **Performance Metrics**: Delivery rates, bounce rates, complaint rates
- **Trend Analysis**: Historical reputation tracking
- **Recommendations**: Actionable suggestions for improvement

## API Endpoints

### Domain Management
```
POST   /api/domains                    # Create new domain
GET    /api/domains                    # List user's domains
GET    /api/domains/:id                # Get domain details
```

### Setup and Verification
```
GET    /api/domains/:id/setup-wizard   # Get setup instructions
POST   /api/domains/:id/verify         # Verify domain DNS records
```

### Reputation and Monitoring
```
GET    /api/domains/:id/reputation     # Get domain reputation
POST   /api/domains/:id/reputation/refresh  # Update reputation
POST   /api/domains/:id/monitor        # Manual monitoring trigger
```

### Alerts Management
```
GET    /api/domains/:id/alerts         # Get domain alerts
POST   /api/domains/:id/alerts/:alertId/resolve  # Resolve alert
```

## Database Schema

### Domains Table
```sql
CREATE TABLE domains (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    domain VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    dkim_key TEXT,
    verification_records JSONB,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
);
```

### Domain Alerts Table
```sql
CREATE TABLE domain_alerts (
    id UUID PRIMARY KEY,
    domain_id UUID REFERENCES domains(id),
    type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE
);
```

### Domain Reputation Table
```sql
CREATE TABLE domain_reputation (
    id UUID PRIMARY KEY,
    domain_id UUID REFERENCES domains(id),
    score INTEGER NOT NULL,
    factors JSONB,
    recommendations JSONB,
    last_updated TIMESTAMP WITH TIME ZONE
);
```

## Usage Examples

### Creating a Domain
```typescript
const domainService = new DomainService(db);

const domain = await domainService.createDomain({
  domain: 'mail.example.com',
  tenantId: 'user-tenant-id'
});
```

### Setting Up Domain Verification
```typescript
const wizard = await domainService.createSetupWizard(domain.id);

// wizard.instructions contains step-by-step DNS setup
wizard.instructions.steps.forEach(step => {
  console.log(`${step.title}: Add ${step.record.type} record`);
  console.log(`Name: ${step.record.name}`);
  console.log(`Value: ${step.record.value}`);
});
```

### Verifying Domain
```typescript
const result = await domainService.verifyDomain(domain.id);

if (result.isVerified) {
  console.log('Domain verified successfully!');
} else {
  console.log('Verification failed:', result.errors);
}
```

### Monitoring Domain Health
```typescript
const monitoringService = new DomainMonitoringService(db, domainService);

// Start automated monitoring
monitoringService.startMonitoring();

// Manual monitoring check
await monitoringService.monitorSingleDomain(domain.id);
```

## DNS Record Examples

### SPF Record
```
Type: TXT
Name: example.com
Value: v=spf1 include:amazonses.com ~all
TTL: 300
```

### DKIM Record
```
Type: TXT
Name: mail._domainkey.example.com
Value: v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ...
TTL: 300
```

### DMARC Record
```
Type: TXT
Name: _dmarc.example.com
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com
TTL: 300
```

### Verification Record
```
Type: TXT
Name: _verification.example.com
Value: bulk-email-platform-verification=abc123def456
TTL: 300
```

## Error Handling

The system includes comprehensive error handling for:

- **DNS Resolution Errors**: Network issues, invalid records
- **Validation Errors**: Malformed domains, missing records
- **Authentication Errors**: Unauthorized access, invalid tokens
- **Rate Limiting**: API quota exceeded, concurrent requests

## Security Considerations

- **Tenant Isolation**: Users can only access their own domains
- **Input Validation**: Comprehensive validation of domain names and DNS records
- **Rate Limiting**: Protection against abuse and excessive requests
- **Audit Logging**: Complete tracking of domain operations

## Monitoring and Alerts

### Alert Types
- `VERIFICATION_FAILED`: DNS verification failed
- `DNS_RECORD_MISSING`: Required DNS records not found
- `REPUTATION_DECLINE`: Domain reputation score dropped
- `AUTHENTICATION_FAILURE`: Email authentication issues
- `DELIVERY_ISSUES`: Poor delivery performance

### Alert Severities
- `LOW`: Minor issues, informational
- `MEDIUM`: Issues requiring attention
- `HIGH`: Serious problems affecting functionality
- `CRITICAL`: Urgent issues requiring immediate action

## Integration with Email Sending

Once a domain is verified, it can be used for:
- Custom "From" addresses in email campaigns
- Branded email headers and footers
- Improved deliverability through proper authentication
- Enhanced sender reputation

## Testing

Run the test suite:
```bash
npm test -- domains/domain.service.test.ts
```

The tests cover:
- Domain creation and validation
- DNS record generation and verification
- Reputation calculation and tracking
- Alert management and resolution
- Error handling and edge cases

## Configuration

### Environment Variables
```
# DNS Resolution Timeout
DNS_TIMEOUT=5000

# Monitoring Interval (minutes)
DOMAIN_MONITORING_INTERVAL=60

# Alert Thresholds
REPUTATION_THRESHOLD=70
DELIVERY_RATE_THRESHOLD=95
BOUNCE_RATE_THRESHOLD=5
```

### Monitoring Configuration
```typescript
const config: DomainMonitoringConfig = {
  checkInterval: 60, // minutes
  alertThresholds: {
    reputationScore: 70,
    deliveryRate: 95,
    bounceRate: 5
  },
  enabledChecks: {
    dnsRecords: true,
    reputation: true,
    deliverability: true
  }
};
```

This domain management system provides a complete solution for custom domain setup, verification, and monitoring, ensuring reliable email delivery with proper authentication.