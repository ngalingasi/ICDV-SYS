-- ============================================================
-- MIGRATION 014: Transit Time Configuration
--
-- One transit time config per ICDV.
-- Tracks TPA gate-out → ICDV yard arrival only.
-- All vehicles belonging to an ICDV share the same transit time
-- expectation since they all go to the same yard.
--
-- Column types matched to live DB:
--   icdvs.icdv_id = int(10) UNSIGNED
--   users.user_id = int(11) signed
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS transit_time_configs (
  config_id      INT(11) UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  icdv_id        INT(10) UNSIGNED NOT NULL,          -- one config per ICDV
  normal_minutes SMALLINT         NOT NULL DEFAULT 30, -- green threshold (TPA → yard)
  max_minutes    SMALLINT         NOT NULL DEFAULT 60, -- red/delayed threshold
  notes          TEXT             NULL,
  updated_by     INT(11)          NULL,
  updated_at     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY uq_icdv (icdv_id),
  CONSTRAINT fk_ttc_icdv FOREIGN KEY (icdv_id) REFERENCES icdvs(icdv_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

SET FOREIGN_KEY_CHECKS = 1;
