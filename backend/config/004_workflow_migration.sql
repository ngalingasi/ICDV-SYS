-- ============================================================
-- WORKFLOW MIGRATION — Operational Flow Tables
-- Discharge → Batch → Transfer → Receive
-- Run AFTER migration.sql (domain tables must exist first)
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. Extend vehicles table for workflow tracking ────────────────────────────
-- Add workflow_status (replaces operational_status for the 5-step flow)
-- Add current_location for physical tracking
-- Add batch_id for grouping

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS workflow_status
    ENUM('manifested','discharged','batched','in_transit','received')
    NOT NULL DEFAULT 'manifested' AFTER operational_status;

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS current_location
    ENUM('vessel','holding_ground','tpa_gate','tpa_gate_to_yard','icdv_yard')
    NOT NULL DEFAULT 'vessel' AFTER workflow_status;

ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS batch_id INT UNSIGNED NULL AFTER current_location;

CREATE INDEX IF NOT EXISTS idx_vehicles_workflow  ON vehicles(workflow_status);
CREATE INDEX IF NOT EXISTS idx_vehicles_location  ON vehicles(current_location);
CREATE INDEX IF NOT EXISTS idx_vehicles_batch     ON vehicles(batch_id);

-- ── 2. vehicle_operations — full audit history for every workflow action ───────
CREATE TABLE IF NOT EXISTS vehicle_operations (
  op_id          INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  icdv_id        INT UNSIGNED     NOT NULL,
  vehicle_id     INT UNSIGNED     NOT NULL,
  chassis_number VARCHAR(50)      NOT NULL,
  operation_type ENUM(
    'manifested','discharged','batched',
    'transferred','received','status_change','note'
  )              NOT NULL,
  from_status    VARCHAR(50)      NULL,
  to_status      VARCHAR(50)      NULL,
  from_location  VARCHAR(50)      NULL,
  to_location    VARCHAR(50)      NULL,
  batch_id       INT UNSIGNED     NULL,
  transfer_id    INT UNSIGNED     NULL,
  notes          TEXT             NULL,
  performed_by   INT UNSIGNED     NOT NULL,
  performed_at   DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (op_id),
  INDEX idx_vop_vehicle  (vehicle_id),
  INDEX idx_vop_icdv     (icdv_id),
  INDEX idx_vop_type     (operation_type),
  INDEX idx_vop_chassis  (chassis_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 3. batches ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS batches (
  batch_id       INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  icdv_id        INT UNSIGNED     NOT NULL,
  batch_number   VARCHAR(80)      NOT NULL,       -- e.g. VESSELNAME-20260512-01
  vessel_id      INT UNSIGNED     NOT NULL,
  manifest_id    INT UNSIGNED     NULL,
  batch_date     DATE             NOT NULL,
  vehicle_count  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  max_vehicles   TINYINT UNSIGNED NOT NULL DEFAULT 20,
  status         ENUM('open','closed','transferred') NOT NULL DEFAULT 'open',
  notes          TEXT             NULL,
  created_by     INT UNSIGNED     NOT NULL,
  created_at     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (batch_id),
  UNIQUE KEY uq_batch_number_icdv (icdv_id, batch_number),
  INDEX idx_batch_icdv    (icdv_id),
  INDEX idx_batch_vessel  (vessel_id),
  INDEX idx_batch_date    (batch_date),
  INDEX idx_batch_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 4. transfers ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transfers (
  transfer_id      INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  icdv_id          INT UNSIGNED   NOT NULL,
  vehicle_id       INT UNSIGNED   NOT NULL,
  batch_id         INT UNSIGNED   NULL,
  driver_id        INT UNSIGNED   NOT NULL,
  driver_id_card   VARCHAR(100)   NOT NULL,        -- internal ID card number used at gate
  transferred_by   INT UNSIGNED   NOT NULL,        -- operator who confirmed transfer
  transfer_notes   TEXT           NULL,
  status           ENUM('active','completed','cancelled') NOT NULL DEFAULT 'active',
  transferred_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at     DATETIME       NULL,
  PRIMARY KEY (transfer_id),
  UNIQUE KEY uq_transfer_vehicle (vehicle_id),   -- one active transfer per vehicle
  INDEX idx_transfer_icdv    (icdv_id),
  INDEX idx_transfer_driver  (driver_id),
  INDEX idx_transfer_batch   (batch_id),
  INDEX idx_transfer_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 5. driver_assignments — tracks which driver currently has which vehicle ───
CREATE TABLE IF NOT EXISTS driver_assignments (
  assignment_id  INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  icdv_id        INT UNSIGNED     NOT NULL,
  driver_id      INT UNSIGNED     NOT NULL,
  vehicle_id     INT UNSIGNED     NOT NULL,
  transfer_id    INT UNSIGNED     NULL,
  assigned_by    INT UNSIGNED     NOT NULL,
  assigned_at    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at      DATETIME         NULL,
  status         ENUM('active','closed') NOT NULL DEFAULT 'active',
  PRIMARY KEY (assignment_id),
  INDEX idx_da_driver  (driver_id),
  INDEX idx_da_vehicle (vehicle_id),
  INDEX idx_da_icdv    (icdv_id),
  INDEX idx_da_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 6. receiving_logs — yard receipt records ──────────────────────────────────
CREATE TABLE IF NOT EXISTS receiving_logs (
  receive_id     INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  icdv_id        INT UNSIGNED     NOT NULL,
  vehicle_id     INT UNSIGNED     NOT NULL,
  transfer_id    INT UNSIGNED     NULL,
  driver_id      INT UNSIGNED     NOT NULL,
  driver_id_card VARCHAR(100)     NOT NULL,
  received_by    INT UNSIGNED     NOT NULL,         -- yard operator
  receive_notes  TEXT             NULL,
  received_at    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (receive_id),
  INDEX idx_rl_vehicle (vehicle_id),
  INDEX idx_rl_icdv    (icdv_id),
  INDEX idx_rl_driver  (driver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ── Post-migration: update existing vehicles to workflow_status = 'manifested' ─
UPDATE vehicles SET workflow_status = 'manifested', current_location = 'vessel'
WHERE workflow_status = 'manifested';
