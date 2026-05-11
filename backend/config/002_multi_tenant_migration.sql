-- ============================================================
-- MULTI-TENANT MIGRATION — ICDV Platform
-- Run ONCE against your existing database.
-- All changes are safe to re-run (IF NOT EXISTS / column checks).
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. Tenant registry ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS icdvs (
  icdv_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(200) NOT NULL,
  code       VARCHAR(30)  NOT NULL UNIQUE,          -- e.g. "TPA-DSM"
  address    TEXT         NULL,
  phone      VARCHAR(50)  NULL,
  email      VARCHAR(150) NULL,
  logo_path  VARCHAR(500) NULL,
  country    VARCHAR(100) NOT NULL DEFAULT 'Tanzania',
  city       VARCHAR(100) NULL,
  is_active  TINYINT(1)   NOT NULL DEFAULT 1,
  settings   JSON         NULL,
  created_by INT UNSIGNED NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_icdv_created FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  INDEX idx_icdv_code   (code),
  INDEX idx_icdv_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 2. Seed: Default ICDV (all existing data will be assigned here) ───────────
INSERT IGNORE INTO icdvs (icdv_id, name, code, country, city, is_active)
VALUES (1, 'Default ICDV', 'DEFAULT', 'Tanzania', 'Dar es Salaam', 1);

-- ── 3. Extend users.role enum to include super_admin ─────────────────────────
ALTER TABLE users
  MODIFY COLUMN role ENUM('operator','supervisor','admin','super_admin') NOT NULL DEFAULT 'operator';

-- ── 4. Add icdv_id to users ───────────────────────────────────────────────────
-- NULL = Super Admin (not scoped to any ICDV)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS icdv_id INT UNSIGNED NULL AFTER role;

ALTER TABLE users
  ADD CONSTRAINT IF NOT EXISTS fk_users_icdv
    FOREIGN KEY (icdv_id) REFERENCES icdvs(icdv_id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_users_icdv ON users (icdv_id);

-- ── 5. Add icdv_id to vessels ─────────────────────────────────────────────────
ALTER TABLE vessels
  ADD COLUMN IF NOT EXISTS icdv_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER vessel_id;

ALTER TABLE vessels
  ADD CONSTRAINT IF NOT EXISTS fk_vessels_icdv
    FOREIGN KEY (icdv_id) REFERENCES icdvs(icdv_id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_vessels_icdv ON vessels (icdv_id);

-- ── 6. Add icdv_id to manifests ───────────────────────────────────────────────
ALTER TABLE manifests
  ADD COLUMN IF NOT EXISTS icdv_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER manifest_id;

ALTER TABLE manifests
  ADD CONSTRAINT IF NOT EXISTS fk_manifests_icdv
    FOREIGN KEY (icdv_id) REFERENCES icdvs(icdv_id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_manifests_icdv ON manifests (icdv_id);

-- ── 7. Add icdv_id to vehicles ────────────────────────────────────────────────
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS icdv_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER vehicle_id;

ALTER TABLE vehicles
  ADD CONSTRAINT IF NOT EXISTS fk_vehicles_icdv
    FOREIGN KEY (icdv_id) REFERENCES icdvs(icdv_id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_vehicles_icdv ON vehicles (icdv_id);

-- ── 8. Add icdv_id to drivers ─────────────────────────────────────────────────
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS icdv_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER driver_id;

ALTER TABLE drivers
  ADD CONSTRAINT IF NOT EXISTS fk_drivers_icdv
    FOREIGN KEY (icdv_id) REFERENCES icdvs(icdv_id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_drivers_icdv ON drivers (icdv_id);

-- ── 9. Add icdv_id to operations ──────────────────────────────────────────────
ALTER TABLE operations
  ADD COLUMN IF NOT EXISTS icdv_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER operation_id;

ALTER TABLE operations
  ADD CONSTRAINT IF NOT EXISTS fk_operations_icdv
    FOREIGN KEY (icdv_id) REFERENCES icdvs(icdv_id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_operations_icdv ON operations (icdv_id);

-- ── 10. Add icdv_id to deliveries ─────────────────────────────────────────────
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS icdv_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER delivery_id;

ALTER TABLE deliveries
  ADD CONSTRAINT IF NOT EXISTS fk_deliveries_icdv
    FOREIGN KEY (icdv_id) REFERENCES icdvs(icdv_id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_deliveries_icdv ON deliveries (icdv_id);

-- ── 11. Chassis uniqueness: make per-tenant instead of global ─────────────────
-- Only run if you expect different ICDVs to track the same chassis numbers.
-- Comment out if a chassis is globally unique across all tenants.
ALTER TABLE vehicles DROP INDEX IF EXISTS chassis_number;
ALTER TABLE vehicles
  ADD UNIQUE KEY IF NOT EXISTS uq_chassis_per_icdv (icdv_id, chassis_number);

-- ── 12. License number uniqueness: make per-tenant ────────────────────────────
ALTER TABLE drivers DROP INDEX IF EXISTS license_number;
ALTER TABLE drivers
  ADD UNIQUE KEY IF NOT EXISTS uq_license_per_icdv (icdv_id, license_number);

SET FOREIGN_KEY_CHECKS = 1;

-- ── Post-migration: Promote a super admin (run manually once) ─────────────────
-- UPDATE users SET role = 'super_admin', icdv_id = NULL
-- WHERE username = 'your_admin_username' LIMIT 1;
