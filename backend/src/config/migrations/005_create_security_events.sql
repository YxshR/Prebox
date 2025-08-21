-- Security Events Table Migration
-- For logging pricing tampering attempts and other security events

-- Create security events table
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type VARCHAR(50) NOT NULL,
  user_id UUID,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  severity VARCHAR(20) DEFAULT 'medium', -- low, medium, high, critical
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID
);

-- Add indexes for efficient security event queries
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_resolved ON security_events(is_resolved);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON security_events(ip_address);

-- Add GIN index for JSONB event_data for efficient JSON queries
CREATE INDEX IF NOT EXISTS idx_security_events_data ON security_events USING GIN (event_data);

-- Function to get security event statistics
CREATE OR REPLACE FUNCTION get_security_event_stats(
  p_event_type VARCHAR(50) DEFAULT NULL,
  p_timeframe INTERVAL DEFAULT INTERVAL '1 day'
)
RETURNS TABLE(
  event_type VARCHAR(50),
  total_events BIGINT,
  unique_users BIGINT,
  unique_ips BIGINT,
  severity_breakdown JSONB,
  hourly_distribution JSONB
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    se.event_type,
    COUNT(*) as total_events,
    COUNT(DISTINCT se.user_id) as unique_users,
    COUNT(DISTINCT se.ip_address) as unique_ips,
    json_build_object(
      'low', COUNT(*) FILTER (WHERE se.severity = 'low'),
      'medium', COUNT(*) FILTER (WHERE se.severity = 'medium'),
      'high', COUNT(*) FILTER (WHERE se.severity = 'high'),
      'critical', COUNT(*) FILTER (WHERE se.severity = 'critical')
    )::jsonb as severity_breakdown,
    json_object_agg(
      EXTRACT(hour FROM se.created_at)::text,
      COUNT(*)
    )::jsonb as hourly_distribution
  FROM security_events se
  WHERE se.created_at >= NOW() - p_timeframe
    AND (p_event_type IS NULL OR se.event_type = p_event_type)
  GROUP BY se.event_type
  ORDER BY total_events DESC;
END;
$ LANGUAGE plpgsql;

-- Function to get pricing tampering statistics specifically
CREATE OR REPLACE FUNCTION get_pricing_tampering_stats(
  p_timeframe INTERVAL DEFAULT INTERVAL '1 day'
)
RETURNS TABLE(
  total_attempts BIGINT,
  unique_users BIGINT,
  avg_price_difference NUMERIC,
  top_targeted_plans JSONB
) AS $
DECLARE
  result_row RECORD;
BEGIN
  -- Get basic statistics
  SELECT 
    COUNT(*) as attempts,
    COUNT(DISTINCT user_id) as users,
    AVG((event_data->>'priceDifference')::numeric) as avg_diff
  INTO result_row
  FROM security_events 
  WHERE event_type = 'pricing_tampering_attempt' 
    AND created_at >= NOW() - p_timeframe;

  -- Get top targeted plans
  RETURN QUERY
  SELECT 
    COALESCE(result_row.attempts, 0) as total_attempts,
    COALESCE(result_row.users, 0) as unique_users,
    COALESCE(result_row.avg_diff, 0) as avg_price_difference,
    COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'planId', event_data->>'clientPlanId',
            'attempts', COUNT(*)
          )
          ORDER BY COUNT(*) DESC
        )::jsonb
        FROM security_events 
        WHERE event_type = 'pricing_tampering_attempt' 
          AND created_at >= NOW() - p_timeframe
        GROUP BY event_data->>'clientPlanId'
        LIMIT 10
      ),
      '[]'::jsonb
    ) as top_targeted_plans;
END;
$ LANGUAGE plpgsql;

-- Function to log security events with automatic severity detection
CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type VARCHAR(50),
  p_user_id UUID DEFAULT NULL,
  p_event_data JSONB DEFAULT '{}'::jsonb,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $
DECLARE
  event_id UUID;
  event_severity VARCHAR(20);
BEGIN
  -- Determine severity based on event type
  event_severity := CASE 
    WHEN p_event_type IN ('pricing_tampering_attempt', 'payment_fraud_attempt') THEN 'critical'
    WHEN p_event_type IN ('multiple_failed_logins', 'suspicious_api_usage') THEN 'high'
    WHEN p_event_type IN ('rate_limit_exceeded', 'invalid_token_usage') THEN 'medium'
    ELSE 'low'
  END;

  -- Insert security event
  INSERT INTO security_events (
    event_type, user_id, event_data, ip_address, user_agent, severity
  ) VALUES (
    p_event_type, p_user_id, p_event_data, p_ip_address, p_user_agent, event_severity
  ) RETURNING id INTO event_id;

  -- Log critical events to application log
  IF event_severity = 'critical' THEN
    RAISE NOTICE 'CRITICAL SECURITY EVENT: % for user % from IP %', 
      p_event_type, COALESCE(p_user_id::text, 'unknown'), COALESCE(p_ip_address::text, 'unknown');
  END IF;

  RETURN event_id;
