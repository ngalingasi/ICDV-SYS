-- ============================================================
-- Migration 018: Rename invoice status 'draft' -> 'invoiced'
--
-- A newly-created invoice (before the ICDV admin approves it) is now
-- called 'invoiced' rather than 'draft' — it has already been issued
-- to the ICDV, it just hasn't been approved/paid yet.
-- ============================================================

-- Update any existing rows first (status enum values are positional in
-- MySQL — updating before altering the enum avoids truncation warnings)
UPDATE `invoices` SET `status` = 'invoiced' WHERE `status` = 'draft';

ALTER TABLE `invoices`
  CHANGE `status` `status`
  ENUM('invoiced','approved','paid','cancelled')
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  NOT NULL DEFAULT 'invoiced';
