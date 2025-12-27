-- AI Integration & Chat System Tables

-- AI Conversations (chat threads)
CREATE TABLE IF NOT EXISTS ai_conversations (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ai_conversations_user ON ai_conversations(user_id);
CREATE INDEX idx_ai_conversations_updated ON ai_conversations(updated_at DESC);

-- AI Messages (individual chat messages)
CREATE TABLE IF NOT EXISTS ai_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
);

CREATE INDEX idx_ai_messages_conversation ON ai_messages(conversation_id, created_at);
CREATE INDEX idx_ai_messages_created ON ai_messages(created_at DESC);

-- IV Scores (time-series scoring data with symbol support)
CREATE TABLE IF NOT EXISTS iv_scores (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  symbol VARCHAR(20),
  score DECIMAL(3, 1) NOT NULL CHECK (score >= 1 AND score <= 10),
  level VARCHAR(20) NOT NULL CHECK (level IN ('low', 'medium', 'high', 'good')),
  vix DECIMAL(8, 2),
  implied_points DECIMAL(10, 2),
  color VARCHAR(20),
  confidence DECIMAL(3, 2),
  factors JSONB,
  recommendation TEXT,
  instrument VARCHAR(50),
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_iv_scores_user_symbol ON iv_scores(user_id, symbol, timestamp DESC);
CREATE INDEX idx_iv_scores_timestamp ON iv_scores(timestamp DESC);
CREATE INDEX idx_iv_scores_symbol ON iv_scores(symbol, timestamp DESC);

-- Threat History (trading threats and patterns)
CREATE TABLE IF NOT EXISTS threat_history (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('overtrading', 'emotional', 'consecutive_losses')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_threat_history_user ON threat_history(user_id, created_at DESC);
CREATE INDEX idx_threat_history_severity ON threat_history(severity, created_at DESC);
CREATE INDEX idx_threat_history_type ON threat_history(type, created_at DESC);

-- Blind Spots (user blind spots - AI-determined and custom)
CREATE TABLE IF NOT EXISTS blind_spots (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  is_guard_railed BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  category VARCHAR(50) CHECK (category IN ('behavioral', 'risk', 'execution', 'custom')),
  source VARCHAR(20) CHECK (source IN ('ai', 'user')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_blind_spots_user ON blind_spots(user_id, is_active);
CREATE INDEX idx_blind_spots_category ON blind_spots(category);
CREATE INDEX idx_blind_spots_guard_railed ON blind_spots(is_guard_railed);

-- Pulse Analysis Cache (quick pulse analysis results)
CREATE TABLE IF NOT EXISTS pulse_analysis (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255),
  analysis JSONB NOT NULL,
  screenshot_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_pulse_analysis_user ON pulse_analysis(user_id, created_at DESC);
CREATE INDEX idx_pulse_analysis_expires ON pulse_analysis(expires_at);

-- Scheduled Events (for news events - extend news_articles or separate table)
CREATE TABLE IF NOT EXISTS scheduled_events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  scheduled_time TIMESTAMP NOT NULL,
  source VARCHAR(100),
  impact VARCHAR(20) NOT NULL CHECK (impact IN ('low', 'medium', 'high')),
  symbols TEXT[],
  is_commentary BOOLEAN DEFAULT false,
  event_type VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_scheduled_events_time ON scheduled_events(scheduled_time);
CREATE INDEX idx_scheduled_events_impact ON scheduled_events(impact, scheduled_time);
CREATE INDEX idx_scheduled_events_symbols ON scheduled_events USING GIN(symbols);
