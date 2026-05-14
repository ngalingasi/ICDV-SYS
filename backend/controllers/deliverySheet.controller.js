/**
 * deliverySheet.controller.js
 *
 * GET /api/v1/workflow/batches/:batchId/delivery-sheet
 *   → Returns delivery sheet data for a single batch
 *
 * GET /api/v1/workflow/vessels/:vesselId/delivery-sheet
 *   → Returns delivery sheet data for all batches in a vessel
 */
const catchAsync = require('../utils/catchAsync');
const deliverySheetModel = require('../models/deliverySheet.model');

const getBatchDeliverySheet = catchAsync(async (req, res) => {
  const data = await deliverySheetModel.getDeliverySheetData(
    Number(req.params.batchId),
    req.icdvId
  );
  res.json(data);
});

const getVesselDeliverySheet = catchAsync(async (req, res) => {
  const data = await deliverySheetModel.getDeliverySheetsByVessel(
    Number(req.params.vesselId),
    req.icdvId
  );
  res.json(data);
});

module.exports = { getBatchDeliverySheet, getVesselDeliverySheet };
