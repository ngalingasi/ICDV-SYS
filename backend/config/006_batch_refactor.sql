-- ============================================================
-- MIGRATION 006: Batch Logic Refactor
-- Removes date-based batch assignment.
-- Batches now persist across days — close only when full (20).
-- Run ONCE. Safe on existing data.
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. Extend status ENUM to include 'full' ───────────────────────────────────
-- 'open'        → accepting vehicles (< 20)
-- 'full'        → reached 20 vehicles, no longer accepts
-- 'closed'      → manually or system finalised
-- 'transferred' → all vehicles in batch have been transferred
ALTER TABLE batches
  MODIFY COLUMN status
    ENUM('open', 'full', 'closed', 'transferred')
    NOT NULL DEFAULT 'open';

-- ── 2. batch_date is now informational only (creation date) ───────────────────
-- It stays in the table for audit/display but is NO LONGER used in queries
-- to find the active batch. Remove the index that suggested date-based lookup.
ALTER TABLE batches DROP INDEX IF EXISTS idx_batch_date;

-- ── 3. Update any existing batches that are at 20 vehicles to status='full' ───
UPDATE batches SET status = 'full' WHERE vehicle_count >= 20 AND status = 'open';

-- ── 4. Ensure there is never more than one 'open' batch per vessel per icdv ───
-- This unique partial index prevents duplicate open batches at the DB level.
-- (MySQL does not support partial indexes natively, so we enforce via app logic.)
-- No DDL change needed here — enforced in addToBatch transaction.

SET FOREIGN_KEY_CHECKS = 1;
