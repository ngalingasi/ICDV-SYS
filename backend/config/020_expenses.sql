-- ============================================================
-- Migration 020: Expenses Module
--
-- A simple, super_admin-only record of operational expenses tied to a
-- single manifest (and therefore ICDV, via that manifest). Unlike
-- invoices, expenses have no approval workflow — just create/edit/delete.
--
--   expense_items       — reusable catalog (name, description, default
--                          rate, unit) managed in Lookups, mirrors
--                          invoice_items.
--   expenses            — one record per manifest. icdv_id is denormalized
--                          from the manifest at creation time for fast
--                          ICDV-scoped queries (consistent with invoices).
--   expense_line_items  — multiple lines per expense. Each line may
--                          reference a catalog item (or be free-text),
--                          carries its own shift_count multiplier,
--                          quantity (number of units), and a computed
--                          line_total.
-- ============================================================

-- ── 1. Expense Items catalog ────────────────────────────────────
CREATE TABLE  `expense_items` (
  `item_id`       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(200)    NOT NULL,
  `description`   TEXT                NULL,
  `default_rate`  DECIMAL(15,2)  NOT NULL DEFAULT 0,
  `unit`          VARCHAR(50)    NOT NULL DEFAULT 'unit' COMMENT 'unit | shift | trip | fixed | etc',
  `status`        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_by`    INT UNSIGNED        NULL,
  `updated_by`    INT UNSIGNED        NULL,
  `created_at`    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`item_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. Expenses (one per manifest) ──────────────────────────────
CREATE TABLE  `expenses` (
  `expense_id`    INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `expense_number` VARCHAR(30)    NOT NULL UNIQUE COMMENT 'DDMMYYYY-NN format, same convention as invoices',
  `manifest_id`   INT UNSIGNED    NOT NULL,
  `icdv_id`       INT UNSIGNED    NOT NULL COMMENT 'Denormalized from manifest at creation for fast ICDV-scoped queries',
  `expense_date`  DATE            NOT NULL,
  `notes`         TEXT                NULL,
  `total_amount`  DECIMAL(15,2)  NOT NULL DEFAULT 0 COMMENT 'Sum of all line_total — recalculated on every line change',
  `created_by`    INT UNSIGNED        NULL,
  `updated_by`    INT UNSIGNED        NULL,
  `created_at`    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`expense_id`),
  INDEX `idx_manifest` (`manifest_id`),
  INDEX `idx_icdv`     (`icdv_id`),
  INDEX `idx_date`     (`expense_date`)
  -- FKs intentionally omitted (display-width mismatch risk across
  -- earlier-created tables — see invoice_line_items for precedent).
  -- Referential integrity enforced at the application layer.
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 3. Expense Line Items ────────────────────────────────────────
CREATE TABLE  `expense_line_items` (
  `line_id`       INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  `expense_id`    INT UNSIGNED    NOT NULL,
  `item_id`       INT UNSIGNED        NULL COMMENT 'NULL = free-text line item',
  `description`   TEXT            NOT NULL,
  `shift_count`   DECIMAL(10,2)  NOT NULL DEFAULT 1 COMMENT 'Number of shifts — multiplies into line_total',
  `unit`          VARCHAR(50)    NOT NULL DEFAULT 'unit',
  `quantity`      DECIMAL(10,2)  NOT NULL DEFAULT 1 COMMENT 'Number of units',
  `unit_price`    DECIMAL(15,2)  NOT NULL DEFAULT 0,
  `line_total`    DECIMAL(15,2)  NOT NULL DEFAULT 0 COMMENT 'quantity * unit_price * shift_count',
  `sort_order`    SMALLINT       NOT NULL DEFAULT 0,
  `created_at`    DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`line_id`),
  INDEX `idx_expense` (`expense_id`),
  INDEX `idx_item`    (`item_id`),
  FOREIGN KEY (`expense_id`) REFERENCES `expenses`(`expense_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
