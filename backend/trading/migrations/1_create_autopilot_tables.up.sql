-- Autopilot system tables for Phase 4
-- Creates proposed_actions table and adds risk management fields to accounts

-- Proposed actions table for human-in-the-loop trading
CREATE TABLE IF NOT EXISTS proposed_actions (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  account_id INTEGER NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('place_order', 'modify_order', 'cancel_order')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'acknowledged', 'rejected', 'executed', 'failed')),
  action_data JSONB NOT NULL, -- Contains ProjectX API parameters
  risk_validation JSONB, -- Stores risk check results (max_daily_loss, max_position_size, etc.)
  executed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_proposed_actions_user_id ON proposed_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_proposed_actions_account_id ON proposed_actions(account_id);
CREATE INDEX IF NOT EXISTS idx_proposed_actions_status ON proposed_actions(status);
CREATE INDEX IF NOT EXISTS idx_proposed_actions_created_at ON proposed_actions(created_at);

-- Add risk management fields to accounts table
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS max_daily_loss DECIMAL(18, 2) DEFAULT 1000.00;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS max_position_size INTEGER DEFAULT 10;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS autopilot_enabled BOOLEAN DEFAULT FALSE;

-- Add comment for clarity
COMMENT ON COLUMN accounts.max_daily_loss IS 'Maximum daily loss allowed before blocking new trades (negative value)';
COMMENT ON COLUMN accounts.max_position_size IS 'Maximum position size allowed across all contracts';
COMMENT ON COLUMN accounts.autopilot_enabled IS 'Whether autopilot trading is enabled for this account';