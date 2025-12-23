-- Initial schema for Pulse database
-- This migration creates the base tables for the application

CREATE TABLE IF NOT EXISTS accounts (
  user_id TEXT PRIMARY KEY,
  balance DECIMAL(18, 2) NOT NULL DEFAULT 0,
  equity DECIMAL(18, 2) NOT NULL DEFAULT 0,
  margin_used DECIMAL(18, 2) NOT NULL DEFAULT 0,
  daily_pnl DECIMAL(18, 2) NOT NULL DEFAULT 0,
  total_pnl DECIMAL(18, 2) NOT NULL DEFAULT 0,
  projectx_account_id INTEGER,
  topstepx_username TEXT,
  topstepx_api_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_projectx_id ON accounts(projectx_account_id);
