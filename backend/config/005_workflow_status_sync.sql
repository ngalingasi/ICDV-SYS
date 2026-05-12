-- ============================================================
-- MIGRATION 005: Workflow Status Sync Fix
-- Run ONCE. Safe to re-run ( / idempotent).
-- Ensures all status columns exist and are consistent.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. Ensure workflow_status exists on vehicles ──────────────────────────────
ALTER TABLE vehicles
  ADD COLUMN  workflow_status
    ENUM('manifested','discharged','batched','in_transit','received')
    NOT NULL DEFAULT 'manifested' AFTER operational_status;

-- ── 2. Ensure current_location exists on vehicles ─────────────────────────────
ALTER TABLE vehicles
  ADD COLUMN  current_location
    ENUM('vessel','holding_ground','tpa_gate','tpa_gate_to_yard','icdv_yard')
    NOT NULL DEFAULT 'vessel' AFTER workflow_status;

-- ── 3. Ensure batch_id exists on vehicles ─────────────────────────────────────
ALTER TABLE vehicles
  ADD COLUMN  batch_id INT UNSIGNED NULL AFTER current_location;

-- ── 4. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX  idx_vehicles_workflow  ON vehicles(workflow_status);
CREATE INDEX  idx_vehicles_location  ON vehicles(current_location);
CREATE INDEX  idx_vehicles_batch     ON vehicles(batch_id);

-- ── 5. Sync: set all existing vehicles to 'manifested' / 'vessel' ─────────────
-- Only touches rows that have never been through workflow
UPDATE vehicles
  SET workflow_status = 'manifested', current_location = 'vessel'
  WHERE workflow_status = 'manifested' AND current_location = 'vessel';

-- ── 6. Ensure manifests table has workflow-summary columns ────────────────────
-- These are computed counts stored for fast display in the manifest list.
ALTER TABLE manifests
  ADD COLUMN  manifested_count  SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER status;
ALTER TABLE manifests
  ADD COLUMN  discharged_count  SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER manifested_count;
ALTER TABLE manifests
  ADD COLUMN  batched_count     SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER discharged_count;
ALTER TABLE manifests
  ADD COLUMN  in_transit_count  SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER batched_count;
ALTER TABLE manifests
  ADD COLUMN  received_count    SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER in_transit_count;

-- ── 7. Back-fill manifest summary counts from current vehicle states ──────────
UPDATE manifests m
  SET
    manifested_count = (SELECT COUNT(*) FROM vehicles v WHERE v.manifest_id=m.manifest_id AND v.workflow_status='manifested'),
    discharged_count = (SELECT COUNT(*) FROM vehicles v WHERE v.manifest_id=m.manifest_id AND v.workflow_status='discharged'),
    batched_count    = (SELECT COUNT(*) FROM vehicles v WHERE v.manifest_id=m.manifest_id AND v.workflow_status='batched'),
    in_transit_count = (SELECT COUNT(*) FROM vehicles v WHERE v.manifest_id=m.manifest_id AND v.workflow_status='in_transit'),
    received_count   = (SELECT COUNT(*) FROM vehicles v WHERE v.manifest_id=m.manifest_id AND v.workflow_status='received');

-- ── 8. Auto-progress manifest status based on vehicle states ──────────────────
-- pending  → active     when at least 1 vehicle has been discharged
-- active   → completed  when all vehicles received
UPDATE manifests m
  JOIN (
    SELECT manifest_id,
           COUNT(*) AS total,
           SUM(workflow_status != 'manifested') AS started,
           SUM(workflow_status  = 'received')   AS received
    FROM vehicles GROUP BY manifest_id
  ) s ON s.manifest_id = m.manifest_id
  SET m.status = CASE
    WHEN s.total > 0 AND s.received = s.total THEN 'completed'
    WHEN s.started > 0                         THEN 'active'
    ELSE m.status
  END
  WHERE m.status NOT IN ('cancelled');

SET FOREIGN_KEY_CHECKS = 1;
