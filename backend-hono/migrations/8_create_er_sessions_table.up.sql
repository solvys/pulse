-- ER Sessions table for storing Emotional Resonance monitoring sessions
CREATE TABLE IF NOT EXISTS er_sessions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255),
  final_score DECIMAL(3, 1) NOT NULL CHECK (final_score >= 0 AND final_score <= 10),
  time_in_tilt_seconds INTEGER NOT NULL DEFAULT 0,
  infraction_count INTEGER NOT NULL DEFAULT 0,
  session_duration_seconds INTEGER NOT NULL,
  max_tilt_score DECIMAL(3, 1),
  max_tilt_time INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_er_sessions_user ON er_sessions(user_id);
CREATE INDEX idx_er_sessions_created ON er_sessions(created_at DESC);
