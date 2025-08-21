-- Secure Pricing Seed Data
-- Initial pricing plans with JWT-signed data for the home page redesign

-- Insert Free Plan
INSERT INTO secure_pricing (
  plan_id,
  plan_name,
  price_amount,
  currency,
  billing_cycle,
  features,
  limits,
  is_active,
  display_order,
  is_popular
) VALUES (
  'free',
  'Free Plan',
  0.00,
  'INR',
  'monthly',
  '[
    "100 emails per day",
    "300 recipients per month",
    "Basic email templates",
    "Email analytics",
    "Community support"
  ]'::jsonb,
  '{
    "daily_email_limit": 100,
    "monthly_recipient_limit": 300,
    "monthly_email_limit": 2000,
    "template_limit": 1,
    "custom_domain_limit": 0,
    "api_access": false,
    "priority_support": false
  }'::jsonb,
  true,
  1,
  false
) ON CONFLICT (plan_id) DO UPDATE SET
  plan_name = EXCLUDED.plan_name,
  price_amount = EXCLUDED.price_amount,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  updated_at = CURRENT_TIMESTAMP;

-- Insert Starter Plan
INSERT INTO secure_pricing (
  plan_id,
  plan_name,
  price_amount,
  currency,
  billing_cycle,
  features,
  limits,
  is_active,
  display_order,
  is_popular
) VALUES (
  'starter',
  'Starter Plan',
  499.00,
  'INR',
  'monthly',
  '[
    "1,000 emails per day",
    "5,000 recipients per month",
    "Advanced email templates",
    "Email automation",
    "Detailed analytics",
    "Email support"
  ]'::jsonb,
  '{
    "daily_email_limit": 1000,
    "monthly_recipient_limit": 5000,
    "monthly_email_limit": 20000,
    "template_limit": 10,
    "custom_domain_limit": 1,
    "api_access": true,
    "priority_support": false
  }'::jsonb,
  true,
  2,
  true
) ON CONFLICT (plan_id) DO UPDATE SET
  plan_name = EXCLUDED.plan_name,
  price_amount = EXCLUDED.price_amount,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  is_popular = EXCLUDED.is_popular,
  updated_at = CURRENT_TIMESTAMP;

-- Insert Professional Plan
INSERT INTO secure_pricing (
  plan_id,
  plan_name,
  price_amount,
  currency,
  billing_cycle,
  features,
  limits,
  is_active,
  display_order,
  is_popular
) VALUES (
  'professional',
  'Professional Plan',
  999.00,
  'INR',
  'monthly',
  '[
    "5,000 emails per day",
    "25,000 recipients per month",
    "Premium email templates",
    "Advanced automation",
    "A/B testing",
    "Custom domains",
    "Priority support",
    "API access"
  ]'::jsonb,
  '{
    "daily_email_limit": 5000,
    "monthly_recipient_limit": 25000,
    "monthly_email_limit": 100000,
    "template_limit": 50,
    "custom_domain_limit": 5,
    "api_access": true,
    "priority_support": true,
    "ab_testing": true
  }'::jsonb,
  true,
  3,
  false
) ON CONFLICT (plan_id) DO UPDATE SET
  plan_name = EXCLUDED.plan_name,
  price_amount = EXCLUDED.price_amount,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  updated_at = CURRENT_TIMESTAMP;

-- Insert Enterprise Plan
INSERT INTO secure_pricing (
  plan_id,
  plan_name,
  price_amount,
  currency,
  billing_cycle,
  features,
  limits,
  is_active,
  display_order,
  is_popular
) VALUES (
  'enterprise',
  'Enterprise Plan',
  2499.00,
  'INR',
  'monthly',
  '[
    "Unlimited emails per day",
    "Unlimited recipients",
    "Custom email templates",
    "Advanced automation workflows",
    "Multi-user accounts",
    "Dedicated IP",
    "White-label solution",
    "24/7 phone support",
    "Custom integrations"
  ]'::jsonb,
  '{
    "daily_email_limit": -1,
    "monthly_recipient_limit": -1,
    "monthly_email_limit": -1,
    "template_limit": -1,
    "custom_domain_limit": -1,
    "api_access": true,
    "priority_support": true,
    "ab_testing": true,
    "dedicated_ip": true,
    "white_label": true,
    "multi_user": true
  }'::jsonb,
  true,
  4,
  false
) ON CONFLICT (plan_id) DO UPDATE SET
  plan_name = EXCLUDED.plan_name,
  price_amount = EXCLUDED.price_amount,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  updated_at = CURRENT_TIMESTAMP;

-- Insert Yearly Starter Plan (with discount)
INSERT INTO secure_pricing (
  plan_id,
  plan_name,
  price_amount,
  currency,
  billing_cycle,
  features,
  limits,
  is_active,
  display_order,
  is_popular
) VALUES (
  'starter_yearly',
  'Starter Plan (Yearly)',
  4990.00,
  'INR',
  'yearly',
  '[
    "1,000 emails per day",
    "5,000 recipients per month",
    "Advanced email templates",
    "Email automation",
    "Detailed analytics",
    "Email support",
    "2 months free"
  ]'::jsonb,
  '{
    "daily_email_limit": 1000,
    "monthly_recipient_limit": 5000,
    "monthly_email_limit": 20000,
    "template_limit": 10,
    "custom_domain_limit": 1,
    "api_access": true,
    "priority_support": false
  }'::jsonb,
  true,
  5,
  false
) ON CONFLICT (plan_id) DO UPDATE SET
  plan_name = EXCLUDED.plan_name,
  price_amount = EXCLUDED.price_amount,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  updated_at = CURRENT_TIMESTAMP;

-- Insert Yearly Professional Plan (with discount)
INSERT INTO secure_pricing (
  plan_id,
  plan_name,
  price_amount,
  currency,
  billing_cycle,
  features,
  limits,
  is_active,
  display_order,
  is_popular
) VALUES (
  'professional_yearly',
  'Professional Plan (Yearly)',
  9990.00,
  'INR',
  'yearly',
  '[
    "5,000 emails per day",
    "25,000 recipients per month",
    "Premium email templates",
    "Advanced automation",
    "A/B testing",
    "Custom domains",
    "Priority support",
    "API access",
    "2 months free"
  ]'::jsonb,
  '{
    "daily_email_limit": 5000,
    "monthly_recipient_limit": 25000,
    "monthly_email_limit": 100000,
    "template_limit": 50,
    "custom_domain_limit": 5,
    "api_access": true,
    "priority_support": true,
    "ab_testing": true
  }'::jsonb,
  true,
  6,
  false
) ON CONFLICT (plan_id) DO UPDATE SET
  plan_name = EXCLUDED.plan_name,
  price_amount = EXCLUDED.price_amount,
  features = EXCLUDED.features,
  limits = EXCLUDED.limits,
  updated_at = CURRENT_TIMESTAMP;