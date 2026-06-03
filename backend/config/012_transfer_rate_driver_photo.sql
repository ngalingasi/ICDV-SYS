-- ============================================================
-- MIGRATION 012: Transfer Rate + Driver Photo
--
-- 1. system_settings — one-row table for global settings
--    (transfer_rate stored here as the global default)
-- 2. manifests.transfer_rate — per-manifest override, seeded
--    from global rate at creation time
-- 3. drivers.photo — nullable path for profile photo
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. system_settings ───────────────────────────────────────────────────────
-- Keyed settings table. Only one row per key.
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key     VARCHAR(100)    NOT NULL PRIMARY KEY,
  setting_value   TEXT            NULL,
  label           VARCHAR(200)    NULL,
  updated_by      INT(11)         NULL,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Seed default transfer rate (0 = not set yet, admin must configure)
INSERT IGNORE INTO system_settings (setting_key, setting_value, label)
VALUES ('transfer_rate', '0', 'Default transfer rate per vehicle (currency units)');

-- ── 2. manifests.transfer_rate ────────────────────────────────────────────────
ALTER TABLE manifests
  ADD COLUMN IF NOT EXISTS transfer_rate DECIMAL(12,2) NOT NULL DEFAULT 0.00
  COMMENT 'Per-vehicle transfer rate for this manifest. Seeded from global default, can be overridden.';

-- ── 3. drivers.photo ─────────────────────────────────────────────────────────
ALTER TABLE drivers
  ADD COLUMN IF NOT EXISTS photo VARCHAR(500) NULL
  COMMENT 'Relative path to driver profile photo';

SET FOREIGN_KEY_CHECKS = 1;
