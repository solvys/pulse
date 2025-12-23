-- Emotional Resonance Scores by hour
CREATE TABLE IF NOT EXISTS emotional_resonance_scores (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  recorded_at DATE NOT NULL,
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour <= 23),
  score DECIMAL(3, 1) NOT NULL CHECK (score >= 0 AND score <= 10),
  label VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, recorded_at, hour)
);

CREATE INDEX idx_er_scores_user_date ON emotional_resonance_scores(user_id, recorded_at);

-- Blindspot Management Ratings by day
CREATE TABLE IF NOT EXISTS blindspot_ratings (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  recorded_at DATE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 0 AND rating <= 10),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, recorded_at)
);

CREATE INDEX idx_blindspot_user_date ON blindspot_ratings(user_id, recorded_at);

-- Add indexes to trades table for journal queries
CREATE INDEX IF NOT EXISTS idx_trades_user_date ON trades(user_id, DATE(opened_at));
CREATE INDEX IF NOT EXISTS idx_trades_user_month ON trades(user_id, EXTRACT(MONTH FROM opened_at), EXTRACT(YEAR FROM opened_at));
