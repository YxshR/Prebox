-- Create deliverability alerts table
CREATE TABLE IF NOT EXISTS deliverability_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    message TEXT NOT NULL,
    metrics JSONB,
    recommendations JSONB,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    INDEX idx_deliverability_alerts_tenant_id (tenant_id),
    INDEX idx_deliverability_alerts_type (type),
    INDEX idx_deliverability_alerts_severity (severity),
    INDEX idx_deliverability_alerts_created_at (created_at),
    INDEX idx_deliverability_alerts_unresolved (tenant_id, is_resolved) WHERE is_resolved = FALSE
);

-- Create tenant deliverability scores table
CREATE TABLE IF NOT EXISTS tenant_deliverability_scores (
    tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
    delivery_rate DECIMAL(5,2) DEFAULT 0,
    bounce_rate DECIMAL(5,2) DEFAULT 0,
    complaint_rate DECIMAL(5,3) DEFAULT 0,
    open_rate DECIMAL(5,2) DEFAULT 0,
    click_rate DECIMAL(5,2) DEFAULT 0,
    spam_rate DECIMAL(5,3) DEFAULT 0,
    unsubscribe_rate DECIMAL(5,3) DEFAULT 0,
    reputation_score INTEGER DEFAULT 100 CHECK (reputation_score >= 0 AND reputation_score <= 100),
    authentication_score INTEGER DEFAULT 100 CHECK (authentication_score >= 0 AND authentication_score <= 100),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_tenant_deliverability_scores_reputation (reputation_score),
    INDEX idx_tenant_deliverability_scores_updated (updated_at)
);

-- Create deliverability metrics history table for tracking trends
CREATE TABLE IF NOT EXISTS deliverability_metrics_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    delivery_rate DECIMAL(5,2) DEFAULT 0,
    bounce_rate DECIMAL(5,2) DEFAULT 0,
    complaint_rate DECIMAL(5,3) DEFAULT 0,
    open_rate DECIMAL(5,2) DEFAULT 0,
    click_rate DECIMAL(5,2) DEFAULT 0,
    spam_rate DECIMAL(5,3) DEFAULT 0,
    unsubscribe_rate DECIMAL(5,3) DEFAULT 0,
    reputation_score INTEGER DEFAULT 100,
    authentication_score INTEGER DEFAULT 100,
    total_emails_sent INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE (tenant_id, date),
    INDEX idx_deliverability_history_tenant_date (tenant_id, date),
    INDEX idx_deliverability_history_date (date)
);

-- Create spam analysis results table
CREATE TABLE IF NOT EXISTS spam_analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    email_subject TEXT,
    spam_score DECIMAL(5,2) NOT NULL,
    factors JSONB,
    recommendations JSONB,
    is_likely_spam BOOLEAN DEFAULT FALSE,
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_spam_analysis_tenant_id (tenant_id),
    INDEX idx_spam_analysis_campaign_id (campaign_id),
    INDEX idx_spam_analysis_score (spam_score),
    INDEX idx_spam_analysis_date (analyzed_at)
);

-- Create authentication check results table
CREATE TABLE IF NOT EXISTS authentication_check_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id UUID REFERENCES domains(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    domain_name VARCHAR(255) NOT NULL,
    spf_valid BOOLEAN DEFAULT FALSE,
    spf_score INTEGER DEFAULT 0,
    spf_details TEXT,
    dkim_valid BOOLEAN DEFAULT FALSE,
    dkim_score INTEGER DEFAULT 0,
    dkim_details TEXT,
    dmarc_valid BOOLEAN DEFAULT FALSE,
    dmarc_score INTEGER DEFAULT 0,
    dmarc_details TEXT,
    overall_score INTEGER DEFAULT 0,
    is_valid BOOLEAN DEFAULT FALSE,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_auth_check_domain_id (domain_id),
    INDEX idx_auth_check_tenant_id (tenant_id),
    INDEX idx_auth_check_overall_score (overall_score),
    INDEX idx_auth_check_date (checked_at)
);

-- Create reputation monitoring table
CREATE TABLE IF NOT EXISTS reputation_monitoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sender_score INTEGER DEFAULT 100,
    domain_score INTEGER DEFAULT 100,
    ip_score INTEGER DEFAULT 100,
    overall_score INTEGER DEFAULT 100,
    factors JSONB,
    trend VARCHAR(20) DEFAULT 'stable' CHECK (trend IN ('improving', 'stable', 'declining')),
    monitored_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    INDEX idx_reputation_monitoring_tenant_id (tenant_id),
    INDEX idx_reputation_monitoring_overall_score (overall_score),
    INDEX idx_reputation_monitoring_trend (trend),
    INDEX idx_reputation_monitoring_date (monitored_at)
);

-- Create deliverability optimization recommendations table
CREATE TABLE IF NOT EXISTS deliverability_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    recommendation_type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    action_items JSONB,
    estimated_improvement DECIMAL(5,2),
    is_implemented BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    implemented_at TIMESTAMP WITH TIME ZONE,
    
    INDEX idx_deliverability_recommendations_tenant_id (tenant_id),
    INDEX idx_deliverability_recommendations_type (recommendation_type),
    INDEX idx_deliverability_recommendations_priority (priority),
    INDEX idx_deliverability_recommendations_status (tenant_id, is_implemented)
);

