-- AI Templates Database Schema
-- This migration creates tables for AI template generation, usage tracking, and customization

-- Template usage tracking table
CREATE TABLE IF NOT EXISTS template_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    daily_usage INTEGER DEFAULT 0,
    monthly_usage INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_daily_reset DATE DEFAULT CURRENT_DATE,
    last_monthly_reset DATE DEFAULT CURRENT_DATE,
    tier VARCHAR(50) NOT NULL DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_template_usage_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- AI template generation jobs table
CREATE TABLE IF NOT EXISTS ai_template_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    prompt TEXT NOT NULL,
    template_type VARCHAR(50),
    tone VARCHAR(50),
    industry VARCHAR(100),
    target_audience VARCHAR(200),
    call_to_action VARCHAR(200),
    brand_name VARCHAR(100),
    additional_context TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    ai_provider VARCHAR(50) DEFAULT 'openai',
    ai_model VARCHAR(50),
    tokens_used INTEGER,
    generation_time_ms INTEGER,
    error_message TEXT,
    result_template_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT fk_ai_jobs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_ai_jobs_template FOREIGN KEY (result_template_id) REFERENCES email_templates(id) ON DELETE SET NULL,
    CONSTRAINT chk_ai_job_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Template customizations table
CREATE TABLE IF NOT EXISTS template_customizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    original_template_id UUID NOT NULL,
    customized_template_id UUID NOT NULL,
    modifications JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_customizations_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_customizations_original FOREIGN KEY (original_template_id) REFERENCES email_templates(id) ON DELETE CASCADE,
    CONSTRAINT fk_customizations_result FOREIGN KEY (customized_template_id) REFERENCES email_templates(id) ON DELETE CASCADE
);

