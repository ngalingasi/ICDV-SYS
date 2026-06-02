/**
 * deliverySheet.controller.js
 *
 * GET /api/v1/workflow/batches/:batchId/delivery-sheet
 *   → Single-batch delivery sheet (preserved)
 *
 * GET /api/v1/workflow/vessels/:vesselId/delivery-sheet
 *   → All batches for a vessel (legacy, preserved)
 *
 * GET /api/v1/manifests/:manifestId/delivery-sheet   ← NEW
 *   → Full manifest delivery sheet, grouped by batch
 */
const catchAsync         = require('../utils/catchAsync');
const deliverySheetModel = require('../models/deliverySheet.model');

// ── Batch-level (existing) ────────────────────────────────────────────────────
const getBatchDeliverySheet = catchAsync(async (req, res) => {
  const data = await deliverySheetModel.getDeliverySheetData(
    Number(req.params.batchId),
    req.icdvId
  );
  res.json(data);
});

// ── Vessel-level (legacy) ─────────────────────────────────────────────────────
const getVesselDeliverySheet = catchAsync(async (req, res) => {
  const data = await deliverySheetModel.getDeliverySheetsByVessel(
    Number(req.params.vesselId),
    req.icdvId
  );
  res.json(data);
});

// ── Manifest-level (new primary) ──────────────────────────────────────────────
const getManifestDeliverySheet = catchAsync(async (req, res) => {
  const data = await deliverySheetModel.getManifestDeliverySheet(
    Number(req.params.manifestId),
    req.icdvId
  );
  res.json(data);
});

// ── Manifest combined (new) — all batches merged into single view ─────────────
const getCombinedDeliverySheet = catchAsync(async (req, res) => {
  const data = await deliverySheetModel.getCombinedDeliverySheet(
    Number(req.params.manifestId),
    req.icdvId
  );
  res.json(data);
});

module.exports = {
  getBatchDeliverySheet,
  getVesselDeliverySheet,
  getManifestDeliverySheet,
  getCombinedDeliverySheet,
};
