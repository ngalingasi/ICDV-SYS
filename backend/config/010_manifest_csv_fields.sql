-- ============================================================
-- MIGRATION 010: Manifest CSV Import Fields
-- Adds all columns from the port manifest CSV format to vehicles.
--
-- These fields are imported from the official vessel manifest CSV
-- and stored as-is. They are informational — driver fields here
-- are NOT linked to the drivers table (manifest driver ≠ ICDV driver).
--
-- All columns are nullable. No existing data is affected.
-- ============================================================

-- Vessel visit reference from the CSV header
ALTER TABLE vehicles
  ADD COLUMN  vessel_visit        VARCHAR(100) NULL AFTER bill_of_lading_no;

-- Marks and numbers (bulk/break bulk identifier)
ALTER TABLE vehicles
  ADD COLUMN  marks_and_numbers   VARCHAR(200) NULL AFTER vessel_visit;

-- Manifest driver details — stored verbatim, NOT linked to drivers table
-- Driver can be null (self-driven vehicles etc.)
ALTER TABLE vehicles
  ADD COLUMN  manifest_driver_license  VARCHAR(100) NULL AFTER marks_and_numbers;

ALTER TABLE vehicles
  ADD COLUMN  manifest_driver_name     VARCHAR(200) NULL AFTER manifest_driver_license;

ALTER TABLE vehicles
  ADD COLUMN  manifest_driver_contact  VARCHAR(100) NULL AFTER manifest_driver_name;

-- Cargo / logistics fields
ALTER TABLE vehicles
  ADD COLUMN  quantity            SMALLINT     NULL AFTER manifest_driver_contact;

ALTER TABLE vehicles
  ADD COLUMN  weight_kg           DECIMAL(10,3) NULL AFTER quantity;

ALTER TABLE vehicles
  ADD COLUMN  volume_cbm          DECIMAL(10,3) NULL AFTER weight_kg;

ALTER TABLE vehicles
  ADD COLUMN  reference_no        VARCHAR(100) NULL AFTER volume_cbm;

ALTER TABLE vehicles
  ADD COLUMN  self_driven         VARCHAR(10)  NULL AFTER reference_no;

ALTER TABLE vehicles
  ADD COLUMN  truck_no            VARCHAR(100) NULL AFTER self_driven;

ALTER TABLE vehicles
  ADD COLUMN  transport_company   VARCHAR(200) NULL AFTER truck_no;

ALTER TABLE vehicles
  ADD COLUMN  declaration_no      VARCHAR(100) NULL AFTER transport_company;

ALTER TABLE vehicles
  ADD COLUMN  trip_no             VARCHAR(50)  NULL AFTER declaration_no;

ALTER TABLE vehicles
  ADD COLUMN  terminal_gate_no    VARCHAR(50)  NULL AFTER trip_no;
