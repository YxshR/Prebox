-- Create monitoring and observability tables

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id SERIAL PRIMARY KEY,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER NOT NULL,
    response_time INTEGER NOT NULL, -- in milliseconds
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    user_id UUID,
    tenant_id UUID,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance metrics
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_endpoint ON performance_metrics(endpoint);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_tenant ON performance_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_status ON performance_metrics(status_code);

-- Business metrics table
CREATE TABLE IF NOT EXISTS business_metrics (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    value DECIMAL(15,4) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    tenant_id UUID,
    user_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for business metrics
CREATE INDEX IF NOT EXISTS idx_business_metrics_name ON business_metrics(name);
CREATE INDEX IF NOT EXISTS idx_business_metrics_timestamp ON business_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_business_metrics_tenant ON business_metrics(tenant_id);

-- General metrics table for custom metrics
CREATE TABLE IF NOT EXISTS metrics (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    value DECIMAL(15,4) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    tags JSONB DEFAULT '{}',
    type VARCHAR(50) NOT NULL, -- counter, gauge, histogram, timer
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for metrics
CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(name);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_type ON metrics(type);
CREATE INDEX IF NOT EXISTS idx_metrics_tags ON metrics USING GIN(tags);

-- Error events table
CREATE TABLE IF NOT EXISTS error_events (
    id UUID PRIMARY KEY,
    message TEXT NOT NULL,
    stack TEXT,
    level VARCHAR(20) NOT NULL DEFAULT 'error',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    user_id UUID,
    tenant_id UUID,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for error events
CREATE INDEX IF NOT EXISTS idx_error_events_timestamp ON error_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_error_events_level ON error_events(level);
CREATE INDEX IF NOT EXISTS idx_error_events_tenant ON error_events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_error_events_endpoint ON error_events(endpoint);

-- Alert rules table
CREATE TABLE IF NOT EXISTS alert_rules (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    metric VARCHAR(255) NOT NULL,
    condition VARCHAR(50) NOT NULL, -- greater_than, less_than, equals, not_equals
    threshold DECIMAL(15,4) NOT NULL,
    time_window INTEGER NOT NULL, -- in minutes
    severity VARCHAR(20) NOT NULL DEFAULT 'medium', -- low, medium, high, critical
    enabled BOOLEAN NOT NULL DEFAULT true,
    channels JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for alert rules
CREATE INDEX IF NOT EXISTS idx_alert_rules_metric ON alert_rules(metric);
CREATE INDEX IF NOT EXISTS idx_alert_rules_enabled ON alert_rules(enabled);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY,
    rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for alerts
CREATE INDEX IF NOT EXISTS idx_alerts_rule_id ON alerts(rule_id);
CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);

-- Health checks table
CREATE TABLE IF NOT EXISTS health_checks (
    id SERIAL PRIMARY KEY,
    overall_status VARCHAR(20) NOT NULL, -- healthy, degraded, unhealthy
    checks_data JSONB NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    uptime DECIMAL(15,4) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for health checks
CREATE INDEX IF NOT EXISTS idx_health_checks_timestamp ON health_checks(timestamp);
CREATE INDEX IF NOT EXISTS idx_health_checks_status ON health_checks(overall_status);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for alert_rules updated_at
CREATE TRIGGER update_alert_rules_updated_at 
    BEFORE UPDATE ON alert_rules 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries

-- Performance summary view
CREATE OR REPLACE VIEW performance_summary AS
SELECT 
    endpoint,
    method,
    COUNT(*) as request_count,
    AVG(response_time) as avg_response_time,
    MIN(response_time) as min_response_time,
    MAX(response_time) as max_response_time,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time) as p95_response_time,
    COUNT(CASE WHEN status_code >= 400 THEN 1 END) as error_count,
    COUNT(CASE WHEN status_code >= 400 THEN 1 END)::FLOAT / COUNT(*) as error_rate,
    DATE_TRUNC('hour', timestamp) as hour
FROM performance_metrics 
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY endpoint, method, DATE_TRUNC('hour', timestamp)
ORDER BY hour DESC, request_count DESC;

-- Business metrics daily summary view
CREATE OR REPLACE VIEW business_metrics_daily AS
SELECT 
    name,
    DATE_TRUNC('day', timestamp) as day,
    SUM(value) as total_value,
    AVG(value) as avg_value,
    COUNT(*) as event_count,
    tenant_id
FROM business_metrics 
WHERE timestamp >= NOW() - INTERVAL '30 days'
GROUP BY name, DATE_TRUNC('day', timestamp), tenant_id
ORDER BY day DESC, total_value DESC;

-- Error rate by endpoint view
CREATE OR REPLACE VIEW error_rate_by_endpoint AS
SELECT 
    pm.endpoint,
    pm.method,
    COUNT(*) as total_requests,
    COUNT(CASE WHEN pm.status_code >= 400 THEN 1 END) as error_requests,
    COUNT(CASE WHEN pm.status_code >= 400 THEN 1 END)::FLOAT / COUNT(*) * 100 as error_rate_percent,
    COUNT(ee.id) as logged_errors
FROM performance_metrics pm
LEFT JOIN error_events ee ON ee.endpoint = pm.endpoint AND ee.method = pm.method
WHERE pm.timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY pm.endpoint, pm.method
HAVING COUNT(*) > 10  -- Only show endpoints with significant traffic
ORDER BY error_rate_percent DESC;

-- System health summary view
CREATE OR REPLACE VIEW system_health_summary AS
SELECT 
    DATE_TRUNC('hour', timestamp) as hour,
    overall_status,
    COUNT(*) as check_count,
    AVG(uptime) as avg_uptime
FROM health_checks 
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', timestamp), overall_status
ORDER BY hour DESC;

-- Grant permissions (adjust as needed for your user)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- Add comments for documentation
COMMENT ON TABLE performance_metrics IS 'Stores HTTP request performance data including response times and status codes';
COMMENT ON TABLE business_metrics IS 'Stores business-specific metrics like emails sent, subscriptions, revenue';
COMMENT ON TABLE metrics IS 'General purpose metrics table for custom application metrics';
COMMENT ON TABLE error_events IS 'Stores application errors and exceptions with context';
COMMENT ON TABLE alert_rules IS 'Configuration for automated alerting rules';
COMMENT ON TABLE alerts IS 'Active and historical alerts generated by alert rules';
COMMENT ON TABLE health_checks IS 'System health check results and status history';