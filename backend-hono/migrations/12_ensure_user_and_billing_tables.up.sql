-- Ensure all user and billing tables exist for Clerk authentication
-- This migration ensures compatibility with Clerk user IDs and billing tiers

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (for tracking Clerk user metadata)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  clerk_user_id VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_users_clerk_user_id ON users(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- User billing table (for feature access control)
CREATE TABLE IF NOT EXISTS user_billing (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  billing_tier VARCHAR(20) NOT NULL CHECK (billing_tier IN ('free', 'pulse', 'pulse_plus', 'pulse_pro')),
  tier_selected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_billing_user_id ON user_billing(user_id);
CREATE INDEX IF NOT EXISTS idx_user_billing_tier ON user_billing(billing_tier);

-- Feature tier mapping (for reference)
CREATE TABLE IF NOT EXISTS feature_tier_mapping (
  id SERIAL PRIMARY KEY,
  feature_name VARCHAR(100) NOT NULL UNIQUE,
  required_tier VARCHAR(20) NOT NULL CHECK (required_tier IN ('free', 'pulse', 'pulse_plus', 'pulse_pro')),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default feature mappings if they don't exist
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

-- Broker accounts (ensure it exists with proper structure)
CREATE TABLE IF NOT EXISTS broker_accounts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  account_id VARCHAR(255) NOT NULL,
  account_name VARCHAR(255),
  account_type VARCHAR(50),
  balance DECIMAL(20, 8) DEFAULT 0,
  equity DECIMAL(20, 8) DEFAULT 0,
  margin_used DECIMAL(20, 8) DEFAULT 0,
  buying_power DECIMAL(20, 8) DEFAULT 0,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, account_id)
);

CREATE INDEX IF NOT EXISTS idx_broker_accounts_user_id ON broker_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_broker_accounts_account_id ON broker_accounts(account_id);

-- ProjectX credentials (ensure it exists)
CREATE TABLE IF NOT EXISTS projectx_credentials (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(255) NOT NULL,
  api_key VARCHAR(512) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projectx_credentials_user_id ON projectx_credentials(user_id);

-- News articles table (ensure it exists for RiskFlow)
CREATE TABLE IF NOT EXISTS news_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  summary TEXT,
  content TEXT,
  source VARCHAR(255),
  url TEXT UNIQUE,
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sentiment DECIMAL(3, 2),
  iv_impact DECIMAL(3, 2),
  symbols TEXT[],
  is_breaking BOOLEAN DEFAULT false,
  macro_level VARCHAR(50),
  price_brain_sentiment VARCHAR(50),
  price_brain_classification VARCHAR(50),
  implied_points DECIMAL(10, 2),
  instrument VARCHAR(50),
  author_handle VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_articles_published_at ON news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_is_breaking ON news_articles(is_breaking);
CREATE INDEX IF NOT EXISTS idx_news_articles_iv_impact ON news_articles(iv_impact DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_symbols ON news_articles USING GIN(symbols);

-- Scheduled events table (for RiskFlow scheduled events)
CREATE TABLE IF NOT EXISTS scheduled_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  source VARCHAR(255),
  impact VARCHAR(20) CHECK (impact IN ('low', 'medium', 'high')),
  symbols TEXT[],
  is_commentary BOOLEAN DEFAULT false,
  event_type VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_events_scheduled_time ON scheduled_events(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_scheduled_events_impact ON scheduled_events(impact);
