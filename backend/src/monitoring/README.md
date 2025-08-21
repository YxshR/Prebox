# Monitoring and Observability System

This module provides comprehensive monitoring and observability capabilities for the bulk email platform, including application performance monitoring, error tracking, alerting, and health checks.

## Features

### 1. Application Performance Monitoring (APM)
- **Request/Response Tracking**: Monitors HTTP requests, response times, and status codes
- **Performance Metrics**: Tracks response times, throughput, and error rates
- **Real-time Monitoring**: Uses Redis for real-time metric storage and aggregation
- **Historical Analysis**: Stores long-term performance data in PostgreSQL

### 2. Error Tracking and Alerting
- **Error Collection**: Captures application errors with full context and stack traces
- **Alert Rules**: Configurable alerting based on metrics thresholds
- **Multiple Channels**: Supports email, webhook, and Slack notifications
- **Auto-resolution**: Automatically resolves alerts when conditions improve

### 3. Business Metrics Dashboard
- **Custom Metrics**: Track business-specific metrics (emails sent, subscriptions, revenue)
- **Real-time Dashboards**: Live updating dashboards with animated charts
- **Tenant Isolation**: Metrics are properly isolated by tenant for multi-tenancy
- **Aggregation**: Support for various aggregation methods (sum, avg, min, max, count)

### 4. Health Checks and Uptime Monitoring
- **System Health**: Monitors database, Redis, memory, disk, and external services
- **Automated Checks**: Runs health checks every 30 seconds
- **Uptime Statistics**: Tracks availability and downtime events
- **Custom Health Checks**: Extensible system for adding custom health checks

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Performance    │    │   Metrics       │    │   Alerting      │
│  Middleware     │    │   Service       │    │   Service       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
         ┌─────────────────────────────────────────────────┐
         │            Monitoring Service                   │
         └─────────────────────────────────────────────────┘
                                 │
         ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
         │   PostgreSQL    │    │     Redis       │    │  Health Check   │
         │   (Long-term)   │    │  (Real-time)    │    │    Service      │
         └─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Usage

### 1. Setting Up Monitoring

```typescript
import { MonitoringService, MetricsService, AlertingService, HealthCheckService } from './monitoring';
import { PerformanceMonitor } from './monitoring/performance.middleware';

// Initialize services
const monitoringService = new MonitoringService(db, redis, logger);
const metricsService = new MetricsService(db, redis, logger);
const alertingService = new AlertingService(db, redis, logger);
const healthCheckService = new HealthCheckService(db, redis, logger);

// Set up performance monitoring middleware
const performanceMonitor = new PerformanceMonitor(monitoringService, metricsService);
app.use(performanceMonitor.middleware());
```

### 2. Recording Custom Metrics

```typescript
// Business metrics
await monitoringService.recordBusinessMetric({
  name: 'emails_sent',
  value: 100,
  timestamp: new Date(),
  tenantId: 'tenant-123',
  metadata: { campaign_id: 'campaign-456' }
});

// Custom application metrics
await metricsService.incrementCounter('api_calls', 1, {
  endpoint: '/api/emails/send',
  tenant_id: 'tenant-123'
});

await metricsService.recordTimer('email_processing_time', 1500, {
  provider: 'sendgrid'
});
```

### 3. Creating Alert Rules

```typescript
// Create an alert rule for high error rate
await alertingService.createAlertRule({
  name: 'High Error Rate',
  metric: 'performance:error_rate',
  condition: 'greater_than',
  threshold: 0.05, // 5%
  timeWindow: 5, // 5 minutes
  severity: 'high',
  enabled: true,
  channels: [
    {
      type: 'email',
      config: { email: 'alerts@company.com' }
    },
    {
      type: 'slack',
      config: { webhookUrl: 'https://hooks.slack.com/...' }
    }
  ]
});
```

### 4. Custom Health Checks

```typescript
// Register a custom health check
healthCheckService.registerHealthCheck('external_api', async () => {
  try {
    const response = await fetch('https://api.external-service.com/health');
    const responseTime = Date.now() - startTime;
    
    return {
      name: 'external_api',
      status: response.ok ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      responseTime,
      metadata: { statusCode: response.status }
    };
  } catch (error) {
    return {
      name: 'external_api',
      status: 'unhealthy',
      timestamp: new Date(),
      error: error.message
    };
  }
});
```

## API Endpoints

### Health Endpoints (Public)
- `GET /monitoring/health` - Basic health status
- `GET /monitoring/health/detailed` - Detailed health information
- `GET /monitoring/health/history` - Health check history

### Metrics Endpoints (Authenticated)
- `GET /monitoring/metrics` - Get metric data
- `GET /monitoring/metrics/performance` - Performance metrics
- `GET /monitoring/metrics/business` - Business metrics
- `GET /monitoring/metrics/system` - System metrics

### Alert Endpoints (Authenticated)
- `GET /monitoring/alerts` - Get alerts and rules
- `POST /monitoring/alerts/rules` - Create alert rule
- `PUT /monitoring/alerts/rules/:id` - Update alert rule
- `DELETE /monitoring/alerts/rules/:id` - Delete alert rule
- `POST /monitoring/alerts/:id/resolve` - Resolve alert

