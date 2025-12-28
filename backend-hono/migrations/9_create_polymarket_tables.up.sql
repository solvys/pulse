-- Polymarket odds and updates tables

-- Polymarket odds table
CREATE TABLE IF NOT EXISTS polymarket_odds (
  id SERIAL PRIMARY KEY,
  market_id VARCHAR(255) NOT NULL,
  market_type VARCHAR(50) NOT NULL CHECK (market_type IN (
    'rate_cut', 'cpi', 'nfp', 'interest_rate', 
    'jerome_powell', 'donald_trump_tariffs', 'politics', 
    'gdp', 'interest_rate_futures'
  )),
  yes_odds DECIMAL(5, 4) NOT NULL CHECK (yes_odds >= 0 AND yes_odds <= 1),
  no_odds DECIMAL(5, 4) NOT NULL CHECK (no_odds >= 0 AND no_odds <= 1),
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(market_id, timestamp)
);

CREATE INDEX idx_polymarket_odds_type ON polymarket_odds(market_type, timestamp DESC);
CREATE INDEX idx_polymarket_odds_timestamp ON polymarket_odds(timestamp DESC);

-- Polymarket updates table (significant changes)
CREATE TABLE IF NOT EXISTS polymarket_updates (
  id SERIAL PRIMARY KEY,
  market_type VARCHAR(50) NOT NULL CHECK (market_type IN (
    'rate_cut', 'cpi', 'nfp', 'interest_rate',
    'jerome_powell', 'donald_trump_tariffs', 'politics',
    'gdp', 'interest_rate_futures'
  )),
  previous_odds DECIMAL(5, 4) NOT NULL,
  current_odds DECIMAL(5, 4) NOT NULL,
  change_percentage DECIMAL(6, 2) NOT NULL,
  triggered_by_news_id INTEGER REFERENCES news_articles(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_polymarket_updates_type ON polymarket_updates(market_type, created_at DESC);
CREATE INDEX idx_polymarket_updates_news ON polymarket_updates(triggered_by_news_id);
