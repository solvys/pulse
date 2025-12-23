CREATE TABLE IF NOT EXISTS econ_daily_plan (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  plan TEXT NOT NULL,
  events_json JSONB,
  source VARCHAR(50) NOT NULL DEFAULT 'tradingview_screenshot',
  timezone VARCHAR(50),
  region VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_econ_user_date ON econ_daily_plan(user_id, date);
CREATE INDEX idx_econ_updated ON econ_daily_plan(updated_at);
