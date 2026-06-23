-- ============================================================
-- Migration 016: Invoicing & Billing System
-- ============================================================

-- ── 1. Add TIN/VRN to icdvs (invoice recipient fields) ─────
ALTER TABLE `icdvs`
  ADD COLUMN IF NOT EXISTS `tin`         VARCHAR(50)  NULL COMMENT 'Tax Identification Number'   AFTER `email`,
  ADD COLUMN IF NOT EXISTS `vrn`         VARCHAR(50)  NULL COMMENT 'VAT Registration Number'      AFTER `tin`;

-- ── 2. Add cashier role ─────────────────────────────────────
-- (No schema change — role is a VARCHAR in users table, enforced in app)

-- ── 3. Operator config in system_settings ───────────────────
-- Stored as individual keys: operator_name, operator_address,
-- operator_phone, operator_email, operator_tin, operator_vrn,
-- operator_bank_name, operator_bank_account, operator_bank_branch
-- Seeded with placeholder values — edit via Lookups UI.

INSERT IGNORE INTO `system_settings` (setting_key, setting_value, updated_by, updated_at) VALUES
  ('operator_name',         'ODOGWU COMPANY LIMITED',          1, NOW()),
  ('operator_address',      'Kinondoni, Macho Street',         1, NOW()),
  ('operator_phone',        '0762-992-000',                    1, NOW()),
  ('operator_email',        'info@odogwu.tz',                  1, NOW()),
  ('operator_tin',          '',                                1, NOW()),
  ('operator_vrn',          '',                                1, NOW()),
  ('operator_bank_name',    'NMB Bank',                        1, NOW()),
  ('operator_bank_account', '22610059509',                     1, NOW()),
  ('operator_bank_branch',  '',                                1, NOW());

-- ── 4. Invoice items catalog ─────────────────────────────────
CREATE TABLE IF NOT EXISTS `invoice_items` (
  `item_id`       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(200)    NOT NULL,
  `description`   TEXT                NULL,
  `default_rate`  DECIMAL(15,2)  NOT NULL DEFAULT 0,
  `unit`          VARCHAR(50)    NOT NULL DEFAULT 'vehicle' COMMENT 'vehicle | fixed | trip | etc',
  `status`        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_by`    INT UNSIGNED        NULL,
  `updated_by`    INT UNSIGNED        NULL,
  `created_at`    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 5. Invoices ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `invoices` (
  `invoice_id`             INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `invoice_number`         VARCHAR(30)     NOT NULL UNIQUE COMMENT 'DDMMYYYY-NN format',
  `icdv_id`                INT UNSIGNED    NOT NULL COMMENT 'Recipient ICDV (billed party)',
  `issued_date`            DATE            NOT NULL,
  `due_date`               DATE                NULL,
  `status`                 ENUM('invoiced','approved','paid','cancelled') NOT NULL DEFAULT 'invoiced',
  `notes`                  TEXT                NULL COMMENT 'Bank details, payment instructions etc',
  `withholding_tax_rate`   DECIMAL(5,2)   NOT NULL DEFAULT 5.00 COMMENT 'WHT percentage',
  `subtotal`               DECIMAL(15,2)  NOT NULL DEFAULT 0,
  `withholding_tax_amount` DECIMAL(15,2)  NOT NULL DEFAULT 0,
  `total_amount`           DECIMAL(15,2)  NOT NULL DEFAULT 0,
  `approved_by`            INT UNSIGNED        NULL,
  `approved_at`            DATETIME            NULL,
  `paid_at`                DATETIME            NULL,
  `paid_by`                INT UNSIGNED        NULL,
  `cancelled_at`           DATETIME            NULL,
  `cancelled_by`           INT UNSIGNED        NULL,
  `cancellation_reason`    TEXT                NULL,
  `created_by`             INT UNSIGNED        NULL,
  `updated_by`             INT UNSIGNED        NULL,
  `created_at`             DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`             DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`invoice_id`),
  INDEX `idx_icdv`    (`icdv_id`),
  INDEX `idx_status`  (`status`),
  INDEX `idx_issued`  (`issued_date`)
  -- FK on icdv_id omitted: icdvs.icdv_id uses INT(10) UNSIGNED display width
  -- which varies by MySQL version; validated at application level instead.
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 6. Invoice line items ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS `invoice_line_items` (
  `line_id`       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `invoice_id`    INT UNSIGNED    NOT NULL,
  `item_id`       INT UNSIGNED        NULL COMMENT 'NULL = free-text line item',
  `manifest_id`   INT UNSIGNED        NULL COMMENT 'NULL = not linked to a manifest',
  `description`   TEXT            NOT NULL,
  `unit`          VARCHAR(50)    NOT NULL DEFAULT 'vehicle',
  `quantity`      DECIMAL(10,2)  NOT NULL DEFAULT 1,
  `unit_price`    DECIMAL(15,2)  NOT NULL DEFAULT 0,
  `line_total`    DECIMAL(15,2)  NOT NULL DEFAULT 0,
  `sort_order`    SMALLINT       NOT NULL DEFAULT 0,
  `created_at`    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`line_id`),
  INDEX `idx_invoice`  (`invoice_id`),
  INDEX `idx_item`     (`item_id`),
  INDEX `idx_manifest` (`manifest_id`),
  -- Only enforce the mandatory FK (invoice_id); item_id and manifest_id are
  -- soft references (nullable) to avoid cross-table type width mismatches.
  FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`invoice_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 7. Invoice payments / evidence ───────────────────────────
CREATE TABLE IF NOT EXISTS `invoice_payments` (
  `payment_id`      INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `invoice_id`      INT UNSIGNED    NOT NULL,
  `paid_at`         DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `paid_by`         INT UNSIGNED        NULL,
  `evidence_path`   VARCHAR(500)        NULL COMMENT 'Uploaded receipt file path',
  `evidence_name`   VARCHAR(200)        NULL,
  `notes`           TEXT                NULL,
  `created_at`      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`payment_id`),
  INDEX `idx_invoice` (`invoice_id`)
  -- FK on invoice_id handled at application level
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 8. Close Operation support on manifests ───────────────────
-- Adds 'closed' to manifest status enum (existing statuses kept)
ALTER TABLE `manifests`
  MODIFY COLUMN `status` ENUM('pending','active','completed','cancelled','closed')
    NOT NULL DEFAULT 'pending';

ALTER TABLE `manifests`
  ADD COLUMN IF NOT EXISTS `closed_at`  DATETIME     NULL AFTER `status`,
  ADD COLUMN IF NOT EXISTS `closed_by`  INT UNSIGNED NULL AFTER `closed_at`;
