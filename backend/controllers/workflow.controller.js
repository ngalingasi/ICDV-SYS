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
 * MIGRATION 008 ADDITIONS:
 *   updateBatchStatus  — PATCH /batches/:batchId/status
 *   getBatchPrint      — GET  /batches/:batchId/print
 *   getTpaStats        — GET  /transfer/tpa-stats
 */
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const wf         = require('../models/workflow.model');
const { query }  = require('../config/database');
const {
  BATCH_DOCUMENT_STATUSES,
  BATCH_GC_STATUSES,
} = require('../config/statuses');

/**
 * For cross-tenant users (super_admin / system_admin), resolve the effective
 * icdvId from the vehicle record when req.icdvId is null.
 */
const resolveEffectiveIcdvId = async (reqIcdvId, vehicleId) => {
  if (reqIcdvId !== null) return reqIcdvId;
  if (!vehicleId) return null;
  const [row] = await query('SELECT icdv_id FROM vehicles WHERE vehicle_id=?', [vehicleId]);
  return row ? row.icdv_id : null;
};

// ─── 1. DISCHARGE ─────────────────────────────────────────────────────────────

const dischargeLookup = catchAsync(async (req, res) => {
  const { chassis } = req.query;
  if (!chassis || chassis.trim().length < 4)
    return res.status(400).json({ message: 'Please enter at least 4 chassis digits' });
  const vehicle = await wf.lookupForDischarge(chassis.trim(), req.icdvId);
  res.json(vehicle);
});

const dischargeConfirm = catchAsync(async (req, res) => {
  const { vehicle_id, notes } = req.body;
  if (!vehicle_id) return res.status(400).json({ message: 'vehicle_id is required' });
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

// ─── 2b. BATCH STATUS (migration 008) ─────────────────────────────────────────

/**
 * PATCH /workflow/batches/:batchId/status
 * Body: { document_status?, document_remark?, gc_status?, gc_remark? }
 * Right: updateBatchStatus
 *
 * Updates document_status and/or gc_status on the batch.
 * operational_status is auto-computed by the model.
 */
const updateBatchStatus = catchAsync(async (req, res) => {
  const batchId = Number(req.params.batchId);
  if (!batchId) return res.status(400).json({ message: 'batchId is required' });

  const { document_status, document_remark, gc_status, gc_remark } = req.body;

  // At least one status field must be provided
  if (document_status === undefined && gc_status === undefined) {
    return res.status(400).json({
      message: `At least one of document_status or gc_status is required. ` +
               `Allowed values — document_status: ${Object.values(BATCH_DOCUMENT_STATUSES).join(', ')}; ` +
               `gc_status: ${Object.values(BATCH_GC_STATUSES).join(', ')}`,
    });
  }

  const result = await wf.updateBatchStatus(
    batchId,
    { document_status, document_remark, gc_status, gc_remark },
    req.user.user_id,
    req.icdvId
  );
  res.json(result);
});

// ─── 2c. BATCH PRINT (migration 008) ──────────────────────────────────────────

/**
 * GET /workflow/batches/:batchId/print
 * Right: printBatches
 *
 * Returns full batch data + chassis/vehicle list for printable view.
 * This is DIFFERENT from delivery-sheet (which shows driver assignments).
 */
const getBatchPrint = catchAsync(async (req, res) => {
  const batchId = Number(req.params.batchId);
  if (!batchId) return res.status(400).json({ message: 'batchId is required' });
  const data = await wf.getBatchPrintData(batchId, req.icdvId);
  res.json(data);
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
  const effectiveIcdvId = req.icdvId ?? (vehicle_icdv_id ? Number(vehicle_icdv_id) : null);
  const driver = await wf.lookupDriverByIdCard(id_card.trim(), effectiveIcdvId);
  res.json(driver);
});

/**
 * POST /workflow/transfer/confirm
 * Passes req.user to model so canBypassBatchGate() can be evaluated.
 */
const transferConfirm = catchAsync(async (req, res) => {
  const { vehicle_id, driver_id, driver_id_card, notes } = req.body;
  if (!vehicle_id) return res.status(400).json({ message: 'vehicle_id is required' });
  // driver_id and driver_id_card are now optional — a vehicle can be transferred
  // without assigning a specific ICDV driver (e.g. external/unregistered driver)
  const effectiveIcdvId = await resolveEffectiveIcdvId(req.icdvId, Number(vehicle_id));
  const result = await wf.confirmTransfer(
    Number(vehicle_id),
    driver_id ? Number(driver_id) : null,
    driver_id_card ? driver_id_card.trim() : null,
    notes || null, req.user.user_id, effectiveIcdvId,
    req.user  // passed for batch gate bypass check
  );
  res.json(result);
});

// ─── 3b. TPA STATS (migration 008) ────────────────────────────────────────────

/**
 * GET /workflow/transfer/tpa-stats
 * Right: viewTpaStats
 *
 * Returns count of vehicles currently at TPA gate / in_transit,
 * transferred today, and per-batch breakdown.
 */
const getTpaStats = catchAsync(async (req, res) => {
  const stats = await wf.getTpaStats(req.icdvId);
  res.json(stats);
});

// ─── 4. RECEIVE ───────────────────────────────────────────────────────────────

const receiveLookup = catchAsync(async (req, res) => {
  const { id_card } = req.query;
  if (!id_card || !id_card.trim())
    return res.status(400).json({ message: 'id_card is required' });
  const result = await wf.lookupForReceive(id_card.trim(), req.icdvId);
  res.json(result);
});

const receiveConfirm = catchAsync(async (req, res) => {
  const { driver_id, vehicle_id, notes } = req.body;
  // vehicle_id is always required; driver_id is optional (may be null if no driver was assigned)
  if (!vehicle_id) return res.status(400).json({ message: 'vehicle_id is required' });
  const effectiveIcdvId = await resolveEffectiveIcdvId(req.icdvId, Number(vehicle_id));
  const result = await wf.confirmReceive(
    driver_id ? Number(driver_id) : null, Number(vehicle_id), notes || null, req.user.user_id, effectiveIcdvId
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
  // Discharge
  dischargeLookup, dischargeConfirm,
  // Batch
  batchLookup, batchConfirm, listBatches, getBatchDetail,
  // Batch status + print (migration 008)
  updateBatchStatus, getBatchPrint,
  // Transfer
  transferLookup, driverLookup, transferConfirm,
  // TPA stats (migration 008)
  getTpaStats,
  // Receive
  receiveLookup, receiveConfirm,
  // Search & history
  chassisSearch, vehicleHistory,
};
