-- Admin Annotations Table
-- Stores corrections and comments from admins on AI responses, news, and IV scores
-- Used for RAG-based learning to improve AI quality

CREATE TABLE IF NOT EXISTS admin_annotations (
  id SERIAL PRIMARY KEY,
  admin_user_id TEXT NOT NULL,
  target_type TEXT NOT NULL, -- 'ai_message', 'news_article', 'iv_score'
  target_id TEXT NOT NULL,
  selected_text TEXT,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for efficient lookup by target
CREATE INDEX IF NOT EXISTS idx_admin_annotations_target ON admin_annotations(target_type, target_id);

-- Index for admin user queries
CREATE INDEX IF NOT EXISTS idx_admin_annotations_user ON admin_annotations(admin_user_id);

-- Index for recent annotations (used in RAG context)
CREATE INDEX IF NOT EXISTS idx_admin_annotations_created ON admin_annotations(created_at DESC);
