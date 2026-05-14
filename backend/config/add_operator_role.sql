-- ============================================================
-- MIGRATION: Add operator_role to vehicle_operations
-- Run this to fix: Unknown column 'operator_role' in 'field list'
-- Safe to run multiple times (IF NOT EXISTS).
-- ============================================================

ALTER TABLE vehicle_operations
  ADD COLUMN IF NOT EXISTS operator_role VARCHAR(30) NULL DEFAULT NULL
  AFTER performed_by;
