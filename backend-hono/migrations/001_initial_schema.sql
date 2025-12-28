-- Pulse Trading Platform Database Schema
-- Initial migration for all core tables
-- Run this in Neon SQL Editor to set up the database

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- CORE USER MANAGEMENT TABLES
-- ============================================

-- Broker accounts (trading accounts linked to users)
CREATE TABLE broker_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    account_name TEXT,
    account_type TEXT,
    balance DECIMAL(20,8) DEFAULT 0,
    equity DECIMAL(20,8) DEFAULT 0,
    margin_used DECIMAL(20,8) DEFAULT 0,
    buying_power DECIMAL(20,8) DEFAULT 0,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, account_id)
);

-- ============================================
-- TRADING TABLES
-- ============================================

-- Trades (individual trade records)
CREATE TABLE trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    broker_account_id UUID REFERENCES broker_accounts(id),
    order_id TEXT,
    symbol TEXT NOT NULL,
    side TEXT CHECK (side IN ('buy', 'sell')),
    quantity INTEGER NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    commission DECIMAL(20,8) DEFAULT 0,
    realized_pnl DECIMAL(20,8) DEFAULT 0,
    opened_at TIMESTAMP WITH TIME ZONE NOT NULL,
    closed_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
    strategy TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders (trading orders)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    broker_account_id UUID REFERENCES broker_accounts(id),
    order_id TEXT NOT NULL UNIQUE,
    symbol TEXT NOT NULL,
    type TEXT CHECK (type IN ('limit', 'market', 'stop', 'trailing_stop')),
    side TEXT CHECK (side IN ('buy', 'sell')),
    quantity INTEGER NOT NULL,
    limit_price DECIMAL(20,8),
    stop_price DECIMAL(20,8),
    trail_price DECIMAL(20,8),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'filled', 'cancelled', 'rejected')),
    filled_quantity INTEGER DEFAULT 0,
    filled_price DECIMAL(20,8),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- AI CONVERSATION TABLES
-- ============================================

-- AI conversations (chat sessions)
CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    title TEXT,
    model TEXT DEFAULT 'grok-4',
    is_active BOOLEAN DEFAULT true,
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AI messages (individual messages in conversations)
CREATE TABLE ai_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    tokens_used INTEGER,
    model TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- NEWS AND MARKET DATA TABLES
-- ============================================

-- News articles
CREATE TABLE news_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    source TEXT,
    url TEXT,
    sentiment DECIMAL(3,2), -- -1.0 to 1.0
    relevance_score DECIMAL(3,2),
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(url)
);

-- Scheduled events (market events, earnings, etc.)
CREATE TABLE scheduled_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT,
    symbol TEXT,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    impact TEXT CHECK (impact IN ('low', 'medium', 'high')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Market indicators (VIX, etc.)
CREATE TABLE market_indicators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol TEXT NOT NULL,
    indicator_type TEXT NOT NULL,
    value DECIMAL(20,8) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(symbol, indicator_type, timestamp)
);

-- IV Scores (Implied Volatility scores)
CREATE TABLE iv_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    score DECIMAL(5,2) NOT NULL, -- 0.00 to 100.00
    confidence DECIMAL(3,2), -- 0.00 to 1.00
    factors JSONB,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour')
);

-- ============================================
-- PROJECTX INTEGRATION TABLES
-- ============================================

-- ProjectX credentials (encrypted)
CREATE TABLE projectx_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL,
    api_key TEXT NOT NULL, -- This should be encrypted in production
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contracts (trading instruments)
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol TEXT NOT NULL UNIQUE,
    name TEXT,
    type TEXT CHECK (type IN ('future', 'option', 'stock', 'crypto')),
    exchange TEXT,
    tick_size DECIMAL(10,8),
    contract_size INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- EMOTIONAL RESONANCE TABLES
-- ============================================

-- ER Sessions (Emotional Resonance tracking sessions)
CREATE TABLE er_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    session_data JSONB NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_minutes INTEGER,
    stress_level_avg DECIMAL(3,1),
    focus_level_avg DECIMAL(3,1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Emotional resonance scores
CREATE TABLE emotional_resonance_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    score DECIMAL(3,1) NOT NULL, -- 0.0 to 10.0
    factors JSONB,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blind spot ratings
CREATE TABLE blindspot_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    trade_id UUID REFERENCES trades(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- AUTOPILOT TABLES
-- ============================================

-- Autopilot settings
CREATE TABLE autopilot_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT false,
    daily_loss_limit DECIMAL(20,8) DEFAULT 1000,
    max_position_size INTEGER DEFAULT 10,
    default_order_type TEXT DEFAULT 'limit',
    require_stop_loss BOOLEAN DEFAULT true,
    strategy_enabled JSONB DEFAULT '{"trend_following": true, "mean_reversion": false, "scalping": false}',
    position_sizing_method TEXT DEFAULT 'fixed' CHECK (position_sizing_method IN ('fixed', 'percentage', 'kelly')),
    position_sizing_value DECIMAL(10,4) DEFAULT 1.0,
    risk_level TEXT DEFAULT 'moderate' CHECK (risk_level IN ('conservative', 'moderate', 'aggressive')),
    selected_instrument TEXT,
    primary_instrument TEXT,
    correlated_pair_symbol TEXT,
    rsi_overbought_threshold INTEGER DEFAULT 70,
    rsi_oversold_threshold INTEGER DEFAULT 30,
    semi_autopilot_window JSONB DEFAULT '{"start": "09:30", "end": "15:00"}',
    full_autopilot_window JSONB DEFAULT '{"start": "09:30", "end": "15:55"}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Autopilot proposals (suggested trades)
CREATE TABLE autopilot_proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    symbol TEXT NOT NULL,
    side TEXT CHECK (side IN ('buy', 'sell')),
    quantity INTEGER NOT NULL,
    price DECIMAL(20,8),
    order_type TEXT DEFAULT 'limit',
    strategy TEXT NOT NULL,
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00
    reasoning TEXT,
    risk_assessment JSONB,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'executed')),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '5 minutes'),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    executed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Autopilot executions (executed autopilot trades)
