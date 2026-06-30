-- ============================================================
-- Migration 022: Driver Release Log
--
-- Supports releasing a driver from an active transfer (e.g. driver became
-- sick / unavailable after being assigned at the TPA gate, before the
-- vehicle was received at the ICDV yard).
--
-- Because `transfers.vehicle_id` carries a UNIQUE constraint (one transfer
-- row per vehicle, ever), the original transfer row cannot simply be left
-- in a 'cancelled' state and a fresh one inserted later — the unique key
-- would block it. So a release DELETES the original transfer row (and
-- closes the driver_assignment) after first preserving full audit detail
-- here in driver_releases, then reverts the vehicle to 'batched' so it can
-- re-enter the transfer flow with a new driver.
-- ============================================================

CREATE TABLE IF NOT EXISTS `driver_releases` (
  `release_id`        INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `icdv_id`            INT UNSIGNED    NOT NULL,
  `vehicle_id`         INT UNSIGNED    NOT NULL,
  `chassis_number`     VARCHAR(50)     NOT NULL COMMENT 'Denormalized for quick reference even if the vehicle changes later',
  `original_driver_id` INT UNSIGNED    NOT NULL,
  `original_transfer_id` INT UNSIGNED  NOT NULL COMMENT 'transfer_id that was cancelled/deleted as part of this release',
  `reason`             TEXT            NOT NULL,
  `released_by`        INT UNSIGNED    NOT NULL,
  `released_at`        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`release_id`),
  INDEX `idx_dr_vehicle` (`vehicle_id`),
  INDEX `idx_dr_driver`  (`original_driver_id`),
  INDEX `idx_dr_icdv`    (`icdv_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Extend the vehicle_operations audit log to recognize this new action type
ALTER TABLE `vehicle_operations`
  MODIFY COLUMN `operation_type` ENUM(
    'manifested','discharged','batched',
    'transferred','received','status_change','note',
    'driver_released'
  ) NOT NULL;
