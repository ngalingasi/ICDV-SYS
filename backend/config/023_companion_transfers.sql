-- ============================================================
-- Migration 023: Companion Transfers (Trella / multi-vehicle trips)
--
-- Supports one driver transferring N vehicles in a single trip —
-- e.g. a truck towing one or more Trellas (car-carrying trailers).
--
-- Design:
--   • Every vehicle still gets its own transfers row (unique vehicle_id).
--   • The "truck" row is the PRIMARY (is_primary = 1, companion_transfer_id = NULL).
--   • Each Trella row is a COMPANION (is_primary = 0, companion_transfer_id = primary transfer_id).
--   • All rows share the same driver_id, transferred_at, icdv_id.
--   • Insights / turnaround / reports see each row independently — no changes needed there.
--   • completed_at is set on ALL rows when the driver is received at the yard.
-- ============================================================

ALTER TABLE `transfers`
  ADD COLUMN IF NOT EXISTS `is_primary`            TINYINT(1)   NOT NULL DEFAULT 1
    COMMENT '1 = primary vehicle (truck), 0 = companion (Trella riding with the truck)'
    AFTER `driver_id_card`,
  ADD COLUMN IF NOT EXISTS `companion_transfer_id` INT UNSIGNED     NULL
    COMMENT 'For companion rows: the transfer_id of the primary (truck) transfer'
    AFTER `is_primary`,
  ADD INDEX IF NOT EXISTS `idx_transfer_companion` (`companion_transfer_id`);
