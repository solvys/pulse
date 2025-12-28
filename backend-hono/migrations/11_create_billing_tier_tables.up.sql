-- Billing tier tables for feature access control

-- User billing table
CREATE TABLE IF NOT EXISTS user_billing (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  billing_tier VARCHAR(20) NOT NULL CHECK (billing_tier IN ('free', 'pulse', 'pulse_plus', 'pulse_pro')),
  tier_selected_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_billing_user_id ON user_billing(user_id);
CREATE INDEX idx_user_billing_tier ON user_billing(billing_tier);

-- Feature access mapping (for reference, stored in code but can be queried)
-- This table documents which features require which tiers
CREATE TABLE IF NOT EXISTS feature_tier_mapping (
  id SERIAL PRIMARY KEY,
  feature_name VARCHAR(100) NOT NULL UNIQUE,
  required_tier VARCHAR(20) NOT NULL CHECK (required_tier IN ('free', 'pulse', 'pulse_plus', 'pulse_pro')),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default feature mappings
INSERT INTO feature_tier_mapping (feature_name, required_tier, description) VALUES
  ('basic_news_feed', 'free', 'Basic news feed access'),
  ('basic_iv_scores', 'free', 'Basic IV score calculations'),
  ('psychassist', 'pulse', 'PsychAssist emotional resonance monitoring'),
  ('basic_riskflow', 'pulse', 'Basic RiskFlow with implied volatility scoring'),
  ('trading_psych_agent', 'pulse', 'Trading Psych Agent for ER Analysis'),
  ('full_riskflow', 'pulse_plus', 'Full RiskFlow for commentary and macroeconomic data releases'),
  ('autonomous_trading', 'pulse_plus', 'Autonomous Trading Algo'),
  ('risk_management_tools', 'pulse_plus', 'Advanced risk management tools'),
  ('polymarket_integration', 'pulse_plus', 'Polymarket prediction market integration'),
  ('custom_ai_agents', 'pulse_pro', 'Custom AI Agent & Trading model training'),
  ('multi_account_management', 'pulse_pro', 'Multi-account management'),
  ('risk_event_playbook', 'pulse_pro', 'Access to Risk Event Trading Playbook from Priced In Research'),
  ('priority_support', 'pulse_pro', 'Priority customer support')
ON CONFLICT (feature_name) DO NOTHING;
