-- Migration 006: Trading Proposals table for AutoPilot workflow
-- Enables proposal persistence and lifecycle tracking

-- Trading proposals table
CREATE TABLE IF NOT EXISTS trading_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  
  -- Strategy info
  strategy_name VARCHAR(100) NOT NULL,
  instrument VARCHAR(10) NOT NULL DEFAULT 'MNQ',
  
  -- Trade details
  direction VARCHAR(10) NOT NULL, -- 'long', 'short', 'flat'
  entry_price DECIMAL(10,2),
  stop_loss DECIMAL(10,2),
  take_profit JSONB DEFAULT '[]'::jsonb, -- Array of take profit levels
  position_size INTEGER DEFAULT 1,
  risk_reward_ratio DECIMAL(4,2),
  
  -- AI reasoning
  confidence_score DECIMAL(3,2),
  rationale TEXT,
  agent_reports JSONB, -- References to agent report IDs
  debate_id UUID REFERENCES researcher_debates(id),
  analyst_inputs JSONB, -- Summarized analyst inputs
  
  -- Setup info
  timeframe VARCHAR(50),
  setup_type VARCHAR(100),
  
  -- Workflow status
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected, executed, expired, cancelled
  
  -- Timestamps
  expires_at TIMESTAMP WITH TIME ZONE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  executed_at TIMESTAMP WITH TIME ZONE,
  
  -- Execution result
  execution_result JSONB,
  projectx_order_id VARCHAR(255),
  
  -- Risk assessment reference
  risk_assessment_id UUID REFERENCES risk_assessments(id),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_proposals_user_status ON trading_proposals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON trading_proposals(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_proposals_expires ON trading_proposals(expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_proposals_created ON trading_proposals(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_proposal_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic updated_at
DROP TRIGGER IF EXISTS trigger_proposal_updated ON trading_proposals;
CREATE TRIGGER trigger_proposal_updated
  BEFORE UPDATE ON trading_proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_proposal_timestamp();

-- Execution log for tracking all order attempts
CREATE TABLE IF NOT EXISTS execution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES trading_proposals(id),
  user_id VARCHAR(255) NOT NULL,
  
  -- Order details
  order_type VARCHAR(50) NOT NULL, -- 'bracket', 'limit', 'market'
  order_status VARCHAR(50) NOT NULL, -- 'pending', 'sent', 'filled', 'partial', 'rejected', 'cancelled'
  
  -- ProjectX data
  projectx_order_id VARCHAR(255),
  projectx_response JSONB,
  
  -- Fill details
  fill_price DECIMAL(10,2),
  filled_quantity INTEGER,
  
  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_execution_log_proposal ON execution_log(proposal_id);
CREATE INDEX IF NOT EXISTS idx_execution_log_user ON execution_log(user_id);
CREATE INDEX IF NOT EXISTS idx_execution_log_status ON execution_log(order_status);
