// Unified spreadsheet parser — handles CSV, XLSX, XLS via the xlsx package
const XLSX = (() => { try { return require('xlsx'); } catch { return null; } })();

const HEADER_MAP = {
  // B/L variants
  'm_b_l_no':'bill_of_lading_no','mbl_no':'bill_of_lading_no','bl_no':'bill_of_lading_no',
  'b_l_no':'bill_of_lading_no','bill_of_lading':'bill_of_lading_no','bill_of_lading_no':'bill_of_lading_no',
  'm_bl_no':'bill_of_lading_no','mbl':'bill_of_lading_no',
  // Chassis variants
  'chassis_no':'chassis_no','chassis_number':'chassis_no','chassis':'chassis_no','vin':'chassis_no',
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
