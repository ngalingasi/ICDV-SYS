-- ============================================================
-- MIGRATION 013: Incident Reporting System
--
-- Tables:
--   1. incident_types      — managed list of incident categories
--   2. incidents           — main incident record per vehicle
--   3. incident_attachments — up to 3 photos/files per incident
--
-- Column types matched to live DB:
--   vehicles.vehicle_id   = int(11) signed
--   manifests.manifest_id = int(11) signed
--   users.user_id         = int(11) signed
--   icdvs.icdv_id         = int(10) UNSIGNED
--
-- FK only to vehicles and manifests (same engine/charset).
-- icdvs and users are plain indexes for safety.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. incident_types ─────────────────────────────────────────────────────────
CREATE TABLE  incident_types (
  type_id     INT(11) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100)    NOT NULL UNIQUE,
  description TEXT            NULL,
  is_active   TINYINT(1)      NOT NULL DEFAULT 1,
  sort_order  SMALLINT        NOT NULL DEFAULT 0,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Default incident types
INSERT IGNORE INTO incident_types (name, sort_order) VALUES
  ('Accident',             1),
  ('Breakdown',            2),
  ('Damage',               3),
  ('Theft',                4),
  ('Missing Documents',    5),
  ('Fire',                 6),
  ('Flood / Water Damage', 7),
  ('Other',                99);

-- ── 2. incidents ──────────────────────────────────────────────────────────────
CREATE TABLE  incidents (
  incident_id     INT(11) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vehicle_id      INT(11)          NOT NULL,
  manifest_id     INT(11)          NULL,
  icdv_id         INT(10) UNSIGNED NOT NULL,
  type_id         INT(11) UNSIGNED NOT NULL,
  severity        ENUM('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  status          ENUM('reported','acknowledged','resolved') NOT NULL DEFAULT 'reported',
  description     TEXT            NOT NULL,
  -- Auto-populated from active transfer if available
  driver_id       INT(11)         NULL,
  driver_snapshot VARCHAR(200)    NULL  COMMENT 'Driver name at time of report (denormalised)',
  -- Reporting
  reported_by     INT(11)         NOT NULL,
  reported_at     DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Acknowledgement
  acknowledged_by INT(11)         NULL,
  acknowledged_at DATETIME        NULL,
  -- Resolution
  resolved_by     INT(11)         NULL,
  resolved_at     DATETIME        NULL,
  resolution_notes TEXT           NULL,

  CONSTRAINT fk_incident_vehicle  FOREIGN KEY (vehicle_id)  REFERENCES vehicles(vehicle_id)   ON DELETE RESTRICT,
  CONSTRAINT fk_incident_manifest FOREIGN KEY (manifest_id) REFERENCES manifests(manifest_id) ON DELETE SET NULL,

  INDEX idx_incident_icdv     (icdv_id),
  INDEX idx_incident_type     (type_id),
  INDEX idx_incident_status   (status),
  INDEX idx_incident_severity (severity),
  INDEX idx_incident_vehicle  (vehicle_id),
  INDEX idx_incident_reported (reported_by),
  INDEX idx_incident_driver   (driver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ── 3. incident_attachments ───────────────────────────────────────────────────
CREATE TABLE  incident_attachments (
  attachment_id INT(11) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  incident_id   INT(11) UNSIGNED NOT NULL,
  file_path     VARCHAR(500)    NOT NULL,
  file_name     VARCHAR(255)    NULL,
  mime_type     VARCHAR(100)    NULL,
  uploaded_by   INT(11)         NOT NULL,
  uploaded_at   DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_inc_att_incident FOREIGN KEY (incident_id)
    REFERENCES incidents(incident_id) ON DELETE CASCADE,

  INDEX idx_inc_att_incident (incident_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS = 1;
