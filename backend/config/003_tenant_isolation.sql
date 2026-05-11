-- ============================================================
-- MIGRATION 003: Tenant Isolation & Multi-Tenant Hardening
-- Run ONCE against your database (safe to re-run).
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ── Ensure icdv_id columns exist on all tenant tables ────────────────────────
-- (These are no-ops if columns already exist from migration 002)

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS icdv_id INT UNSIGNED NULL AFTER role;

ALTER TABLE vessels
  ADD COLUMN IF NOT EXISTS icdv_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER vessel_id;

ALTER TABLE manifests
  ADD COLUMN IF NOT EXISTS icdv_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER manifest_id;

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS icdv_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER vehicle_id;

ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS icdv_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER driver_id;

ALTER TABLE operations
  ADD COLUMN IF NOT EXISTS icdv_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER operation_id;

ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS icdv_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER delivery_id;

-- ── Ensure role enum includes all roles ───────────────────────────────────────
ALTER TABLE users
  MODIFY COLUMN role ENUM('operator','supervisor','admin','super_admin') NOT NULL DEFAULT 'operator';

-- ── Foreign key constraints (idempotent) ─────────────────────────────────────
ALTER TABLE users
  ADD CONSTRAINT IF NOT EXISTS fk_users_icdv
    FOREIGN KEY (icdv_id) REFERENCES icdvs(icdv_id) ON DELETE RESTRICT;

ALTER TABLE vessels
  ADD CONSTRAINT IF NOT EXISTS fk_vessels_icdv
    FOREIGN KEY (icdv_id) REFERENCES icdvs(icdv_id) ON DELETE RESTRICT;

ALTER TABLE manifests
  ADD CONSTRAINT IF NOT EXISTS fk_manifests_icdv
    FOREIGN KEY (icdv_id) REFERENCES icdvs(icdv_id) ON DELETE RESTRICT;

ALTER TABLE vehicles
  ADD CONSTRAINT IF NOT EXISTS fk_vehicles_icdv
    FOREIGN KEY (icdv_id) REFERENCES icdvs(icdv_id) ON DELETE RESTRICT;

ALTER TABLE drivers
  ADD CONSTRAINT IF NOT EXISTS fk_drivers_icdv
    FOREIGN KEY (icdv_id) REFERENCES icdvs(icdv_id) ON DELETE RESTRICT;

ALTER TABLE operations
  ADD CONSTRAINT IF NOT EXISTS fk_operations_icdv
    FOREIGN KEY (icdv_id) REFERENCES icdvs(icdv_id) ON DELETE RESTRICT;

ALTER TABLE deliveries
  ADD CONSTRAINT IF NOT EXISTS fk_deliveries_icdv
    FOREIGN KEY (icdv_id) REFERENCES icdvs(icdv_id) ON DELETE RESTRICT;

-- ── Indexes for performance ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_icdv      ON users(icdv_id);
CREATE INDEX IF NOT EXISTS idx_vessels_icdv    ON vessels(icdv_id);
CREATE INDEX IF NOT EXISTS idx_manifests_icdv  ON manifests(icdv_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_icdv   ON vehicles(icdv_id);
CREATE INDEX IF NOT EXISTS idx_drivers_icdv    ON drivers(icdv_id);
CREATE INDEX IF NOT EXISTS idx_operations_icdv ON operations(icdv_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_icdv ON deliveries(icdv_id);

-- ── Composite unique keys: per-tenant uniqueness ──────────────────────────────
-- Chassis unique per tenant (not globally)
ALTER TABLE vehicles DROP INDEX IF EXISTS chassis_number;
ALTER TABLE vehicles
  ADD UNIQUE KEY IF NOT EXISTS uq_chassis_per_icdv (icdv_id, chassis_number);

-- License unique per tenant
ALTER TABLE drivers DROP INDEX IF EXISTS license_number;
ALTER TABLE drivers
  ADD UNIQUE KEY IF NOT EXISTS uq_license_per_icdv (icdv_id, license_number);

-- ── Seed: Default ICDV for legacy data ───────────────────────────────────────
INSERT IGNORE INTO icdvs (icdv_id, name, code, country, city, is_active)
VALUES (1, 'Default ICDV', 'DEFAULT', 'Tanzania', 'Dar es Salaam', 1);

-- Assign all orphaned records to default ICDV
UPDATE vessels    SET icdv_id = 1 WHERE icdv_id = 0 OR icdv_id IS NULL;
UPDATE manifests  SET icdv_id = 1 WHERE icdv_id = 0 OR icdv_id IS NULL;
UPDATE vehicles   SET icdv_id = 1 WHERE icdv_id = 0 OR icdv_id IS NULL;
UPDATE drivers    SET icdv_id = 1 WHERE icdv_id = 0 OR icdv_id IS NULL;
UPDATE operations SET icdv_id = 1 WHERE icdv_id = 0 OR icdv_id IS NULL;
UPDATE deliveries SET icdv_id = 1 WHERE icdv_id = 0 OR icdv_id IS NULL;

SET FOREIGN_KEY_CHECKS = 1;

-- ── Post-migration manual steps ───────────────────────────────────────────────
-- 1. Promote your first super admin:
--    UPDATE users SET role='super_admin', icdv_id=NULL WHERE username='your_admin' LIMIT 1;
-- 2. Assign all existing non-super-admin users to an ICDV:
--    UPDATE users SET icdv_id=1 WHERE icdv_id IS NULL AND role != 'super_admin';
