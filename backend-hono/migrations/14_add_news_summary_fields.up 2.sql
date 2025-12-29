-- Add summary and other missing fields to news_articles table
ALTER TABLE news_articles
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS iv_impact DECIMAL(3,2),
  ADD COLUMN IF NOT EXISTS symbols TEXT[],
  ADD COLUMN IF NOT EXISTS is_breaking BOOLEAN DEFAULT FALSE;

-- Create index on is_breaking for breaking news queries
CREATE INDEX IF NOT EXISTS idx_news_is_breaking ON news_articles(is_breaking, published_at DESC);

-- Create index on symbols for symbol filtering
CREATE INDEX IF NOT EXISTS idx_news_symbols ON news_articles USING GIN(symbols);
