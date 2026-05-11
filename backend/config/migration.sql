-- ============================================================
-- ICDV Vehicle Import & Delivery Management System
-- Database Migration
-- Run after existing users / auth tables are in place
-- ============================================================

-- ── Vessels ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vessels (
  vessel_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(200)    NOT NULL,
  imo_number      VARCHAR(20)     NULL UNIQUE,
  flag            VARCHAR(100)    NULL,
  shipping_line   VARCHAR(200)    NULL,
  arrival_date    DATE            NOT NULL,
  departure_date  DATE            NULL,
  berth_number    VARCHAR(50)     NULL,
  port_of_origin  VARCHAR(200)    NULL,
  notes           TEXT            NULL,
  status          ENUM('expected','arrived','processing','completed','departed')
                  NOT NULL DEFAULT 'expected',
  created_by      INT UNSIGNED    NULL,
  updated_by      INT UNSIGNED    NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vessel_created_by FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_vessel_updated_by FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Manifests ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manifests (
  manifest_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  manifest_number VARCHAR(100)    NOT NULL UNIQUE,
  vessel_id       INT UNSIGNED    NOT NULL,
  arrival_date    DATE            NOT NULL,
  notes           TEXT            NULL,
  status          ENUM('pending','active','completed','cancelled')
                  NOT NULL DEFAULT 'pending',
  created_by      INT UNSIGNED    NULL,
  updated_by      INT UNSIGNED    NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_manifest_vessel    FOREIGN KEY (vessel_id)   REFERENCES vessels(vessel_id) ON DELETE RESTRICT,
  CONSTRAINT fk_manifest_created   FOREIGN KEY (created_by)  REFERENCES users(user_id)    ON DELETE SET NULL,
  CONSTRAINT fk_manifest_updated   FOREIGN KEY (updated_by)  REFERENCES users(user_id)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Vehicles ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
  vehicle_id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  manifest_id         INT UNSIGNED    NOT NULL,
  chassis_number      VARCHAR(50)     NOT NULL UNIQUE,
  engine_number       VARCHAR(50)     NULL,
  brand               VARCHAR(100)    NULL,
  model               VARCHAR(100)    NULL,
  year                SMALLINT        NULL,
  color               VARCHAR(50)     NULL,
  customer_name       VARCHAR(200)    NULL,
  destination         VARCHAR(200)    NULL,
  release_status      ENUM('unreleased','released','collected','on_hold')
                      NOT NULL DEFAULT 'unreleased',
  operational_status  ENUM('pending','in_operation','ready','delivered','cancelled')
                      NOT NULL DEFAULT 'pending',
  notes               TEXT            NULL,
  created_by          INT UNSIGNED    NULL,
  updated_by          INT UNSIGNED    NULL,
  created_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vehicle_manifest   FOREIGN KEY (manifest_id) REFERENCES manifests(manifest_id) ON DELETE RESTRICT,
  CONSTRAINT fk_vehicle_created    FOREIGN KEY (created_by)  REFERENCES users(user_id)         ON DELETE SET NULL,
  CONSTRAINT fk_vehicle_updated    FOREIGN KEY (updated_by)  REFERENCES users(user_id)         ON DELETE SET NULL,
  INDEX idx_vehicle_chassis   (chassis_number),
  INDEX idx_vehicle_manifest  (manifest_id),
  INDEX idx_vehicle_release   (release_status),
  INDEX idx_vehicle_ops       (operational_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Drivers ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drivers (
  driver_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name       VARCHAR(200)    NOT NULL,
  license_number  VARCHAR(50)     NOT NULL UNIQUE,
  phone           VARCHAR(30)     NULL,
  email           VARCHAR(200)    NULL,
  id_number       VARCHAR(50)     NULL,
  status          ENUM('active','inactive','suspended') NOT NULL DEFAULT 'active',
  notes           TEXT            NULL,
  created_by      INT UNSIGNED    NULL,
  updated_by      INT UNSIGNED    NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_driver_created FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_driver_updated FOREIGN KEY (updated_by) REFERENCES users(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Operations ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS operations (
  operation_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vehicle_id      INT UNSIGNED    NOT NULL,
  driver_id       INT UNSIGNED    NULL,
  operation_type  VARCHAR(100)    NOT NULL,  -- e.g. 'inspection','cleaning','repair','delivery_prep'
  scheduled_date  DATE            NULL,
  completed_date  DATETIME        NULL,
  notes           TEXT            NULL,
  status          ENUM('pending','in_progress','completed','cancelled')
                  NOT NULL DEFAULT 'pending',
  created_by      INT UNSIGNED    NULL,
  updated_by      INT UNSIGNED    NULL,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_op_vehicle  FOREIGN KEY (vehicle_id)  REFERENCES vehicles(vehicle_id) ON DELETE RESTRICT,
  CONSTRAINT fk_op_driver   FOREIGN KEY (driver_id)   REFERENCES drivers(driver_id)  ON DELETE SET NULL,
  CONSTRAINT fk_op_created  FOREIGN KEY (created_by)  REFERENCES users(user_id)      ON DELETE SET NULL,
  CONSTRAINT fk_op_updated  FOREIGN KEY (updated_by)  REFERENCES users(user_id)      ON DELETE SET NULL,
  INDEX idx_op_vehicle  (vehicle_id),
  INDEX idx_op_status   (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Deliveries ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS deliveries (
  delivery_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vehicle_id        INT UNSIGNED    NOT NULL,
  driver_id         INT UNSIGNED    NULL,
  scheduled_date    DATE            NULL,
  delivered_date    DATETIME        NULL,
  delivery_address  TEXT            NULL,
  recipient_name    VARCHAR(200)    NULL,
  recipient_phone   VARCHAR(30)     NULL,
  notes             TEXT            NULL,
  delivery_notes    TEXT            NULL,
  status            ENUM('scheduled','in_transit','delivered','failed','cancelled')
                    NOT NULL DEFAULT 'scheduled',
  created_by        INT UNSIGNED    NULL,
  updated_by        INT UNSIGNED    NULL,
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_del_vehicle FOREIGN KEY (vehicle_id)  REFERENCES vehicles(vehicle_id) ON DELETE RESTRICT,
  CONSTRAINT fk_del_driver  FOREIGN KEY (driver_id)   REFERENCES drivers(driver_id)  ON DELETE SET NULL,
  CONSTRAINT fk_del_created FOREIGN KEY (created_by)  REFERENCES users(user_id)      ON DELETE SET NULL,
  CONSTRAINT fk_del_updated FOREIGN KEY (updated_by)  REFERENCES users(user_id)      ON DELETE SET NULL,
  INDEX idx_del_vehicle (vehicle_id),
  INDEX idx_del_status  (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
