-- ============================================================
-- Migration 021: Expense Line Items — Shift Count (numeric multiplier)
--
-- `shift_number` was a free-text label (e.g. "Shift 1") with no bearing
-- on the line total. It's now `shift_count` — a numeric multiplier, so
-- that line_total = unit_price * quantity * shift_count.
--
-- Example: paying drivers TZS 20,000/shift, 2 drivers, 3 shifts each:
--   unit_price=20000, quantity=2, shift_count=3 -> total = 120,000
--
-- Defaults to 1 so existing line items (and items that don't involve
-- shifts, e.g. a flat fixed fee) keep their current total unchanged.
-- ============================================================

ALTER TABLE `expense_line_items`
  CHANGE `shift_number` `shift_count`
  DECIMAL(10,2) NOT NULL DEFAULT 1
  COMMENT 'Number of shifts — multiplies into line_total (unit_price * quantity * shift_count)';

-- Backfill: any existing row that had a non-numeric label is reset to 1
-- (the safe default — does not change historical totals retroactively).
UPDATE `expense_line_items` SET `shift_count` = 1 WHERE `shift_count` <= 0;
