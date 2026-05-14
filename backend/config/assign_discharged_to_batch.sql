-- ============================================================
-- assign_discharged_to_batches.sql
-- phpMyAdmin compatible — NO stored procedure, NO DELIMITER
--
-- Run each numbered block separately in phpMyAdmin.
-- Or paste all blocks into one query window and run together.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- BLOCK 1 — PREVIEW (run this first, no changes made)
-- ════════════════════════════════════════════════════════════

SELECT
  v.vehicle_id,
  v.chassis_number,
  v.workflow_status,
  v.batch_id              AS current_batch_id,
  m.manifest_number,
  vs.name                 AS vessel_name,
  ic.name                 AS icdv_name
FROM vehicles v
JOIN manifests m  ON m.manifest_id = v.manifest_id
JOIN vessels   vs ON vs.vessel_id  = m.vessel_id
JOIN icdvs     ic ON ic.icdv_id    = v.icdv_id
WHERE v.workflow_status = 'discharged'
  AND v.batch_id IS NULL
ORDER BY v.icdv_id, vs.vessel_id, v.vehicle_id;


-- ════════════════════════════════════════════════════════════
-- BLOCK 2 — BUILD WORKING TABLE
-- Creates a temp table ranking each discharged vehicle within
-- its vessel group so we can calculate which batch it lands in
-- ════════════════════════════════════════════════════════════

DROP TEMPORARY TABLE IF EXISTS tmp_discharged;

CREATE TEMPORARY TABLE tmp_discharged AS
SELECT
  v.vehicle_id,
  v.icdv_id,
  vs.vessel_id,
  v.manifest_id,
  -- row number within each icdv+vessel group, ordered by vehicle_id
  @rn := IF(
    @prev_grp = CONCAT(v.icdv_id, '-', vs.vessel_id),
    @rn + 1,
    1
  ) AS row_in_group,
  @prev_grp := CONCAT(v.icdv_id, '-', vs.vessel_id) AS grp_key
FROM vehicles v
JOIN manifests m  ON m.manifest_id = v.manifest_id
JOIN vessels   vs ON vs.vessel_id  = m.vessel_id,
     (SELECT @rn := 0, @prev_grp := '') init
WHERE v.workflow_status = 'discharged'
  AND v.batch_id IS NULL
ORDER BY v.icdv_id, vs.vessel_id, v.vehicle_id;


-- ════════════════════════════════════════════════════════════
-- BLOCK 3 — CALCULATE EXISTING VEHICLE COUNT PER OPEN BATCH
-- So new vehicles continue from where the existing batch left off
-- ════════════════════════════════════════════════════════════

DROP TEMPORARY TABLE IF EXISTS tmp_existing_counts;

CREATE TEMPORARY TABLE tmp_existing_counts AS
SELECT
  b.icdv_id,
  b.vessel_id,
  b.batch_id,
  b.vehicle_count       AS existing_count,
  b.batch_number
FROM batches b
WHERE b.status = 'open';


-- ════════════════════════════════════════════════════════════
-- BLOCK 4 — ASSIGN SLOT NUMBERS
-- Each vehicle gets an absolute slot number:
--   existing_count + row_in_group
-- Batch index = CEIL(slot / 20) within the vessel's open batch
-- ════════════════════════════════════════════════════════════

DROP TEMPORARY TABLE IF EXISTS tmp_assignments;

CREATE TEMPORARY TABLE tmp_assignments AS
SELECT
  d.vehicle_id,
  d.icdv_id,
  d.vessel_id,
  d.manifest_id,
  COALESCE(ec.existing_count, 0)                       AS existing_count,
  COALESCE(ec.batch_id, NULL)                          AS open_batch_id,
  COALESCE(ec.batch_number, NULL)                      AS open_batch_number,
  d.row_in_group,
  -- absolute slot within this vessel+icdv group (1-based)
  COALESCE(ec.existing_count, 0) + d.row_in_group      AS abs_slot,
  -- which batch sequence this slot belongs to (0-based offset from current open batch)
  FLOOR((COALESCE(ec.existing_count, 0) + d.row_in_group - 1) / 20) AS batch_offset,
  -- position within the batch (1-20)
  MOD(COALESCE(ec.existing_count, 0) + d.row_in_group - 1, 20) + 1 AS pos_in_batch
FROM tmp_discharged d
LEFT JOIN tmp_existing_counts ec
       ON ec.icdv_id   = d.icdv_id
      AND ec.vessel_id = d.vessel_id;


-- ════════════════════════════════════════════════════════════
-- BLOCK 5 — CREATE MISSING BATCHES
-- For each icdv+vessel+batch_offset that needs a new batch,
-- insert a row into batches if one doesn't already exist
-- ════════════════════════════════════════════════════════════

