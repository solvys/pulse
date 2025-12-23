-- Rollback migration for autopilot tables

-- Remove risk management fields from accounts table
ALTER TABLE accounts DROP COLUMN IF EXISTS max_daily_loss;
ALTER TABLE accounts DROP COLUMN IF EXISTS max_position_size;
ALTER TABLE accounts DROP COLUMN IF EXISTS autopilot_enabled;

-- Drop proposed_actions table and its indexes
DROP INDEX IF EXISTS idx_proposed_actions_created_at;
DROP INDEX IF EXISTS idx_proposed_actions_status;
DROP INDEX IF EXISTS idx_proposed_actions_account_id;
DROP INDEX IF EXISTS idx_proposed_actions_user_id;
DROP TABLE IF EXISTS proposed_actions;