-- Add Price Brain Layer scoring fields to news_articles table

ALTER TABLE news_articles
  ADD COLUMN IF NOT EXISTS macro_level INTEGER CHECK (macro_level IN (1, 2, 3, 4)),
  ADD COLUMN IF NOT EXISTS price_brain_sentiment VARCHAR(20) CHECK (price_brain_sentiment IN ('Bullish', 'Bearish', 'Neutral')),
  ADD COLUMN IF NOT EXISTS price_brain_classification VARCHAR(20) CHECK (price_brain_classification IN ('Cyclical', 'Counter-cyclical', 'Neutral')),
  ADD COLUMN IF NOT EXISTS price_brain_implied_points DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS price_brain_instrument VARCHAR(20),
  ADD COLUMN IF NOT EXISTS price_brain_confidence DECIMAL(3, 2) CHECK (price_brain_confidence >= 0 AND price_brain_confidence <= 1),
  ADD COLUMN IF NOT EXISTS polymarket_update_id INTEGER REFERENCES polymarket_updates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_news_macro_level ON news_articles(macro_level);
CREATE INDEX IF NOT EXISTS idx_news_price_brain_sentiment ON news_articles(price_brain_sentiment);
