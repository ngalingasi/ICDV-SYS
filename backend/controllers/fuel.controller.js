const httpStatus  = require('http-status');
const catchAsync  = require('../utils/catchAsync');
const fuelModel   = require('../models/fuel.model');

// ── Fuel Orders ───────────────────────────────────────────────────────────────

const createOrder = catchAsync(async (req, res) => {
  const manifestId = Number(req.params.manifestId);
  const order = await fuelModel.createFuelOrder(
    manifestId, req.body, req.user.user_id, req.icdvId
  );
  res.status(httpStatus.CREATED).json(order);
});

const listOrders = catchAsync(async (req, res) => {
  const orders = await fuelModel.listFuelOrders(
    Number(req.params.manifestId), req.icdvId, req.query
  );
  res.json(orders);
});

const getOrder = catchAsync(async (req, res) => {
  const order = await fuelModel.getFuelOrder(Number(req.params.orderId), req.icdvId);
  res.json(order);
});

const approveOrder = catchAsync(async (req, res) => {
  const order = await fuelModel.approveOrder(
    Number(req.params.orderId),
    req.body.review_notes,
    req.user.user_id,
    req.icdvId
  );
  res.json(order);
});

const rejectOrder = catchAsync(async (req, res) => {
  const order = await fuelModel.rejectOrder(
    Number(req.params.orderId),
    req.body.review_notes,
    req.user.user_id,
    req.icdvId
  );
  res.json(order);
});

// ── Fuel Dispense ─────────────────────────────────────────────────────────────

const lookup = catchAsync(async (req, res) => {
  const { chassis_number } = req.query;
  if (!chassis_number) return res.status(400).json({ message: 'chassis_number is required' });
  const result = await fuelModel.fuelLookup(chassis_number.trim(), req.icdvId);
  res.json(result);
});

const dispense = catchAsync(async (req, res) => {
  const { vehicle_id, ...rest } = req.body;
  if (!vehicle_id) return res.status(400).json({ message: 'vehicle_id is required' });
  const result = await fuelModel.dispenseFuel(Number(vehicle_id), rest, req.user.user_id, req.icdvId);
  res.status(httpStatus.CREATED).json(result);
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

const getDashboard = catchAsync(async (req, res) => {
  const data = await fuelModel.getFuelDashboard(Number(req.params.manifestId), req.icdvId);
  res.json(data);
});

module.exports = {
  createOrder, listOrders, getOrder,
  approveOrder, rejectOrder,
  lookup, dispense,
  getDashboard,
};