INSERT INTO batches (icdv_id, vessel_id, manifest_id, batch_number, batch_date, vehicle_count, status, created_by)
SELECT
  a.icdv_id,
  a.vessel_id,
  a.manifest_id,
  -- Build batch number: VESSELCODE-BATCH-NN
  CONCAT(
    UPPER(LEFT(REGEXP_REPLACE(vs.name, '[^A-Za-z0-9]', ''), 10)),
    '-BATCH-',
    LPAD(
      COALESCE(
        (SELECT MAX(CAST(SUBSTRING_INDEX(b2.batch_number, '-', -1) AS UNSIGNED))
         FROM batches b2
         WHERE b2.icdv_id   = a.icdv_id
           AND b2.vessel_id = a.vessel_id),
        0
      ) + a.batch_offset + IF(a.open_batch_id IS NULL, 1, 0),
      2, '0'
    )
  )                      AS batch_number,
  CURDATE()              AS batch_date,
  0                      AS vehicle_count,
  'open'                 AS status,
  1                      AS created_by
FROM (
  SELECT DISTINCT
    icdv_id, vessel_id, manifest_id, batch_offset, open_batch_id
  FROM tmp_assignments
  WHERE batch_offset > 0            -- only batches beyond the current open one
) a
JOIN vessels vs ON vs.vessel_id = a.vessel_id
WHERE NOT EXISTS (
  -- don't create if a batch already covers this offset
  SELECT 1 FROM batches b3
  WHERE b3.icdv_id   = a.icdv_id
    AND b3.vessel_id = a.vessel_id
    AND b3.status    = 'open'
);


-- ════════════════════════════════════════════════════════════
-- BLOCK 6 — REFRESH OPEN BATCH LOOKUP (after inserts above)
-- ════════════════════════════════════════════════════════════

DROP TEMPORARY TABLE IF EXISTS tmp_open_batches;

CREATE TEMPORARY TABLE tmp_open_batches AS
SELECT
  b.icdv_id,
  b.vessel_id,
  b.batch_id,
  b.vehicle_count,
  ROW_NUMBER() OVER (PARTITION BY b.icdv_id, b.vessel_id ORDER BY b.batch_id ASC) AS batch_rank
FROM batches b
WHERE b.status IN ('open', 'full')
  AND b.batch_id >= COALESCE(
        (SELECT MIN(b2.batch_id)
         FROM batches b2
         WHERE b2.icdv_id   = b.icdv_id
           AND b2.vessel_id = b.vessel_id
           AND b2.status    = 'open'),
        0
      );


-- ════════════════════════════════════════════════════════════
-- BLOCK 7 — UPDATE vehicles: assign batch_id + set 'batched'
-- ════════════════════════════════════════════════════════════

UPDATE vehicles v
JOIN (
  SELECT
    a.vehicle_id,
    ob.batch_id AS target_batch_id
  FROM tmp_assignments a
  -- match the correct open batch by rank (offset 0 = rank 1, offset 1 = rank 2, ...)
  JOIN tmp_open_batches ob
    ON ob.icdv_id    = a.icdv_id
   AND ob.vessel_id  = a.vessel_id
   AND ob.batch_rank = a.batch_offset + 1
) assign ON assign.vehicle_id = v.vehicle_id
SET
  v.batch_id        = assign.target_batch_id,
  v.workflow_status = 'batched',
  v.updated_at      = NOW();


-- ════════════════════════════════════════════════════════════
-- BLOCK 8 — UPDATE batches: recalculate vehicle_count + status
-- ════════════════════════════════════════════════════════════

UPDATE batches b
JOIN (
  SELECT batch_id, COUNT(*) AS cnt
  FROM vehicles
  WHERE batch_id IS NOT NULL
  GROUP BY batch_id
) counts ON counts.batch_id = b.batch_id
SET
  b.vehicle_count = counts.cnt,
  b.status        = CASE
                      WHEN counts.cnt >= 20 THEN 'full'
                      ELSE 'open'
                    END,
  b.updated_at    = NOW();


-- ════════════════════════════════════════════════════════════
-- BLOCK 9 — VERIFY RESULTS
-- ════════════════════════════════════════════════════════════

-- Confirm no discharged vehicles remain unassigned
SELECT COUNT(*) AS still_unassigned
FROM vehicles
WHERE workflow_status = 'discharged'
  AND batch_id IS NULL;

-- Show all batches with their counts
SELECT
  b.batch_id,
  b.batch_number,
  b.status,
  b.vehicle_count,
  vs.name  AS vessel_name,
  ic.name  AS icdv_name
FROM batches b
JOIN vessels vs ON vs.vessel_id = b.vessel_id
JOIN icdvs   ic ON ic.icdv_id   = b.icdv_id
ORDER BY b.icdv_id, b.batch_id;


-- ════════════════════════════════════════════════════════════
-- BLOCK 10 — CLEANUP TEMP TABLES
-- ════════════════════════════════════════════════════════════

DROP TEMPORARY TABLE IF EXISTS tmp_discharged;
DROP TEMPORARY TABLE IF EXISTS tmp_existing_counts;
DROP TEMPORARY TABLE IF EXISTS tmp_assignments;
DROP TEMPORARY TABLE IF EXISTS tmp_open_batches;