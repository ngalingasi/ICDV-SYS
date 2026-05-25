// Unified spreadsheet parser — handles CSV, XLSX, XLS via the xlsx package
const XLSX = (() => { try { return require('xlsx'); } catch { return null; } })();

const HEADER_MAP = {
  // B/L — Bill of Lading
  'm_b_l_no':'bill_of_lading_no','mbl_no':'bill_of_lading_no','bl_no':'bill_of_lading_no',
  'b_l_no':'bill_of_lading_no','bill_of_lading':'bill_of_lading_no','bill_of_lading_no':'bill_of_lading_no',
  'm_bl_no':'bill_of_lading_no','mbl':'bill_of_lading_no',
  // CSV header: "Bill of Lading*"
  'bill_of_lading':'bill_of_lading_no',

  // Chassis / Unit ID
  'chassis_no':'chassis_no','chassis_number':'chassis_no','chassis':'chassis_no','vin':'chassis_no',
  // CSV header: "Unit ID (RoRo)*"
  'unit_id_roro':'chassis_no','unit_id':'chassis_no',

  // Vessel visit
  // CSV header: "Vessel Visit"
  'vessel_visit':'vessel_visit',

  // Marks and numbers (bulk/break bulk)
  // CSV header: "Marks and Numbers (Bulk/Break Bulk)"
  'marks_and_numbers_bulkbreak_bulk':'marks_and_numbers',
  'marks_and_numbers':'marks_and_numbers',
  'marks_numbers':'marks_and_numbers',

  // Driver Licence — manifest-level, NOT linked to drivers table
  // CSV header: "Driver Licence#*"
  'driver_licence':'manifest_driver_license',
  'driver_license':'manifest_driver_license',
  'driver_licence_no':'manifest_driver_license',
  'driver_license_no':'manifest_driver_license',

  // Driver Name — manifest-level
  // CSV header: "Driver Name*"
  'driver_name':'manifest_driver_name',

  // Driver Contact — manifest-level
  // CSV header: "Driver Contact"
  'driver_contact':'manifest_driver_contact',

  // Quantity
  'quantity':'quantity','qty':'quantity',

  // Weight
  'weight_kg':'weight_kg','weight':'weight_kg',

  // Volume
  'volume_cbm':'volume_cbm','volume':'volume_cbm',

  // Reference number
  // CSV header: "Reference #*"  → normalises to "reference_"
  'reference':'reference_no','reference_no':'reference_no','ref_no':'reference_no',
  'reference_':'reference_no',

  // Self driven
  // CSV header: "Self Driven (Y/N) for RoRo*"
  'self_driven_yn_for_roro':'self_driven','self_driven_yn':'self_driven',
  'self_driven':'self_driven','self_driven_y_n_for_roro':'self_driven',

  // Truck number
  // CSV header: "Truck #"  → normalises to "truck_"
  'truck':'truck_no','truck_no':'truck_no',
  'truck_':'truck_no',

  // Transport company
  // CSV header: "Transport Company Name"
  'transport_company_name':'transport_company','transport_company':'transport_company',

  // Declaration number
  // CSV header: "Declaration #*"  → normalises to "declaration_"
  'declaration':'declaration_no','declaration_no':'declaration_no',
  'declaration_':'declaration_no',

  // Trip number
  // CSV header: "Trip #*"  → normalises to "trip_"
  'trip':'trip_no','trip_no':'trip_no',
  'trip_':'trip_no',

  // Terminal gate number
  // CSV header: "Terminal Gate #*"  → normalises to "terminal_gate_"
  'terminal_gate':'terminal_gate_no','terminal_gate_no':'terminal_gate_no',
  'terminal_gate_':'terminal_gate_no',

  // Destination variants
  'place_of_destination':'destination','destination':'destination','dest':'destination',

  // Delivery variants
  'place_of_delivery':'delivery_location','delivery_location':'delivery_location',
  'delivery':'delivery_location','delivery_address':'delivery_location',
};

const normaliseKey = (h) =>
  String(h).trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

const parseSpreadsheet = (buffer, mimetype) => {
  // Use xlsx for everything — it handles CSV, XLS, XLSX natively
  if (!XLSX) throw new Error('xlsx package not installed. Run: npm install xlsx');

  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to array of arrays (header + data rows)
  const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (raw.length < 2) return [];

  const headerRow = raw[0];
  const headers = headerRow.map(normaliseKey);

  const rows = [];
  for (let i = 1; i < raw.length; i++) {
    const vals = raw[i];
    // Skip completely empty rows
    if (vals.every(v => !String(v).trim())) continue;
    const row = { _rowNum: i + 1 };
    headers.forEach((h, idx) => {
      const mappedKey = HEADER_MAP[h] || h;
      const val = vals[idx];
      row[mappedKey] = val !== undefined && val !== null ? String(val).trim() : '';
    });
    rows.push(row);
  }
  return rows;
};

// Legacy alias kept for backward compatibility
const parseCSV = (buffer, mimetype) => parseSpreadsheet(buffer, mimetype);

const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const manifestModel = require('../models/manifest.model');
const ApiError = require('../utils/ApiError');



const createManifest     = catchAsync(async (req, res) => { res.status(httpStatus.CREATED).json(await manifestModel.createManifest(req.body, req.user.user_id, req.icdvId)); });
const getNextNumber      = catchAsync(async (req, res) => { res.json({ manifest_number: await manifestModel.generateManifestNumber(req.icdvId) }); });
const getManifests       = catchAsync(async (req, res) => { res.json(await manifestModel.getManifests(req.query, req.icdvId)); });
const getManifest        = catchAsync(async (req, res) => { res.json(await manifestModel.getManifestById(Number(req.params.manifestId), req.icdvId)); });
const updateManifest     = catchAsync(async (req, res) => { res.json(await manifestModel.updateManifest(Number(req.params.manifestId), req.body, req.user.user_id, req.icdvId)); });
const deleteManifest     = catchAsync(async (req, res) => { await manifestModel.deleteManifest(Number(req.params.manifestId), req.icdvId); res.status(httpStatus.NO_CONTENT).send(); });

const previewCSV = catchAsync(async (req, res) => {
  if (!req.file) throw new ApiError(httpStatus.BAD_REQUEST, 'No file uploaded');
  const rows = parseSpreadsheet(req.file.buffer, req.file.mimetype);
  if (!rows.length) throw new ApiError(httpStatus.BAD_REQUEST, 'File is empty or has no data rows');
  const seen = new Set(); const inFileDupes = [];
  rows.forEach(r => { const c = (r.chassis_no || '').trim(); if (c) { if (seen.has(c)) inFileDupes.push(c); else seen.add(c); } });
  res.json({ total: rows.length, rows, in_file_duplicates: inFileDupes });
});

const importVehicles = catchAsync(async (req, res) => {
  if (!req.file) throw new ApiError(httpStatus.BAD_REQUEST, 'No file uploaded');
  const rows = parseSpreadsheet(req.file.buffer, req.file.mimetype);
  if (!rows.length) throw new ApiError(httpStatus.BAD_REQUEST, 'File is empty');
  res.json(await manifestModel.importVehicles(Number(req.params.manifestId), rows, req.user.user_id, req.icdvId));
});

module.exports = { createManifest, getNextNumber, getManifests, getManifest, updateManifest, deleteManifest, previewCSV, importVehicles };