CREATE TABLE autopilot_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    proposal_id UUID REFERENCES autopilot_proposals(id),
    order_id TEXT,
    symbol TEXT NOT NULL,
    side TEXT CHECK (side IN ('buy', 'sell')),
    quantity INTEGER NOT NULL,
    executed_price DECIMAL(20,8),
    execution_status TEXT DEFAULT 'pending' CHECK (execution_status IN ('pending', 'executed', 'failed', 'cancelled')),
    error_message TEXT,
    executed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ANALYSIS TABLES
-- ============================================

-- Pulse analysis (quick pulse screenshots and analysis)
CREATE TABLE pulse_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    analysis JSONB NOT NULL,
    screenshot_url TEXT,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Threat history (trading threats and analysis)
CREATE TABLE threat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    threat_type TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    symbol TEXT,
    description TEXT NOT NULL,
    impact_assessment JSONB,
    recommended_actions JSONB,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blind spots (trading blind spots identified by AI)
CREATE TABLE blind_spots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT NOT NULL,
    pattern_type TEXT NOT NULL,
    description TEXT NOT NULL,
    frequency INTEGER DEFAULT 1,
    impact_score DECIMAL(3,2), -- 0.00 to 1.00
    recommendations JSONB,
    is_resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    last_detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SYSTEM TABLES
-- ============================================

-- System events (logging system events, notifications, etc.)
CREATE TABLE system_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT,
    event_type TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    title TEXT NOT NULL,
    message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- User-based indexes
CREATE INDEX idx_broker_accounts_user_id ON broker_accounts(user_id);
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_symbol ON trades(symbol);
CREATE INDEX idx_trades_status ON trades(status);
CREATE INDEX idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX idx_ai_messages_conversation_id ON ai_messages(conversation_id);
CREATE INDEX idx_news_articles_user_id ON news_articles(user_id);
CREATE INDEX idx_scheduled_events_user_id ON scheduled_events(user_id);
CREATE INDEX idx_iv_scores_user_id ON iv_scores(user_id);
CREATE INDEX idx_er_sessions_user_id ON er_sessions(user_id);
CREATE INDEX idx_autopilot_proposals_user_id ON autopilot_proposals(user_id);
CREATE INDEX idx_system_events_user_id ON system_events(user_id);

-- Time-based indexes
CREATE INDEX idx_trades_opened_at ON trades(opened_at);
CREATE INDEX idx_trades_closed_at ON trades(closed_at);
CREATE INDEX idx_iv_scores_expires_at ON iv_scores(expires_at);
CREATE INDEX idx_pulse_analysis_expires_at ON pulse_analysis(expires_at);
CREATE INDEX idx_autopilot_proposals_expires_at ON autopilot_proposals(expires_at);

-- Foreign key indexes
CREATE INDEX idx_trades_broker_account_id ON trades(broker_account_id);
CREATE INDEX idx_orders_broker_account_id ON orders(broker_account_id);
CREATE INDEX idx_autopilot_executions_proposal_id ON autopilot_executions(proposal_id);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Ordered trades view (for ER analysis)
CREATE VIEW ordered_trades AS
SELECT
    id,
    user_id,
    symbol,
    side,
    quantity,
    price,
    opened_at,
    closed_at,
    realized_pnl,
    status
FROM trades
WHERE status = 'closed'
ORDER BY opened_at DESC;

-- ============================================
-- ROW LEVEL SECURITY (Optional - for multi-tenant setup)
-- ============================================

-- Enable RLS on user-specific tables
ALTER TABLE broker_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE er_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE autopilot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE autopilot_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE autopilot_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE blind_spots ENABLE ROW LEVEL SECURITY;

-- Create policies (assuming user_id column identifies the user)
-- Note: You'll need to set up authentication context for these to work
-- CREATE POLICY user_own_data ON broker_accounts FOR ALL USING (user_id = current_user_id());

COMMIT;