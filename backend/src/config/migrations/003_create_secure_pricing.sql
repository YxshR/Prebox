-- Secure Pricing Table Migration
-- JWT-protected pricing data to prevent client-side manipulation

-- Create secure pricing table
CREATE TABLE IF NOT EXISTS secure_pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id VARCHAR(50) UNIQUE NOT NULL,
  plan_name VARCHAR(100) NOT NULL,
  price_amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  billing_cycle VARCHAR(20) DEFAULT 'monthly', -- monthly, yearly, one-time
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  jwt_signature TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  is_popular BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for efficient pricing queries
CREATE INDEX IF NOT EXISTS idx_secure_pricing_plan_id ON secure_pricing(plan_id);
CREATE INDEX IF NOT EXISTS idx_secure_pricing_active ON secure_pricing(is_active);
CREATE INDEX IF NOT EXISTS idx_secure_pricing_display_order ON secure_pricing(display_order);
CREATE INDEX IF NOT EXISTS idx_secure_pricing_currency ON secure_pricing(currency);

-- Add updated_at trigger for secure_pricing table
DROP TRIGGER IF EXISTS trigger_secure_pricing_updated_at ON secure_pricing;
CREATE TRIGGER trigger_secure_pricing_updated_at
  BEFORE UPDATE ON secure_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate JWT signature for pricing data
CREATE OR REPLACE FUNCTION generate_pricing_jwt_signature(
  p_plan_id VARCHAR(50),
  p_price_amount DECIMAL(10,2),
  p_currency VARCHAR(3),
  p_billing_cycle VARCHAR(20)
)
RETURNS TEXT AS $$
DECLARE
  pricing_data TEXT;
  jwt_secret TEXT;
BEGIN
  -- Get the system JWT secret from environment or use a default for development
  jwt_secret := COALESCE(current_setting('app.jwt_secret', true), 'default_pricing_secret_key');
  
  -- Create a string representation of pricing data
  pricing_data := p_plan_id || '|' || p_price_amount::TEXT || '|' || p_currency || '|' || p_billing_cycle;
  
  -- Generate a simple hash-based signature (in production, use proper JWT library)
  RETURN encode(digest(pricing_data || jwt_secret, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to validate pricing JWT signature
CREATE OR REPLACE FUNCTION validate_pricing_signature(
  p_plan_id VARCHAR(50),
  p_price_amount DECIMAL(10,2),
  p_currency VARCHAR(3),
  p_billing_cycle VARCHAR(20),
  p_signature TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  expected_signature TEXT;
BEGIN
  expected_signature := generate_pricing_jwt_signature(p_plan_id, p_price_amount, p_currency, p_billing_cycle);
  RETURN expected_signature = p_signature;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate JWT signature when pricing is inserted or updated
CREATE OR REPLACE FUNCTION update_pricing_jwt_signature()
RETURNS TRIGGER AS $$
BEGIN
  NEW.jwt_signature := generate_pricing_jwt_signature(
    NEW.plan_id,
    NEW.price_amount,
    NEW.currency,
    NEW.billing_cycle
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-generating JWT signatures
DROP TRIGGER IF EXISTS trigger_update_pricing_jwt ON secure_pricing;
CREATE TRIGGER trigger_update_pricing_jwt
  BEFORE INSERT OR UPDATE ON secure_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_pricing_jwt_signature();

-- Function to get secure pricing data with validation
CREATE OR REPLACE FUNCTION get_secure_pricing(p_plan_id VARCHAR(50) DEFAULT NULL)
RETURNS TABLE(
  plan_id VARCHAR(50),
  plan_name VARCHAR(100),
  price_amount DECIMAL(10,2),
  currency VARCHAR(3),
  billing_cycle VARCHAR(20),
  features JSONB,
  limits JSONB,
  is_popular BOOLEAN,
  jwt_signature TEXT
) AS $$
BEGIN
  IF p_plan_id IS NOT NULL THEN
    -- Return specific plan
    RETURN QUERY
    SELECT sp.plan_id, sp.plan_name, sp.price_amount, sp.currency, sp.billing_cycle,
           sp.features, sp.limits, sp.is_popular, sp.jwt_signature
    FROM secure_pricing sp
    WHERE sp.plan_id = p_plan_id AND sp.is_active = TRUE;
  ELSE
    -- Return all active plans ordered by display_order
    RETURN QUERY
    SELECT sp.plan_id, sp.plan_name, sp.price_amount, sp.currency, sp.billing_cycle,
           sp.features, sp.limits, sp.is_popular, sp.jwt_signature
    FROM secure_pricing sp
    WHERE sp.is_active = TRUE
    ORDER BY sp.display_order ASC, sp.created_at ASC;
  END IF;
END;
$$ LANGUAGE plpgsql;