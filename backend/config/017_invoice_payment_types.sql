-- ============================================================
-- Migration 017: Distinguish Payment Evidence from Payment Receipt
--
-- invoice_payments previously stored one undifferentiated upload type.
-- Two distinct documents now share the table, distinguished by
-- `document_type`:
--   - 'evidence' — uploaded by the ICDV cashier as proof of payment
--                  (e.g. bank transfer slip) when marking an invoice paid
--   - 'receipt'  — uploaded by super_admin as the official receipt
--                  issued back to the ICDV confirming the payment
-- ============================================================

ALTER TABLE `invoice_payments`
  ADD COLUMN IF NOT EXISTS `document_type` ENUM('evidence','receipt') NOT NULL DEFAULT 'evidence'
    COMMENT 'evidence = cashier-uploaded proof of payment, receipt = super_admin-issued receipt'
    AFTER `invoice_id`;

-- Backfill existing rows (all prior uploads were the cashier-side "evidence")
UPDATE `invoice_payments` SET `document_type` = 'evidence' WHERE `document_type` IS NULL;

CREATE INDEX IF NOT EXISTS `idx_invoice_payments_type` ON `invoice_payments` (`document_type`);
