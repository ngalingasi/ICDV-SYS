-- ============================================================
-- Migration 024: Vehicle Destination Type (LOCAL vs TRANSIT)
--
-- Classifies every vehicle's `destination` code (e.g. TZDAR, ZMLUN,
-- CDFBM, MWLLW, ZWHRE — from the manifest CSV "Place of Destination"
-- column) into one of:
--
--   local   — destination = 'TZDAR' (Dar es Salaam — stays in Tanzania)
--   transit — any other non-empty destination code (cargo passing
--             through the ICDV to another country, e.g. Zambia,
--             DRC, Malawi, Zimbabwe)
--   NULL    — no destination recorded on the vehicle yet
--
-- Implemented as a STORED GENERATED column so it's always in sync
-- with `destination` automatically — no application code needs to
-- set it on INSERT/UPDATE, and it's included for free everywhere a
-- query already does `v.*` (vehicle list, vehicle detail, discharge/
-- batch lookups, etc). Queries that select specific `v.destination`
-- columns still need `v.destination_type` added alongside it.
-- ============================================================

-- NOTE: production does not support "IF NOT EXISTS" on ADD COLUMN / ADD INDEX,
-- so this migration uses plain syntax. If you re-run it, drop the column first
-- (ALTER TABLE `vehicles` DROP COLUMN `destination_type`) or it will error with
-- "Duplicate column name".

ALTER TABLE `vehicles`
  ADD COLUMN `destination_type`
    VARCHAR(10)
    GENERATED ALWAYS AS (
      CASE
        WHEN `destination` IS NULL OR TRIM(`destination`) = '' THEN NULL
        WHEN UPPER(TRIM(`destination`)) = 'TZDAR' THEN 'local'
        ELSE 'transit'
      END
    ) STORED
    COMMENT 'Derived from destination: local (TZDAR) or transit (any other code)'
    AFTER `destination`;

ALTER TABLE `vehicles`
  ADD INDEX `idx_vehicles_destination_type` (`destination_type`);
