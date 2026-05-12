/**
 * workflow.controller.js
 * All 5 workflow steps + search.
 * Follows existing catchAsync + res.json() + ApiError pattern.
 */
const httpStatus  = require('http-status');
const catchAsync  = require('../utils/catchAsync');
const wf          = require('../models/workflow.model');

// ─── 1. DISCHARGE ─────────────────────────────────────────────────────────────

/** GET /workflow/discharge/lookup?chassis=XXXX */
const dischargeLookup = catchAsync(async (req, res) => {
  const { chassis } = req.query;
  if (!chassis || chassis.trim().length < 4)
    return res.status(400).json({ message: 'Please enter at least 4 chassis digits' });
  const vehicle = await wf.lookupForDischarge(chassis.trim(), req.icdvId);
  res.json(vehicle);
});

/** POST /workflow/discharge/confirm */
const dischargeConfirm = catchAsync(async (req, res) => {
  const { vehicle_id, notes } = req.body;
  if (!vehicle_id) return res.status(400).json({ message: 'vehicle_id is required' });
  const result = await wf.discharge(Number(vehicle_id), notes || null, req.user.user_id, req.icdvId);
  res.json(result);
});

// ─── 2. BATCH ─────────────────────────────────────────────────────────────────

/** GET /workflow/batch/lookup?chassis=XXXX */
const batchLookup = catchAsync(async (req, res) => {
  const { chassis } = req.query;
  if (!chassis || chassis.trim().length < 4)
    return res.status(400).json({ message: 'Please enter at least 4 chassis digits' });
  const vehicle = await wf.lookupForBatch(chassis.trim(), req.icdvId);
  res.json(vehicle);
});

/** POST /workflow/batch/confirm */
const batchConfirm = catchAsync(async (req, res) => {
  const { vehicle_id, notes } = req.body;
  if (!vehicle_id) return res.status(400).json({ message: 'vehicle_id is required' });
  const result = await wf.addToBatch(Number(vehicle_id), notes || null, req.user.user_id, req.icdvId);
  res.json(result);
});

/** GET /workflow/batches */
const listBatches = catchAsync(async (req, res) => {
  res.json(await wf.getBatches(req.query, req.icdvId));
});

/** GET /workflow/batches/:batchId */
const getBatchDetail = catchAsync(async (req, res) => {
  res.json(await wf.getBatch(Number(req.params.batchId), req.icdvId));
});

// ─── 3. TRANSFER ──────────────────────────────────────────────────────────────

/** GET /workflow/transfer/lookup?chassis=XXXX */
const transferLookup = catchAsync(async (req, res) => {
  const { chassis } = req.query;
  if (!chassis || chassis.trim().length < 4)
    return res.status(400).json({ message: 'Please enter at least 4 chassis digits' });
  const vehicle = await wf.lookupForTransfer(chassis.trim(), req.icdvId);
  res.json(vehicle);
});

/** GET /workflow/transfer/driver-lookup?id_card=XXXX */
const driverLookup = catchAsync(async (req, res) => {
  const { id_card } = req.query;
  if (!id_card || !id_card.trim())
    return res.status(400).json({ message: 'id_card is required' });
  const driver = await wf.lookupDriverByIdCard(id_card.trim(), req.icdvId);
  res.json(driver);
});

/** POST /workflow/transfer/confirm */
const transferConfirm = catchAsync(async (req, res) => {
  const { vehicle_id, driver_id, driver_id_card, notes } = req.body;
  if (!vehicle_id)     return res.status(400).json({ message: 'vehicle_id is required' });
  if (!driver_id)      return res.status(400).json({ message: 'driver_id is required' });
  if (!driver_id_card) return res.status(400).json({ message: 'driver_id_card is required' });
  const result = await wf.confirmTransfer(
    Number(vehicle_id), Number(driver_id), driver_id_card.trim(),
    notes || null, req.user.user_id, req.icdvId
  );
  res.json(result);
});

// ─── 4. RECEIVE ───────────────────────────────────────────────────────────────

/** GET /workflow/receive/lookup?id_card=XXXX */
const receiveLookup = catchAsync(async (req, res) => {
  const { id_card } = req.query;
  if (!id_card || !id_card.trim())
    return res.status(400).json({ message: 'id_card is required' });
  const result = await wf.lookupForReceive(id_card.trim(), req.icdvId);
  res.json(result);
});

/** POST /workflow/receive/confirm */
const receiveConfirm = catchAsync(async (req, res) => {
  const { driver_id, vehicle_id, notes } = req.body;
  if (!driver_id)  return res.status(400).json({ message: 'driver_id is required' });
  if (!vehicle_id) return res.status(400).json({ message: 'vehicle_id is required' });
  const result = await wf.confirmReceive(
    Number(driver_id), Number(vehicle_id), notes || null, req.user.user_id, req.icdvId
  );
  res.json(result);
});

// ─── 5. SEARCH ────────────────────────────────────────────────────────────────

/** GET /workflow/search?chassis=XXXX */
const chassisSearch = catchAsync(async (req, res) => {
  const { chassis } = req.query;
  if (!chassis || chassis.trim().length < 3)
    return res.status(400).json({ message: 'Please enter at least 3 chassis characters' });
  const results = await wf.searchChassis(chassis.trim(), req.icdvId);
  res.json(results);
});

/** GET /workflow/vehicles/:vehicleId/history */
const vehicleHistory = catchAsync(async (req, res) => {
  res.json(await wf.getVehicleHistory(Number(req.params.vehicleId), req.icdvId));
});

module.exports = {
  dischargeLookup, dischargeConfirm,
  batchLookup, batchConfirm, listBatches, getBatchDetail,
  transferLookup, driverLookup, transferConfirm,
  receiveLookup, receiveConfirm,
  chassisSearch, vehicleHistory,
};
