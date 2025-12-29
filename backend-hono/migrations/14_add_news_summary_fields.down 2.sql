-- Rollback: Remove summary and other fields from news_articles table
ALTER TABLE news_articles
  DROP COLUMN IF EXISTS summary,
  DROP COLUMN IF EXISTS iv_impact,
  DROP COLUMN IF EXISTS symbols,
  DROP COLUMN IF EXISTS is_breaking;

-- Drop indexes
DROP INDEX IF EXISTS idx_news_is_breaking;
DROP INDEX IF EXISTS idx_news_symbols;