### Dashboard Endpoints (Authenticated)
- `GET /monitoring/dashboard` - Dashboard data
- `GET /monitoring/dashboard/uptime` - Uptime statistics

## Database Schema

The monitoring system uses several PostgreSQL tables:

- **performance_metrics**: HTTP request performance data
- **business_metrics**: Business-specific metrics
- **metrics**: General purpose metrics
- **error_events**: Application errors and exceptions
- **alert_rules**: Alert rule configurations
- **alerts**: Active and historical alerts
- **health_checks**: System health check results

## Configuration

### Environment Variables

```bash
# SMTP Configuration for alerts
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@company.com
SMTP_PASS=your-password

# Alert sender email
ALERT_FROM_EMAIL=alerts@company.com

# Email provider for health checks
EMAIL_PROVIDER=sendgrid
```

### Monitoring Configuration

The monitoring system can be configured through the `MonitoringConfig` interface:

```typescript
const config: MonitoringConfig = {
  metricsRetentionDays: 30,
  alertingEnabled: true,
  healthCheckInterval: 60000, // 1 minute
  performanceThresholds: {
    responseTime: 2000, // 2 seconds
    errorRate: 0.05, // 5%
    throughput: 1000 // requests per minute
  },
  businessMetrics: {
    emailsSentDaily: true,
    subscriptionChanges: true,
    apiUsage: true,
    revenueTracking: true
  }
};
```

## Metrics Types

### Performance Metrics
- `http_requests_total` - Total HTTP requests
- `http_request_duration_ms` - Request duration in milliseconds
- `http_responses_total` - HTTP responses by status code
- `http_errors_total` - HTTP errors (4xx, 5xx)

### Business Metrics
- `emails_sent` - Number of emails sent
- `subscriptions_created` - New subscriptions
- `revenue_generated` - Revenue amounts
- `api_usage` - API call counts

### System Metrics
- `system:memory_usage` - Memory usage percentage
- `system:uptime` - System uptime in seconds
- `database:connection_count` - Database connections
- `redis:memory_usage` - Redis memory usage

## Alert Conditions

Supported alert conditions:
- `greater_than` - Trigger when metric > threshold
- `less_than` - Trigger when metric < threshold
- `equals` - Trigger when metric = threshold
- `not_equals` - Trigger when metric ≠ threshold

## Alert Channels

### Email Alerts
```json
{
  "type": "email",
  "config": {
    "email": "alerts@company.com"
  }
}
```

### Webhook Alerts
```json
{
  "type": "webhook",
  "config": {
    "url": "https://your-webhook-endpoint.com/alerts",
    "headers": {
      "Authorization": "Bearer your-token"
    }
  }
}
```

### Slack Alerts
```json
{
  "type": "slack",
  "config": {
    "webhookUrl": "https://hooks.slack.com/services/..."
  }
}
```

## Best Practices

### 1. Metric Naming
- Use descriptive names: `emails_sent_total` instead of `emails`
- Include units: `response_time_ms`, `memory_usage_bytes`
- Use consistent prefixes: `http_`, `business_`, `system_`

### 2. Alert Configuration
- Set appropriate thresholds based on historical data
- Use different severity levels (low, medium, high, critical)
- Configure multiple notification channels for critical alerts
- Test alert rules before enabling in production

### 3. Performance Considerations
- Metrics are buffered and flushed in batches to reduce database load
- Use Redis for real-time metrics and PostgreSQL for historical data
- Set appropriate retention periods to manage storage costs
- Monitor the monitoring system itself to avoid recursive issues

### 4. Security
- Sanitize sensitive data in error logs and metrics
- Use authentication for all monitoring endpoints except health checks
- Implement rate limiting on monitoring endpoints
- Secure alert notification channels (use HTTPS, authentication)

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check metrics buffer size and flush frequency
   - Monitor Redis memory usage
   - Verify metric retention settings

2. **Missing Metrics**
   - Check database connectivity
   - Verify Redis connection
   - Review error logs for failed metric writes

3. **Alert Fatigue**
   - Adjust alert thresholds based on normal operating ranges
   - Implement alert grouping and rate limiting
   - Use different severity levels appropriately

4. **Performance Impact**
   - Monitor the overhead of the monitoring system itself
   - Adjust metric collection frequency if needed
   - Use sampling for high-volume metrics

### Debugging

Enable debug logging to troubleshoot issues:

```typescript
const logger = winston.createLogger({
  level: 'debug',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'monitoring.log' })
  ]
});
```

## Integration with Frontend

The monitoring system provides data for frontend dashboards through REST APIs. The frontend can:

1. Display real-time system health status
2. Show performance metrics with animated charts
3. Present business metrics dashboards
4. Alert management interface for administrators

Example frontend integration:

```typescript
// Get dashboard data
const response = await fetch('/api/monitoring/dashboard?hours=24');
const dashboardData = await response.json();

// Display metrics in charts
const performanceChart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: dashboardData.metrics.map(m => m.timestamp),
    datasets: [{
      label: 'Response Time',
      data: dashboardData.metrics.map(m => m.responseTime)
    }]
  }
});
```

This monitoring system provides comprehensive observability for the bulk email platform, enabling proactive issue detection, performance optimization, and business insights.