-- Create function to automatically archive old deliverability data
CREATE OR REPLACE FUNCTION archive_old_deliverability_data()
RETURNS void AS $$
BEGIN
    -- Archive alerts older than 90 days
    DELETE FROM deliverability_alerts 
    WHERE created_at < NOW() - INTERVAL '90 days' 
    AND is_resolved = TRUE;
    
    -- Archive metrics history older than 1 year
    DELETE FROM deliverability_metrics_history 
    WHERE date < CURRENT_DATE - INTERVAL '1 year';
    
    -- Archive spam analysis results older than 30 days
    DELETE FROM spam_analysis_results 
    WHERE analyzed_at < NOW() - INTERVAL '30 days';
    
    -- Archive authentication check results older than 30 days (keep latest for each domain)
    DELETE FROM authentication_check_results 
    WHERE checked_at < NOW() - INTERVAL '30 days'
    AND id NOT IN (
        SELECT DISTINCT ON (domain_id) id
        FROM authentication_check_results
        ORDER BY domain_id, checked_at DESC
    );
    
    -- Archive reputation monitoring older than 60 days
    DELETE FROM reputation_monitoring 
    WHERE monitored_at < NOW() - INTERVAL '60 days';
END;
$$ LANGUAGE plpgsql;

-- Create indexes for better performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_events_deliverability 
ON email_events (tenant_id, event_type, timestamp) 
WHERE event_type IN ('sent', 'delivered', 'bounced', 'complained', 'opened', 'clicked', 'unsubscribed');

-- Create materialized view for quick deliverability dashboard queries
CREATE MATERIALIZED VIEW IF NOT EXISTS deliverability_dashboard_stats AS
SELECT 
    ee.tenant_id,
    DATE(ee.timestamp) as date,
    COUNT(*) as total_emails,
    COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END) as sent,
    COUNT(CASE WHEN ee.event_type = 'delivered' THEN 1 END) as delivered,
    COUNT(CASE WHEN ee.event_type = 'bounced' THEN 1 END) as bounced,
    COUNT(CASE WHEN ee.event_type = 'complained' THEN 1 END) as complained,
    COUNT(CASE WHEN ee.event_type = 'opened' THEN 1 END) as opened,
    COUNT(CASE WHEN ee.event_type = 'clicked' THEN 1 END) as clicked,
    COUNT(CASE WHEN ee.event_type = 'unsubscribed' THEN 1 END) as unsubscribed,
    
    -- Calculate rates
    CASE 
        WHEN COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END) > 0 
        THEN ROUND((COUNT(CASE WHEN ee.event_type = 'delivered' THEN 1 END)::DECIMAL / 
                   COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END)) * 100, 2)
        ELSE 0 
    END as delivery_rate,
    
    CASE 
        WHEN COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END) > 0 
        THEN ROUND((COUNT(CASE WHEN ee.event_type = 'bounced' THEN 1 END)::DECIMAL / 
                   COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END)) * 100, 2)
        ELSE 0 
    END as bounce_rate,
    
    CASE 
        WHEN COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END) > 0 
        THEN ROUND((COUNT(CASE WHEN ee.event_type = 'complained' THEN 1 END)::DECIMAL / 
                   COUNT(CASE WHEN ee.event_type = 'sent' THEN 1 END)) * 100, 3)
        ELSE 0 
    END as complaint_rate,
    
    CASE 
        WHEN COUNT(CASE WHEN ee.event_type = 'delivered' THEN 1 END) > 0 
        THEN ROUND((COUNT(CASE WHEN ee.event_type = 'opened' THEN 1 END)::DECIMAL / 
                   COUNT(CASE WHEN ee.event_type = 'delivered' THEN 1 END)) * 100, 2)
        ELSE 0 
    END as open_rate,
    
    CASE 
        WHEN COUNT(CASE WHEN ee.event_type = 'delivered' THEN 1 END) > 0 
        THEN ROUND((COUNT(CASE WHEN ee.event_type = 'clicked' THEN 1 END)::DECIMAL / 
                   COUNT(CASE WHEN ee.event_type = 'delivered' THEN 1 END)) * 100, 2)
        ELSE 0 
    END as click_rate
    
FROM email_events ee
WHERE ee.timestamp >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY ee.tenant_id, DATE(ee.timestamp);

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_deliverability_dashboard_stats_unique 
ON deliverability_dashboard_stats (tenant_id, date);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_deliverability_dashboard_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY deliverability_dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE deliverability_alerts IS 'Stores alerts for deliverability issues like high bounce rates, low delivery rates, etc.';
COMMENT ON TABLE tenant_deliverability_scores IS 'Current deliverability scores and metrics for each tenant';
COMMENT ON TABLE deliverability_metrics_history IS 'Historical daily deliverability metrics for trend analysis';
COMMENT ON TABLE spam_analysis_results IS 'Results of spam score analysis for email content';
COMMENT ON TABLE authentication_check_results IS 'Results of SPF, DKIM, DMARC authentication checks';
COMMENT ON TABLE reputation_monitoring IS 'Sender reputation monitoring data and trends';
COMMENT ON TABLE deliverability_recommendations IS 'Optimization recommendations for improving deliverability';
COMMENT ON MATERIALIZED VIEW deliverability_dashboard_stats IS 'Pre-calculated deliverability statistics for dashboard performance';