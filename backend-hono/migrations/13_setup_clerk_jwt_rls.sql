-- ============================================
-- Clerk JWT Authentication Setup for Neon RLS
-- ============================================
-- This migration configures Neon to accept Clerk JWTs and sets up RLS policies

-- Step 1: Configure JWT authentication
-- Set the JWKS endpoint for Clerk
ALTER DATABASE neondb SET app.settings.jwt_secret = 'https://clerk.solvys.io/.well-known/jwks.json';

-- Step 2: Create function to extract user_id from JWT
-- This function extracts the 'sub' claim from the JWT token (Clerk user ID)
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('request.jwt.claims', true)::json->>'sub';
END;
$$ LANGUAGE plpgsql STABLE;

-- Step 3: Create RLS policies for all tables with user_id columns

-- Broker accounts
DROP POLICY IF EXISTS user_own_broker_accounts ON broker_accounts;
CREATE POLICY user_own_broker_accounts ON broker_accounts
  FOR ALL
  USING (user_id = current_user_id());

-- Trades
DROP POLICY IF EXISTS user_own_trades ON trades;
CREATE POLICY user_own_trades ON trades
  FOR ALL
  USING (user_id = current_user_id());

-- AI Conversations
DROP POLICY IF EXISTS user_own_ai_conversations ON ai_conversations;
CREATE POLICY user_own_ai_conversations ON ai_conversations
  FOR ALL
  USING (user_id = current_user_id());

-- AI Messages
DROP POLICY IF EXISTS user_own_ai_messages ON ai_messages;
CREATE POLICY user_own_ai_messages ON ai_messages
  FOR ALL
  USING (user_id = current_user_id());

-- News Articles
DROP POLICY IF EXISTS user_own_news_articles ON news_articles;
CREATE POLICY user_own_news_articles ON news_articles
  FOR ALL
  USING (user_id = current_user_id());

-- ER Sessions
DROP POLICY IF EXISTS user_own_er_sessions ON er_sessions;
CREATE POLICY user_own_er_sessions ON er_sessions
  FOR ALL
  USING (user_id = current_user_id());

-- Autopilot Settings
DROP POLICY IF EXISTS user_own_autopilot_settings ON autopilot_settings;
CREATE POLICY user_own_autopilot_settings ON autopilot_settings
  FOR ALL
  USING (user_id = current_user_id());

-- Autopilot Proposals
DROP POLICY IF EXISTS user_own_autopilot_proposals ON autopilot_proposals;
CREATE POLICY user_own_autopilot_proposals ON autopilot_proposals
  FOR ALL
  USING (user_id = current_user_id());

-- Autopilot Executions
DROP POLICY IF EXISTS user_own_autopilot_executions ON autopilot_executions;
CREATE POLICY user_own_autopilot_executions ON autopilot_executions
  FOR ALL
  USING (user_id = current_user_id());

-- Threat History
DROP POLICY IF EXISTS user_own_threat_history ON threat_history;
CREATE POLICY user_own_threat_history ON threat_history
  FOR ALL
  USING (user_id = current_user_id());

-- Blind Spots
DROP POLICY IF EXISTS user_own_blind_spots ON blind_spots;
CREATE POLICY user_own_blind_spots ON blind_spots
  FOR ALL
  USING (user_id = current_user_id());

-- User Billing (if exists)
DROP POLICY IF EXISTS user_own_user_billing ON user_billing;
CREATE POLICY user_own_user_billing ON user_billing
  FOR ALL
  USING (user_id = current_user_id());

-- Users table (if exists)
DROP POLICY IF EXISTS user_own_users ON users;
CREATE POLICY user_own_users ON users
  FOR ALL
  USING (clerk_user_id = current_user_id());

COMMIT;