-- AI template analytics table
CREATE TABLE IF NOT EXISTS ai_template_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    template_id UUID NOT NULL,
    generation_job_id UUID,
    prompt_length INTEGER,
    generation_time_ms INTEGER,
    tokens_used INTEGER,
    ai_provider VARCHAR(50),
    ai_model VARCHAR(50),
    template_type VARCHAR(50),
    tone VARCHAR(50),
    industry VARCHAR(100),
    success BOOLEAN DEFAULT true,
    error_code VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_analytics_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_analytics_template FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE CASCADE,
    CONSTRAINT fk_analytics_job FOREIGN KEY (generation_job_id) REFERENCES ai_template_jobs(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_template_usage_tenant_id ON template_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_last_used ON template_usage(last_used_at);
CREATE INDEX IF NOT EXISTS idx_template_usage_tier ON template_usage(tier);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_tenant_id ON ai_template_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_status ON ai_template_jobs(status);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_created_at ON ai_template_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_provider ON ai_template_jobs(ai_provider);

CREATE INDEX IF NOT EXISTS idx_customizations_tenant_id ON template_customizations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customizations_original ON template_customizations(original_template_id);
CREATE INDEX IF NOT EXISTS idx_customizations_created_at ON template_customizations(created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_tenant_id ON ai_template_analytics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_analytics_template_id ON ai_template_analytics(template_id);
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON ai_template_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_provider ON ai_template_analytics(ai_provider);
CREATE INDEX IF NOT EXISTS idx_analytics_success ON ai_template_analytics(success);

-- Update email_templates table to include AI-specific fields if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_templates' AND column_name = 'is_ai_generated') THEN
        ALTER TABLE email_templates ADD COLUMN is_ai_generated BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_templates' AND column_name = 'ai_generation_metadata') THEN
        ALTER TABLE email_templates ADD COLUMN ai_generation_metadata JSONB;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_templates' AND column_name = 'template_type') THEN
        ALTER TABLE email_templates ADD COLUMN template_type VARCHAR(50);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'email_templates' AND column_name = 'tone') THEN
        ALTER TABLE email_templates ADD COLUMN tone VARCHAR(50);
    END IF;
END $$;

-- Create indexes on new email_templates columns
CREATE INDEX IF NOT EXISTS idx_email_templates_ai_generated ON email_templates(is_ai_generated);
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_email_templates_tone ON email_templates(tone);

-- Function to automatically update template usage timestamps
CREATE OR REPLACE FUNCTION update_template_usage_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update timestamps
DROP TRIGGER IF EXISTS trigger_update_template_usage_timestamp ON template_usage;
CREATE TRIGGER trigger_update_template_usage_timestamp
    BEFORE UPDATE ON template_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_template_usage_timestamp();

-- Function to reset daily/monthly usage counters
CREATE OR REPLACE FUNCTION reset_usage_counters()
RETURNS void AS $$
BEGIN
    -- Reset daily usage for new day
    UPDATE template_usage 
    SET daily_usage = 0, 
        last_daily_reset = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
    WHERE last_daily_reset < CURRENT_DATE;
    
    -- Reset monthly usage for new month
    UPDATE template_usage 
    SET monthly_usage = 0, 
        last_monthly_reset = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
    WHERE EXTRACT(MONTH FROM last_monthly_reset) != EXTRACT(MONTH FROM CURRENT_DATE)
       OR EXTRACT(YEAR FROM last_monthly_reset) != EXTRACT(YEAR FROM CURRENT_DATE);
END;
$$ LANGUAGE plpgsql;

-- Create a view for template usage statistics
CREATE OR REPLACE VIEW template_usage_stats AS
SELECT 
    tu.tenant_id,
    tu.daily_usage,
    tu.monthly_usage,
    tu.tier,
    tu.last_used_at,
    CASE 
        WHEN tu.tier = 'free' THEN 1
        WHEN tu.tier = 'paid_standard' THEN 10
        ELSE -1  -- unlimited for premium/enterprise
    END as daily_limit,
    CASE 
        WHEN tu.tier = 'free' THEN 30
        WHEN tu.tier = 'paid_standard' THEN 300
        ELSE -1  -- unlimited for premium/enterprise
    END as monthly_limit,
    CASE 
        WHEN tu.tier IN ('premium', 'enterprise') THEN true
        ELSE false
    END as has_unlimited_access,
    COUNT(atj.id) as total_generations,
    AVG(atj.generation_time_ms) as avg_generation_time,
    SUM(atj.tokens_used) as total_tokens_used
FROM template_usage tu
LEFT JOIN ai_template_jobs atj ON tu.tenant_id = atj.tenant_id 
    AND atj.status = 'completed'
    AND atj.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY tu.tenant_id, tu.daily_usage, tu.monthly_usage, tu.tier, tu.last_used_at;

-- Insert default usage records for existing tenants (if any)
INSERT INTO template_usage (tenant_id, tier)
SELECT id, 'free'
FROM tenants 
WHERE id NOT IN (SELECT tenant_id FROM template_usage)
ON CONFLICT DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE template_usage IS 'Tracks AI template generation usage per tenant with daily and monthly limits';
COMMENT ON TABLE ai_template_jobs IS 'Stores AI template generation job details and results';
COMMENT ON TABLE template_customizations IS 'Tracks template customization history and modifications';
COMMENT ON TABLE ai_template_analytics IS 'Analytics data for AI template generation performance and usage patterns';
COMMENT ON VIEW template_usage_stats IS 'Aggregated view of template usage statistics with limits and analytics';

COMMENT ON COLUMN template_usage.daily_usage IS 'Number of templates generated today';
COMMENT ON COLUMN template_usage.monthly_usage IS 'Number of templates generated this month';
COMMENT ON COLUMN template_usage.last_daily_reset IS 'Date when daily usage was last reset';
COMMENT ON COLUMN template_usage.last_monthly_reset IS 'Date when monthly usage was last reset';

COMMENT ON COLUMN ai_template_jobs.prompt IS 'User prompt for template generation';
COMMENT ON COLUMN ai_template_jobs.tokens_used IS 'Number of AI tokens consumed for generation';
COMMENT ON COLUMN ai_template_jobs.generation_time_ms IS 'Time taken to generate template in milliseconds';

COMMENT ON COLUMN template_customizations.modifications IS 'JSON object containing template modifications (styling, content, etc.)';

-- Grant permissions (adjust based on your user roles)
-- GRANT SELECT, INSERT, UPDATE ON template_usage TO app_user;
-- GRANT SELECT, INSERT, UPDATE ON ai_template_jobs TO app_user;
-- GRANT SELECT, INSERT, UPDATE ON template_customizations TO app_user;
-- GRANT SELECT, INSERT ON ai_template_analytics TO app_user;
-- GRANT SELECT ON template_usage_stats TO app_user;