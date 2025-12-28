-- Rollback admin annotations table
DROP INDEX IF EXISTS idx_admin_annotations_created;
DROP INDEX IF EXISTS idx_admin_annotations_user;
DROP INDEX IF EXISTS idx_admin_annotations_target;
DROP TABLE IF EXISTS admin_annotations;
