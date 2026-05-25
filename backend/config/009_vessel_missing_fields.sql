-- ============================================================
-- MIGRATION 009: Add missing columns to vessels table
--
-- Live DB schema has:
--   vessel_id, icdv_id, name, imo_number, notes,
--   status ENUM('active','inactive','decommissioned'),
--   created_by, updated_by, created_at, updated_at,
--   vessel_type, country_of_origin
--
-- Missing columns added here:
--   flag, shipping_line, arrival_date, departure_date,
--   berth_number, port_of_origin
--
-- Status enum extended to include the operational workflow values:
--   expected, arrived, processing, completed, departed
--   (existing values active/inactive/decommissioned preserved)
--
-- Run ONCE. Safe to re-run (IF NOT EXISTS / column checks).
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. Add flag ───────────────────────────────────────────────────────────────
ALTER TABLE vessels
  ADD COLUMN IF NOT EXISTS flag VARCHAR(100) NULL
  AFTER country_of_origin;

-- ── 2. Add shipping_line ──────────────────────────────────────────────────────
ALTER TABLE vessels
  ADD COLUMN IF NOT EXISTS shipping_line VARCHAR(200) NULL
  AFTER flag;

-- ── 3. Add arrival_date ───────────────────────────────────────────────────────
ALTER TABLE vessels
  ADD COLUMN IF NOT EXISTS arrival_date DATE NULL
  AFTER shipping_line;

-- ── 4. Add departure_date ─────────────────────────────────────────────────────
ALTER TABLE vessels
  ADD COLUMN IF NOT EXISTS departure_date DATE NULL
  AFTER arrival_date;

-- ── 5. Add berth_number ───────────────────────────────────────────────────────
ALTER TABLE vessels
  ADD COLUMN IF NOT EXISTS berth_number VARCHAR(50) NULL
  AFTER departure_date;

-- ── 6. Add port_of_origin ─────────────────────────────────────────────────────
ALTER TABLE vessels
  ADD COLUMN IF NOT EXISTS port_of_origin VARCHAR(200) NULL
  AFTER berth_number;

-- ── 7. Extend status ENUM ─────────────────────────────────────────────────────
--   Keeps existing values (active, inactive, decommissioned) so no data loss.
--   Adds operational workflow values used by the vessel lifecycle.
ALTER TABLE vessels
  MODIFY COLUMN status
    ENUM('active','inactive','decommissioned','expected','arrived','processing','completed','departed')
    NOT NULL DEFAULT 'active';

SET FOREIGN_KEY_CHECKS = 1;
