-- Add macro level and Price Brain Layer scoring fields to news_articles
ALTER TABLE news_articles
  ADD COLUMN IF NOT EXISTS macro_level INTEGER CHECK (macro_level IN (1, 2, 3, 4)),
  ADD COLUMN IF NOT EXISTS content TEXT,
  ADD COLUMN IF NOT EXISTS price_brain_sentiment VARCHAR(20) CHECK (price_brain_sentiment IN ('Bullish', 'Bearish', 'Neutral')),
  ADD COLUMN IF NOT EXISTS price_brain_classification VARCHAR(20) CHECK (price_brain_classification IN ('Cyclical', 'Counter-cyclical', 'Neutral')),
  ADD COLUMN IF NOT EXISTS implied_points DECIMAL(10, 2),
  ADD COLUMN IF NOT EXISTS instrument VARCHAR(20),
  ADD COLUMN IF NOT EXISTS author_handle VARCHAR(100),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Create unique constraint on URL if it doesn't exist (for ON CONFLICT)
-- Only apply to non-null URLs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'news_articles_url_unique'
  ) THEN
    -- Create partial unique index for non-null URLs only
    CREATE UNIQUE INDEX IF NOT EXISTS news_articles_url_unique ON news_articles(url) WHERE url IS NOT NULL;
  END IF;
END $$;

-- Create index on macro_level for faster filtering
CREATE INDEX IF NOT EXISTS idx_news_macro_level ON news_articles(macro_level DESC, published_at DESC);

-- Create index on price_brain fields
CREATE INDEX IF NOT EXISTS idx_news_price_brain ON news_articles(price_brain_sentiment, price_brain_classification);
