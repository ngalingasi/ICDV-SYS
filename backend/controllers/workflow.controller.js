/**
 * workflow.controller.js
 *
 * TENANT RESOLUTION STRATEGY
 * ──────────────────────────
 * - ICDV users: req.icdvId is set from their JWT → passed directly to model
 *
 * - Super admin / system_admin: req.icdvId is null (no fixed tenant).
 *   · LOOKUP endpoints: pass null → model does cross-tenant chassis search
 *     and returns vehicle.icdv_id in the response.
 *   · CONFIRM endpoints: read vehicle_icdv_id from req.body (sent by frontend
 *     after the lookup step) OR re-derive it from the vehicle_id directly.
 *     The model also guards against cross-ICDV leakage internally.
 *
 * The frontend lookup response always includes icdv_id on the vehicle object.
 * The frontend must include that icdv_id in the confirm request body.
 */
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const wf         = require('../models/workflow.model');
const { query }  = require('../config/database');

/**
 * For cross-tenant users (super_admin / system_admin), resolve the effective
 * icdvId from the vehicle record when req.icdvId is null.
 * This is the authoritative source — the client-supplied vehicle_icdv_id is
 * only a hint; the real icdv_id always comes from the DB.
 */
const resolveEffectiveIcdvId = async (reqIcdvId, vehicleId) => {
  if (reqIcdvId !== null) return reqIcdvId; // regular ICDV user — already scoped
  if (!vehicleId) return null;
  const [row] = await query('SELECT icdv_id FROM vehicles WHERE vehicle_id=?', [vehicleId]);
  return row ? row.icdv_id : null;
};

// ─── 1. DISCHARGE ─────────────────────────────────────────────────────────────

const dischargeLookup = catchAsync(async (req, res) => {
  const { chassis } = req.query;
  if (!chassis || chassis.trim().length < 4)
    return res.status(400).json({ message: 'Please enter at least 4 chassis digits' });
  // Pass req.icdvId — null for super/system admin → cross-tenant search in model
  const vehicle = await wf.lookupForDischarge(chassis.trim(), req.icdvId);
  res.json(vehicle);
});

const dischargeConfirm = catchAsync(async (req, res) => {
  const { vehicle_id, notes } = req.body;
  if (!vehicle_id) return res.status(400).json({ message: 'vehicle_id is required' });
  // For cross-tenant users: resolve icdvId from the vehicle record
  const effectiveIcdvId = await resolveEffectiveIcdvId(req.icdvId, Number(vehicle_id));
  const result = await wf.discharge(Number(vehicle_id), notes || null, req.user.user_id, effectiveIcdvId);
  res.json(result);
});

// ─── 2. BATCH ─────────────────────────────────────────────────────────────────

const batchLookup = catchAsync(async (req, res) => {
  const { chassis } = req.query;
  if (!chassis || chassis.trim().length < 4)
    return res.status(400).json({ message: 'Please enter at least 4 chassis digits' });
  const vehicle = await wf.lookupForBatch(chassis.trim(), req.icdvId);
  res.json(vehicle);
});

const batchConfirm = catchAsync(async (req, res) => {
  const { vehicle_id, notes } = req.body;
  if (!vehicle_id) return res.status(400).json({ message: 'vehicle_id is required' });
  const effectiveIcdvId = await resolveEffectiveIcdvId(req.icdvId, Number(vehicle_id));
  const result = await wf.addToBatch(Number(vehicle_id), notes || null, req.user.user_id, effectiveIcdvId);
  res.json(result);
});

const listBatches = catchAsync(async (req, res) => {
  res.json(await wf.getBatches(req.query, req.icdvId));
});

const getBatchDetail = catchAsync(async (req, res) => {
  res.json(await wf.getBatch(Number(req.params.batchId), req.icdvId));
});

// ─── 3. TRANSFER ──────────────────────────────────────────────────────────────

const transferLookup = catchAsync(async (req, res) => {
  const { chassis } = req.query;
  if (!chassis || chassis.trim().length < 4)
    return res.status(400).json({ message: 'Please enter at least 4 chassis digits' });
  const vehicle = await wf.lookupForTransfer(chassis.trim(), req.icdvId);
  res.json(vehicle);
});

const driverLookup = catchAsync(async (req, res) => {
  const { id_card, vehicle_icdv_id } = req.query;
  if (!id_card || !id_card.trim())
    return res.status(400).json({ message: 'id_card is required' });
  // For cross-tenant users: scope driver lookup to the vehicle's ICDV
  const effectiveIcdvId = req.icdvId ?? (vehicle_icdv_id ? Number(vehicle_icdv_id) : null);
  const driver = await wf.lookupDriverByIdCard(id_card.trim(), effectiveIcdvId);
  res.json(driver);
});

const transferConfirm = catchAsync(async (req, res) => {
  const { vehicle_id, driver_id, driver_id_card, notes } = req.body;
  if (!vehicle_id)     return res.status(400).json({ message: 'vehicle_id is required' });
  if (!driver_id)      return res.status(400).json({ message: 'driver_id is required' });
  if (!driver_id_card) return res.status(400).json({ message: 'driver_id_card is required' });
  const effectiveIcdvId = await resolveEffectiveIcdvId(req.icdvId, Number(vehicle_id));
  const result = await wf.confirmTransfer(
    Number(vehicle_id), Number(driver_id), driver_id_card.trim(),
    notes || null, req.user.user_id, effectiveIcdvId
  );
  res.json(result);
});

// ─── 4. RECEIVE ───────────────────────────────────────────────────────────────

const receiveLookup = catchAsync(async (req, res) => {
  const { id_card } = req.query;
  if (!id_card || !id_card.trim())
    return res.status(400).json({ message: 'id_card is required' });
  // Pass req.icdvId — model handles null by searching drivers globally
  const result = await wf.lookupForReceive(id_card.trim(), req.icdvId);
  res.json(result);
});

const receiveConfirm = catchAsync(async (req, res) => {
  const { driver_id, vehicle_id, notes } = req.body;
  if (!driver_id)  return res.status(400).json({ message: 'driver_id is required' });
  if (!vehicle_id) return res.status(400).json({ message: 'vehicle_id is required' });
  const effectiveIcdvId = await resolveEffectiveIcdvId(req.icdvId, Number(vehicle_id));
  const result = await wf.confirmReceive(
    Number(driver_id), Number(vehicle_id), notes || null, req.user.user_id, effectiveIcdvId
  );
  res.json(result);
});

// ─── 5. SEARCH & HISTORY ──────────────────────────────────────────────────────

const chassisSearch = catchAsync(async (req, res) => {
  const { chassis } = req.query;
  if (!chassis || chassis.trim().length < 3)
    return res.status(400).json({ message: 'Please enter at least 3 chassis characters' });
  const results = await wf.searchChassis(chassis.trim(), req.icdvId);
  res.json(results);
});

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
