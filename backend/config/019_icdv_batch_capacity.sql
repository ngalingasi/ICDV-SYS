-- ============================================================
-- Migration 019: Per-ICDV Batch Capacity
--
-- Previously the "max vehicles per batch before it's full" limit was a
-- single hardcoded value (20) applied to every ICDV. Some ICDVs need a
-- different limit (e.g. 25). This becomes a per-ICDV setting, editable
-- only by super_admin via ICDV management. Default stays 20.
-- ============================================================

ALTER TABLE `icdvs`
  ADD COLUMN IF NOT EXISTS `batch_capacity` INT UNSIGNED NOT NULL DEFAULT 20
    COMMENT 'Max vehicles per batch before it is marked full — super_admin editable, default 20'
    AFTER `vrn`;
