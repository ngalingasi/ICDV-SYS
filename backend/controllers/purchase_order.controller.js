const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const poModel    = require('../models/purchase_order.model');
const ApiError   = require('../utils/ApiError');

const canManage = (user) => {
  if (!['admin', 'manager'].includes(user.role)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only admins and managers can manage purchase orders');
  }
};

const list   = catchAsync(async (req, res) => res.send(await poModel.getPurchaseOrders(req.query)));
const get    = catchAsync(async (req, res) => res.send(await poModel.getPurchaseOrderById(req.params.id)));

const create = catchAsync(async (req, res) => {
  canManage(req.user);
  const po = await poModel.createPurchaseOrder(req.body, req.user.user_id);
  res.status(httpStatus.CREATED).send(po);
});

const update = catchAsync(async (req, res) => {
  canManage(req.user);
  const po = await poModel.updatePurchaseOrder(req.params.id, req.body, req.user.user_id);
  res.send(po);
});

const cancel = catchAsync(async (req, res) => {
  canManage(req.user);
  const po = await poModel.cancelPurchaseOrder(req.params.id, req.user.user_id);
  res.send(po);
});

const remove = catchAsync(async (req, res) => {
  canManage(req.user);
  await poModel.deletePurchaseOrder(req.params.id, req.user.user_id);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = { list, get, create, update, cancel, remove };
