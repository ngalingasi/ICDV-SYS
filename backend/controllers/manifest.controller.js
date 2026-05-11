const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const manifestModel = require('../models/manifest.model');
const ApiError = require('../utils/ApiError');

const parseCSV = (buffer) => {
  const text = buffer.toString('utf8');
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h =>
    h.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
  );
  const headerMap = {
    'm_b_l_no':'bill_of_lading_no','mbl_no':'bill_of_lading_no','bl_no':'bill_of_lading_no',
    'bill_of_lading':'bill_of_lading_no','chassis_no':'chassis_no','chassis_number':'chassis_no',
    'place_of_destination':'destination','destination':'destination',
    'place_of_delivery':'delivery_location','delivery_location':'delivery_location','delivery':'delivery_location',
  };
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    if (vals.every(v => !v)) continue;
    const row = { _rowNum: i + 1 };
    headers.forEach((h, idx) => { row[headerMap[h] || h] = vals[idx] ?? ''; });
    rows.push(row);
  }
  return rows;
};

const createManifest     = catchAsync(async (req, res) => { res.status(httpStatus.CREATED).json(await manifestModel.createManifest(req.body, req.user.user_id, req.icdvId)); });
const getNextNumber      = catchAsync(async (req, res) => { res.json({ manifest_number: await manifestModel.generateManifestNumber(req.icdvId) }); });
const getManifests       = catchAsync(async (req, res) => { res.json(await manifestModel.getManifests(req.query, req.icdvId)); });
const getManifest        = catchAsync(async (req, res) => { res.json(await manifestModel.getManifestById(Number(req.params.manifestId), req.icdvId)); });
const updateManifest     = catchAsync(async (req, res) => { res.json(await manifestModel.updateManifest(Number(req.params.manifestId), req.body, req.user.user_id, req.icdvId)); });
const deleteManifest     = catchAsync(async (req, res) => { await manifestModel.deleteManifest(Number(req.params.manifestId), req.icdvId); res.status(httpStatus.NO_CONTENT).send(); });

const previewCSV = catchAsync(async (req, res) => {
  if (!req.file) throw new ApiError(httpStatus.BAD_REQUEST, 'No CSV file uploaded');
  const rows = parseCSV(req.file.buffer);
  if (!rows.length) throw new ApiError(httpStatus.BAD_REQUEST, 'CSV is empty or has no data rows');
  const seen = new Set(); const inFileDupes = [];
  rows.forEach(r => { const c = (r.chassis_no || '').trim(); if (c) { if (seen.has(c)) inFileDupes.push(c); else seen.add(c); } });
  res.json({ total: rows.length, rows, in_file_duplicates: inFileDupes });
});

const importVehicles = catchAsync(async (req, res) => {
  if (!req.file) throw new ApiError(httpStatus.BAD_REQUEST, 'No CSV file uploaded');
  const rows = parseCSV(req.file.buffer);
  if (!rows.length) throw new ApiError(httpStatus.BAD_REQUEST, 'CSV is empty');
  res.json(await manifestModel.importVehicles(Number(req.params.manifestId), rows, req.user.user_id, req.icdvId));
});

module.exports = { createManifest, getNextNumber, getManifests, getManifest, updateManifest, deleteManifest, previewCSV, importVehicles };
