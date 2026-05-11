const httpStatus = require('http-status');
const fs = require('fs');
const path = require('path');
const catchAsync = require('../utils/catchAsync');
const manifestModel = require('../models/manifest.model');
const ApiError = require('../utils/ApiError');

// Parse CSV buffer → array of row objects
const parseCSV = (buffer) => {
  const text = buffer.toString('utf8');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Normalize header: trim + lowercase + replace spaces/special chars with _
  const headers = lines[0].split(',').map(h =>
    h.trim().toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
  );

  // Map CSV headers to our field names
  const headerMap = {
    'm_b_l_no':          'bill_of_lading_no',
    'mbl_no':            'bill_of_lading_no',
    'bl_no':             'bill_of_lading_no',
    'bill_of_lading':    'bill_of_lading_no',
    'chassis_no':        'chassis_no',
    'chassis_number':    'chassis_no',
    'place_of_destination': 'destination',
    'destination':       'destination',
    'place_of_delivery': 'delivery_location',
    'delivery_location': 'delivery_location',
    'delivery':          'delivery_location',
  };

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (vals.every(v => !v)) continue; // skip fully empty rows
    const row = { _rowNum: i + 1 };
    headers.forEach((h, idx) => {
      const mapped = headerMap[h] || h;
      row[mapped] = vals[idx] ?? '';
    });
    rows.push(row);
  }
  return rows;
};

const createManifest = catchAsync(async (req, res) => {
  const manifest = await manifestModel.createManifest(req.body, req.user.user_id);
  res.status(httpStatus.CREATED).json(manifest);
});

// GET /manifests/next-number
const getNextNumber = catchAsync(async (req, res) => {
  const manifest_number = await manifestModel.generateManifestNumber();
  res.json({ manifest_number });
});

const getManifests = catchAsync(async (req, res) => {
  const result = await manifestModel.getManifests(req.query);
  res.json(result);
});

const getManifest = catchAsync(async (req, res) => {
  const manifest = await manifestModel.getManifestById(Number(req.params.manifestId));
  res.json(manifest);
});

const updateManifest = catchAsync(async (req, res) => {
  const manifest = await manifestModel.updateManifest(
    Number(req.params.manifestId), req.body, req.user.user_id
  );
  res.json(manifest);
});

const deleteManifest = catchAsync(async (req, res) => {
  await manifestModel.deleteManifest(Number(req.params.manifestId));
  res.status(httpStatus.NO_CONTENT).send();
});

// POST /manifests/:manifestId/preview-csv  — parse & return rows without saving
const previewCSV = catchAsync(async (req, res) => {
  if (!req.file) throw new ApiError(httpStatus.BAD_REQUEST, 'No CSV file uploaded');
  const rows = parseCSV(req.file.buffer);
  if (!rows.length) throw new ApiError(httpStatus.BAD_REQUEST, 'CSV is empty or has no data rows');

  // Check for duplicates within the file itself
  const seen = new Set();
  const inFileDupes = [];
  rows.forEach(r => {
    const c = (r.chassis_no || '').trim();
    if (c) {
      if (seen.has(c)) inFileDupes.push(c);
      else seen.add(c);
    }
  });

  res.json({ total: rows.length, rows, in_file_duplicates: inFileDupes });
});

// POST /manifests/:manifestId/import-vehicles
const importVehicles = catchAsync(async (req, res) => {
  if (!req.file) throw new ApiError(httpStatus.BAD_REQUEST, 'No CSV file uploaded');
  const rows = parseCSV(req.file.buffer);
  if (!rows.length) throw new ApiError(httpStatus.BAD_REQUEST, 'CSV is empty');
  const result = await manifestModel.importVehicles(
    Number(req.params.manifestId), rows, req.user.user_id
  );
  res.json(result);
});

module.exports = {
  createManifest, getNextNumber, getManifests, getManifest,
  updateManifest, deleteManifest, previewCSV, importVehicles,
};
