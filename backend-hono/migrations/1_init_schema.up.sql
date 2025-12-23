-- Core tables for Pulse API

-- User ProjectX credentials
CREATE TABLE IF NOT EXISTS projectx_credentials (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL UNIQUE,
  username VARCHAR(255) NOT NULL,
  api_key VARCHAR(512) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_projectx_credentials_user ON projectx_credentials(user_id);

-- Broker accounts
CREATE TABLE IF NOT EXISTS broker_accounts (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  account_id VARCHAR(255) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  account_type VARCHAR(50),
  balance DECIMAL(15, 2) DEFAULT 0,
  equity DECIMAL(15, 2) DEFAULT 0,
  margin_used DECIMAL(15, 2) DEFAULT 0,
  buying_power DECIMAL(15, 2) DEFAULT 0,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, account_id)
);

CREATE INDEX idx_broker_accounts_user ON broker_accounts(user_id);

-- Contracts
CREATE TABLE IF NOT EXISTS contracts (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  description TEXT,
  tick_size DECIMAL(10, 6) NOT NULL DEFAULT 0.25,
  tick_value DECIMAL(10, 2) NOT NULL DEFAULT 5.00,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_contracts_symbol ON contracts(symbol);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  account_id INTEGER NOT NULL,
  contract_id VARCHAR(50),
  symbol VARCHAR(20),
  side VARCHAR(10) NOT NULL,
  order_type VARCHAR(20) NOT NULL,
  size INTEGER NOT NULL,
  limit_price DECIMAL(15, 6),
  stop_price DECIMAL(15, 6),
  status VARCHAR(20) DEFAULT 'pending',
  filled_size INTEGER DEFAULT 0,
  avg_fill_price DECIMAL(15, 6),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_account ON orders(account_id);

-- Trades
CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  account_id INTEGER NOT NULL,
  contract_id VARCHAR(50),
  symbol VARCHAR(20),
  side VARCHAR(10) NOT NULL,
  size INTEGER NOT NULL,
  entry_price DECIMAL(15, 6),
  exit_price DECIMAL(15, 6),
  pnl DECIMAL(15, 2),
  opened_at TIMESTAMP NOT NULL,
  closed_at TIMESTAMP,
  strategy VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_trades_user ON trades(user_id);
CREATE INDEX idx_trades_opened ON trades(opened_at);

-- Market bars
CREATE TABLE IF NOT EXISTS market_bars (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(20) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  open DECIMAL(15, 6) NOT NULL,
  high DECIMAL(15, 6) NOT NULL,
  low DECIMAL(15, 6) NOT NULL,
  close DECIMAL(15, 6) NOT NULL,
  volume BIGINT DEFAULT 0,
  UNIQUE(symbol, unit, timestamp)
);

CREATE INDEX idx_market_bars_symbol_unit ON market_bars(symbol, unit, timestamp DESC);

-- Market indicators (VIX, etc.)
CREATE TABLE IF NOT EXISTS market_indicators (
  id SERIAL PRIMARY KEY,
  indicator VARCHAR(50) NOT NULL,
  value DECIMAL(15, 6) NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_market_indicators ON market_indicators(indicator, timestamp DESC);

-- News articles
CREATE TABLE IF NOT EXISTS news_articles (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  source VARCHAR(100),
  url TEXT,
  published_at TIMESTAMP,
  sentiment VARCHAR(20),
  iv_impact DECIMAL(5, 2),
  symbols TEXT[],
  is_breaking BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_news_published ON news_articles(published_at DESC);

-- System events
CREATE TABLE IF NOT EXISTS system_events (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'info',
  title VARCHAR(255) NOT NULL,
  message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_system_events_user ON system_events(user_id, created_at DESC);
