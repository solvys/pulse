-- Migration 005: Agent tables for collaborative AI system
-- Creates tables for agent reports, researcher debates, risk assessments, and user psychology

-- Agent reports table for analyst outputs
CREATE TABLE IF NOT EXISTS agent_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  agent_type VARCHAR(50) NOT NULL, -- 'market_data', 'news_sentiment', 'technical', 'bullish', 'bearish'
  report_data JSONB NOT NULL,
  confidence_score DECIMAL(3,2),
  model VARCHAR(50),
  latency_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_agent_reports_user_type ON agent_reports(user_id, agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_reports_created ON agent_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_reports_expires ON agent_reports(expires_at) WHERE expires_at IS NOT NULL;

-- Researcher debates table
CREATE TABLE IF NOT EXISTS researcher_debates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  analyst_report_ids UUID[] NOT NULL,
  bullish_report JSONB NOT NULL,
  bearish_report JSONB NOT NULL,
  debate_rounds JSONB NOT NULL DEFAULT '[]'::jsonb,
  consensus_score DECIMAL(3,2), -- -1 (bearish) to +1 (bullish)
  final_assessment JSONB,
  model VARCHAR(50),
  total_latency_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debates_user ON researcher_debates(user_id);
CREATE INDEX IF NOT EXISTS idx_debates_created ON researcher_debates(created_at DESC);

-- Risk assessments table
CREATE TABLE IF NOT EXISTS risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  proposal_id UUID,
  risk_manager_report JSONB NOT NULL,
  risk_score DECIMAL(3,2), -- 0 (safe) to 1 (dangerous)
  decision VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'approved', 'rejected', 'modified', 'pending'
  rejection_reason TEXT,
  modification_suggestions JSONB,
  model VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_assessments_user ON risk_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_proposal ON risk_assessments(proposal_id) WHERE proposal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_risk_assessments_decision ON risk_assessments(decision);

-- User psychology/blind spots table
CREATE TABLE IF NOT EXISTS user_psychology (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL UNIQUE,
  blind_spots JSONB DEFAULT '[]'::jsonb,
  goal TEXT,
  orientation_complete BOOLEAN DEFAULT FALSE,
  psych_scores JSONB DEFAULT '{}'::jsonb,
  last_assessment_at TIMESTAMP WITH TIME ZONE,
  agent_notes JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_psychology_user ON user_psychology(user_id);

-- Add staleness tracking to conversations
ALTER TABLE ai_conversations 
  ADD COLUMN IF NOT EXISTS stale_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_ai_conversations_stale ON ai_conversations(stale_at) WHERE stale_at IS NOT NULL;

-- User settings table for instrument preferences
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL UNIQUE,
  selected_instrument VARCHAR(50) DEFAULT 'MNQ',
  related_etf VARCHAR(10) DEFAULT 'QQQ',
  autopilot_enabled BOOLEAN DEFAULT FALSE,
  risk_tolerance VARCHAR(20) DEFAULT 'moderate',
  daily_loss_limit DECIMAL(10,2),
  position_size_limit INTEGER,
  enabled_strategies JSONB DEFAULT '[]'::jsonb,
  notification_preferences JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);
