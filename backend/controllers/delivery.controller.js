const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const deliveryModel = require('../models/delivery.model');

const createDelivery = catchAsync(async (req, res) => {
  const delivery = await deliveryModel.createDelivery(req.body, req.user.user_id);
  res.status(httpStatus.CREATED).json(delivery);
});

const getDeliveries = catchAsync(async (req, res) => {
  const result = await deliveryModel.getDeliveries(req.query);
  res.json(result);
});

const getDelivery = catchAsync(async (req, res) => {
  const delivery = await deliveryModel.getDeliveryById(Number(req.params.deliveryId));
  res.json(delivery);
});

const updateDelivery = catchAsync(async (req, res) => {
  const delivery = await deliveryModel.updateDelivery(Number(req.params.deliveryId), req.body, req.user.user_id);
  res.json(delivery);
});

const updateDeliveryStatus = catchAsync(async (req, res) => {
  const delivery = await deliveryModel.updateDeliveryStatus(
    Number(req.params.deliveryId), req.body.status, req.user.user_id, req.body
  );
  res.json(delivery);
});

const deleteDelivery = catchAsync(async (req, res) => {
  await deliveryModel.deleteDelivery(Number(req.params.deliveryId));
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = { createDelivery, getDeliveries, getDelivery, updateDelivery, updateDeliveryStatus, deleteDelivery };
