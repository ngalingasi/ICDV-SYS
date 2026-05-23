-- ============================================================
-- MIGRATION 008: RBAC Role Expansion
-- Adds 4 new operational roles and batch status columns.
--
-- New roles: discharge_officer, backoffice_officer,
--            transfer_officer, yard_officer
--
-- New batch columns:
--   document_status, document_remark,
--   gc_status, gc_remark, operational_status
--
-- Run ONCE. Safe on existing data.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. Extend users.role ENUM with 4 new roles ────────────────────────────────
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
      'yard_officer'
    )
    NOT NULL DEFAULT 'operator';

-- ── 2. Add document_status to batches ────────────────────────────────────────
ALTER TABLE batches
  ADD COLUMN  document_status
    ENUM('not_ready', 'ready')
    NOT NULL DEFAULT 'not_ready'
    AFTER notes;

ALTER TABLE batches
  ADD COLUMN  document_remark
    TEXT NULL
    AFTER document_status;

-- ── 3. Add gc_status to batches ───────────────────────────────────────────────
ALTER TABLE batches
  ADD COLUMN  gc_status
    ENUM('not_sent', 'sent')
    NOT NULL DEFAULT 'not_sent'
    AFTER document_remark;

ALTER TABLE batches
  ADD COLUMN  gc_remark
    TEXT NULL
    AFTER gc_status;

-- ── 4. Add operational_status to batches ─────────────────────────────────────
--   Auto-computed: ready only when document_status=ready AND gc_status=sent
--   Updated by the application layer on every document/gc status change.
ALTER TABLE batches
  ADD COLUMN  operational_status
    ENUM('not_ready', 'ready')
    NOT NULL DEFAULT 'not_ready'
    AFTER gc_remark;

-- ── 5. Add indexes on new batch status columns ────────────────────────────────
CREATE INDEX  idx_batch_doc_status ON batches(document_status);
CREATE INDEX  idx_batch_gc_status  ON batches(gc_status);
CREATE INDEX  idx_batch_op_status  ON batches(operational_status);

-- ── 6. Add document_updated_by + gc_updated_by for audit trail ────────────────
ALTER TABLE batches
  ADD COLUMN  document_updated_by
    INT UNSIGNED NULL
    AFTER operational_status;

ALTER TABLE batches
  ADD COLUMN  document_updated_at
    DATETIME NULL
    AFTER document_updated_by;

ALTER TABLE batches
  ADD COLUMN  gc_updated_by
    INT UNSIGNED NULL
    AFTER document_updated_at;

ALTER TABLE batches
  ADD COLUMN  gc_updated_at
    DATETIME NULL
    AFTER gc_updated_by;

-- ── 7. Backfill: mark existing open/full batches as operationally ready ───────
--   Existing batches predate the document/GC workflow. Marking them ready
--   ensures no existing transfers are blocked after this migration.
--   Adjust this UPDATE if your production data should start in not_ready state.
UPDATE batches
  SET document_status    = 'ready',
      gc_status          = 'sent',
      operational_status = 'ready'
  WHERE status IN ('open', 'full', 'closed', 'transferred');

SET FOREIGN_KEY_CHECKS = 1;
