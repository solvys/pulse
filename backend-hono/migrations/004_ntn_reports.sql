CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS ntn_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR(255) NOT NULL,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  report_type VARCHAR(50) NOT NULL DEFAULT 'daily',
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  model VARCHAR(50),
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ntn_reports_user_type_date
  ON ntn_reports (user_id, report_type, report_date);

CREATE INDEX IF NOT EXISTS idx_ntn_reports_generated_at
  ON ntn_reports (generated_at DESC);
