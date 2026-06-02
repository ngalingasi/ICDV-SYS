-- ============================================================
-- MIGRATION 011: Fuel Management System
-- Server: MariaDB 10.4 / MySQL
--
-- Column types matched to live schema:
--   manifests.manifest_id  = int(11)          (signed)
--   vehicles.vehicle_id    = int(11)          (signed)
--   users.user_id          = int(11)          (signed)
--   icdvs.icdv_id          = int(10) UNSIGNED
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. Add fuel_officer to role ENUM ─────────────────────────────────────────
ALTER TABLE users
  MODIFY COLUMN role
    ENUM(
      'operator',
      'supervisor',
      'admin',
      'super_admin',
      'system_admin',
      'discharge_officer',
      'backoffice_officer',
      'transfer_officer',
      'yard_officer',
      'fuel_officer'
    )
    NOT NULL DEFAULT 'operator';

-- ── 2. manifest_fuel_orders ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manifest_fuel_orders (
  order_id        INT(11) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  manifest_id     INT(11)          NOT NULL,           -- matches manifests.manifest_id int(11)
  icdv_id         INT(10) UNSIGNED NOT NULL,           -- matches icdvs.icdv_id int(10) unsigned
  fuel_type       ENUM('diesel','petrol') NOT NULL,
  ordered_litres  DECIMAL(10,2)   NOT NULL,
  status          ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  notes           TEXT            NULL,
  reviewed_by     INT(11)         NULL,                -- matches users.user_id int(11)
  reviewed_at     DATETIME        NULL,
  review_notes    TEXT            NULL,
  ordered_by      INT(11)         NOT NULL,            -- matches users.user_id int(11)
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_fuelorder_manifest FOREIGN KEY (manifest_id)
    REFERENCES manifests(manifest_id) ON DELETE RESTRICT,

  INDEX idx_fuelorder_icdv     (icdv_id),
  INDEX idx_fuelorder_status   (status),
  INDEX idx_fuelorder_ordered  (ordered_by),
  INDEX idx_fuelorder_reviewed (reviewed_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── 3. manifest_fuel_stock ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manifest_fuel_stock (
  manifest_id       INT(11)          NOT NULL,          -- matches manifests.manifest_id int(11)
  fuel_type         ENUM('diesel','petrol') NOT NULL,
  icdv_id           INT(10) UNSIGNED NOT NULL,          -- matches icdvs.icdv_id int(10) unsigned
  total_ordered     DECIMAL(10,2)    NOT NULL DEFAULT 0.00,
  total_dispensed   DECIMAL(10,2)    NOT NULL DEFAULT 0.00,
  current_stock     DECIMAL(10,2)    NOT NULL DEFAULT 0.00,
  updated_at        DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (manifest_id, fuel_type),

  CONSTRAINT fk_fuelstock_manifest FOREIGN KEY (manifest_id)
    REFERENCES manifests(manifest_id) ON DELETE RESTRICT,

  INDEX idx_fuelstock_icdv (icdv_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── 4. vehicle_fuel_records ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicle_fuel_records (
  fuel_record_id    INT(11) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  manifest_id       INT(11)          NOT NULL,          -- matches manifests.manifest_id int(11)
  vehicle_id        INT(11)          NOT NULL,          -- matches vehicles.vehicle_id int(11)
  icdv_id           INT(10) UNSIGNED NOT NULL,          -- matches icdvs.icdv_id int(10) unsigned
  fuel_type         ENUM('diesel','petrol') NOT NULL,
  litres_dispensed  DECIMAL(8,2)     NOT NULL,
  notes             TEXT             NULL,
  dispensed_by      INT(11)          NOT NULL,          -- matches users.user_id int(11)
  dispensed_at      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_fuelrec_manifest FOREIGN KEY (manifest_id)
    REFERENCES manifests(manifest_id) ON DELETE RESTRICT,
  CONSTRAINT fk_fuelrec_vehicle  FOREIGN KEY (vehicle_id)
    REFERENCES vehicles(vehicle_id)   ON DELETE RESTRICT,

  INDEX idx_fuelrec_icdv       (icdv_id),
  INDEX idx_fuelrec_vehicle    (vehicle_id),
  INDEX idx_fuelrec_manifest   (manifest_id),
  INDEX idx_fuelrec_dispenser  (dispensed_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS = 1;
