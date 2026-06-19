-- ============================================================
-- Migration 015: Integration Logs Table
-- Logs all outbound integration calls (ERP) AND all internal
-- system API requests/responses for audit and observability.
--
-- `integration` column values:
--   - 'erp'                 — calls from the ERP integration endpoints
--   - 'internal_<module>'   — regular system traffic, tagged by route
--                             group, e.g. 'internal_manifests',
--                             'internal_vehicles', 'internal_workflow'
-- ============================================================
CREATE TABLE IF NOT EXISTS `integration_logs` (
  `id`               BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `correlation_id`   VARCHAR(64)         NOT NULL,
  `integration`      VARCHAR(64)         NOT NULL COMMENT 'erp | internal_<module>',
  `direction`        ENUM('outbound')    NOT NULL DEFAULT 'outbound',
  `method`           VARCHAR(10)         NOT NULL,
  `url`              TEXT                NOT NULL,
  `request_headers`  JSON                         COMMENT 'Sensitive values masked',
  `request_payload`  LONGTEXT,
  `response_status`  SMALLINT UNSIGNED,
  `response_payload` LONGTEXT,
  `error_message`    TEXT,
  `duration_ms`      INT UNSIGNED,
  `triggered_by`     INT UNSIGNED,
  `context`          VARCHAR(255),
  `status`           ENUM('success','error','pending') NOT NULL DEFAULT 'pending',
  `created_at`       DATETIME            NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_integration` (`integration`),
  INDEX `idx_status`      (`status`),
  INDEX `idx_created_at`  (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