END;
$ LANGUAGE plpgsql;

-- Function to clean up old security events (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_security_events(
  p_retention_days INTEGER DEFAULT 90
)
RETURNS INTEGER AS $
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete events older than retention period, but keep critical events longer
  DELETE FROM security_events 
  WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL
    AND severity != 'critical';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete critical events older than 1 year
  DELETE FROM security_events 
  WHERE created_at < NOW() - INTERVAL '1 year'
    AND severity = 'critical';
  
  GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
  
  RETURN deleted_count;
END;
$ LANGUAGE plpgsql;

-- Create trigger to automatically update pricing tampering statistics
CREATE OR REPLACE FUNCTION update_pricing_tampering_stats()
RETURNS TRIGGER AS $
BEGIN
  -- If this is a pricing tampering event, update real-time statistics
  IF NEW.event_type = 'pricing_tampering_attempt' THEN
    -- Insert or update daily statistics
    INSERT INTO pricing_tampering_daily_stats (
      date, total_attempts, unique_users, avg_price_difference
    ) VALUES (
      CURRENT_DATE,
      1,
      1,
      (NEW.event_data->>'priceDifference')::numeric
    )
    ON CONFLICT (date) DO UPDATE SET
      total_attempts = pricing_tampering_daily_stats.total_attempts + 1,
      unique_users = (
        SELECT COUNT(DISTINCT user_id) 
        FROM security_events 
        WHERE event_type = 'pricing_tampering_attempt' 
          AND DATE(created_at) = CURRENT_DATE
      ),
      avg_price_difference = (
        SELECT AVG((event_data->>'priceDifference')::numeric)
        FROM security_events 
        WHERE event_type = 'pricing_tampering_attempt' 
          AND DATE(created_at) = CURRENT_DATE
      ),
      updated_at = CURRENT_TIMESTAMP;
  END IF;
  
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Create daily statistics table for pricing tampering
CREATE TABLE IF NOT EXISTS pricing_tampering_daily_stats (
  date DATE PRIMARY KEY,
  total_attempts INTEGER DEFAULT 0,
  unique_users INTEGER DEFAULT 0,
  avg_price_difference NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for automatic statistics updates
DROP TRIGGER IF EXISTS trigger_update_tampering_stats ON security_events;
CREATE TRIGGER trigger_update_tampering_stats
  AFTER INSERT ON security_events
  FOR EACH ROW
  EXECUTE FUNCTION update_pricing_tampering_stats();

-- Create view for security dashboard
CREATE OR REPLACE VIEW security_dashboard AS
SELECT 
  event_type,
  COUNT(*) as total_events,
  COUNT(DISTINCT user_id) as unique_users,
  COUNT(DISTINCT ip_address) as unique_ips,
  MAX(created_at) as last_occurrence,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 hour') as last_hour,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '1 day') as last_day,
  COUNT(*) FILTER (WHERE severity = 'critical') as critical_events,
  COUNT(*) FILTER (WHERE severity = 'high') as high_events
FROM security_events 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY event_type
ORDER BY total_events DESC;

-- Insert initial security event types for reference
INSERT INTO security_events (event_type, event_data, severity) VALUES
  ('pricing_tampering_attempt', '{"description": "Client-side pricing manipulation detected"}', 'critical'),
  ('payment_fraud_attempt', '{"description": "Fraudulent payment attempt detected"}', 'critical'),
  ('multiple_failed_logins', '{"description": "Multiple failed login attempts"}', 'high'),
  ('suspicious_api_usage', '{"description": "Unusual API usage pattern detected"}', 'high'),
  ('rate_limit_exceeded', '{"description": "API rate limit exceeded"}', 'medium'),
  ('invalid_token_usage', '{"description": "Invalid or expired token used"}', 'medium')
ON CONFLICT DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE security_events IS 'Stores security-related events including pricing tampering attempts, failed logins, and other suspicious activities';
COMMENT ON FUNCTION log_security_event IS 'Logs security events with automatic severity detection and critical event notifications';
COMMENT ON FUNCTION get_pricing_tampering_stats IS 'Returns statistics about pricing tampering attempts for monitoring and alerting';
COMMENT ON VIEW security_dashboard IS 'Provides a summary view of security events for dashboard display';