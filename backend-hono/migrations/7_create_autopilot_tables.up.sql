-- Autopilot & Trading Automation Tables

-- Autopilot Proposals (trading proposals awaiting approval)
CREATE TABLE IF NOT EXISTS autopilot_proposals (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  account_id INTEGER NOT NULL,
  strategy_name VARCHAR(100) NOT NULL,
  contract_id VARCHAR(50),
  symbol VARCHAR(20),
  side VARCHAR(10) NOT NULL CHECK (side IN ('buy', 'sell', 'long', 'short')),
  size INTEGER NOT NULL,
  order_type VARCHAR(20) NOT NULL,
  entry_price DECIMAL(15, 6),
  limit_price DECIMAL(15, 6),
  stop_price DECIMAL(15, 6),
  stop_loss_ticks INTEGER,
  take_profit_ticks INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'expired', 'executed', 'failed')),
  risk_metrics JSONB,
  reasoning TEXT,
  expires_at TIMESTAMP,
  executed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_autopilot_proposals_user ON autopilot_proposals(user_id, created_at DESC);
CREATE INDEX idx_autopilot_proposals_status ON autopilot_proposals(status, created_at DESC);
CREATE INDEX idx_autopilot_proposals_account ON autopilot_proposals(account_id);
CREATE INDEX idx_autopilot_proposals_expires ON autopilot_proposals(expires_at) WHERE expires_at IS NOT NULL;

-- Autopilot Executions (executed autopilot trades)
CREATE TABLE IF NOT EXISTS autopilot_executions (
  id SERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES autopilot_proposals(id) ON DELETE SET NULL,
  user_id VARCHAR(255) NOT NULL,
  account_id INTEGER NOT NULL,
  projectx_order_id INTEGER,
  contract_id VARCHAR(50),
  symbol VARCHAR(20),
  side VARCHAR(10) NOT NULL,
  size INTEGER NOT NULL,
  execution_price DECIMAL(15, 6),
  execution_timestamp TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'executed' CHECK (status IN ('executed', 'partial_fill', 'failed', 'cancelled')),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_autopilot_executions_user ON autopilot_executions(user_id, created_at DESC);
CREATE INDEX idx_autopilot_executions_proposal ON autopilot_executions(proposal_id);
CREATE INDEX idx_autopilot_executions_account ON autopilot_executions(account_id);
CREATE INDEX idx_autopilot_executions_status ON autopilot_executions(status);

-- Autopilot Settings (user autopilot preferences)
CREATE TABLE IF NOT EXISTS autopilot_settings (
  user_id VARCHAR(255) PRIMARY KEY,
  enabled BOOLEAN DEFAULT false,
  daily_loss_limit DECIMAL(15, 2),
  max_position_size INTEGER,
  default_order_type VARCHAR(20) DEFAULT 'limit',
  require_stop_loss BOOLEAN DEFAULT true,
  strategy_enabled JSONB DEFAULT '{}',
  position_sizing_method VARCHAR(20) DEFAULT 'fixed',
  position_sizing_value DECIMAL(15, 2),
  risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high')),
  selected_instrument VARCHAR(50),
  primary_instrument VARCHAR(50),
  correlated_pair_symbol VARCHAR(50),
  rsi_overbought_threshold INTEGER DEFAULT 85,
  rsi_oversold_threshold INTEGER DEFAULT 17,
  semi_autopilot_window JSONB,
  full_autopilot_window JSONB,
  placeholder_window_3 JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_autopilot_settings_enabled ON autopilot_settings(enabled) WHERE enabled = true;

-- Autopilot Anti-Lag Events (anti-lag detection events for analysis/learning)
CREATE TABLE IF NOT EXISTS autopilot_anti_lag_events (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  primary_symbol VARCHAR(20) NOT NULL,
  correlated_symbol VARCHAR(20) NOT NULL,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('anti_lag', 'contra_anti_lag')),
  tick_rate_primary DECIMAL(10, 2),
  tick_rate_correlated DECIMAL(10, 2),
  tick_rate_increase_primary DECIMAL(5, 2),
  tick_rate_increase_correlated DECIMAL(5, 2),
  candle_ticks_primary INTEGER,
  confirmed BOOLEAN DEFAULT false,
  detected_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

CREATE INDEX idx_autopilot_anti_lag_user ON autopilot_anti_lag_events(user_id, detected_at DESC);
CREATE INDEX idx_autopilot_anti_lag_confirmed ON autopilot_anti_lag_events(confirmed, detected_at DESC);

-- Autopilot Test Tables (for isolated testing)
CREATE TABLE IF NOT EXISTS autopilot_proposals_test (
  LIKE autopilot_proposals INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS autopilot_executions_test (
  LIKE autopilot_executions INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS autopilot_settings_test (
  LIKE autopilot_settings INCLUDING ALL
);

CREATE TABLE IF NOT EXISTS autopilot_anti_lag_events_test (
  LIKE autopilot_anti_lag_events INCLUDING ALL
);
