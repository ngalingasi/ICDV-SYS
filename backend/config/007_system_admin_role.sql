-- ============================================================
-- MIGRATION 007: system_admin role
-- Platform-level operational user with no fixed icdv_id.
-- Can perform workflow operations for any ICDV via chassis resolution.
-- Run ONCE. Safe on existing data.
-- ============================================================

ALTER TABLE users
  MODIFY COLUMN role
    ENUM('operator', 'supervisor', 'admin', 'super_admin', 'system_admin')
    NOT NULL DEFAULT 'operator';

-- Promote a user to system_admin (run manually as needed):
-- UPDATE users SET role = 'system_admin', icdv_id = NULL
-- WHERE username = 'system_ops' LIMIT 1;
