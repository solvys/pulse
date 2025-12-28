-- Rollback news scoring fields

ALTER TABLE news_articles
  DROP COLUMN IF EXISTS macro_level,
  DROP COLUMN IF EXISTS price_brain_sentiment,
  DROP COLUMN IF EXISTS price_brain_classification,
  DROP COLUMN IF EXISTS price_brain_implied_points,
  DROP COLUMN IF EXISTS price_brain_instrument,
  DROP COLUMN IF EXISTS price_brain_confidence,
  DROP COLUMN IF EXISTS polymarket_update_id;

DROP INDEX IF EXISTS idx_news_macro_level;
DROP INDEX IF EXISTS idx_news_price_brain_sentiment;
