-- Remove macro level and Price Brain Layer scoring fields
ALTER TABLE news_articles
  DROP COLUMN IF EXISTS macro_level,
  DROP COLUMN IF EXISTS content,
  DROP COLUMN IF EXISTS price_brain_sentiment,
  DROP COLUMN IF EXISTS price_brain_classification,
  DROP COLUMN IF EXISTS implied_points,
  DROP COLUMN IF EXISTS instrument,
  DROP COLUMN IF EXISTS author_handle;

DROP INDEX IF EXISTS idx_news_macro_level;
DROP INDEX IF EXISTS idx_news_price_brain;
