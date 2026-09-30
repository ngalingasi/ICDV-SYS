const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const deliveryModel = require('../models/delivery.model');
const { captureEvent } = require('../config/traceAndFound');

const createDelivery        = catchAsync(async (req, res) => {
  const delivery = await deliveryModel.createDelivery(req.body, req.user.user_id, req.icdvId);
  captureEvent('delivery.created', delivery.icdv_id, { delivery_id: delivery.delivery_id, vehicle_id: delivery.vehicle_id, user_id: req.user.user_id });
  res.status(httpStatus.CREATED).json(delivery);
});
const getDeliveries         = catchAsync(async (req, res) => { res.json(await deliveryModel.getDeliveries(req.query, req.icdvId)); });
const getDelivery           = catchAsync(async (req, res) => { res.json(await deliveryModel.getDeliveryById(Number(req.params.deliveryId), req.icdvId)); });
const updateDelivery        = catchAsync(async (req, res) => { res.json(await deliveryModel.updateDelivery(Number(req.params.deliveryId), req.body, req.user.user_id, req.icdvId)); });
const updateDeliveryStatus  = catchAsync(async (req, res) => {
  const delivery = await deliveryModel.updateDeliveryStatus(Number(req.params.deliveryId), req.body.status, req.user.user_id, req.body, req.icdvId);
  captureEvent('delivery.status_updated', delivery.icdv_id, { delivery_id: delivery.delivery_id, status: delivery.status, user_id: req.user.user_id });
  res.json(delivery);
});
const deleteDelivery        = catchAsync(async (req, res) => {
  const delivery = await deliveryModel.deleteDelivery(Number(req.params.deliveryId), req.icdvId);
  captureEvent('delivery.deleted', delivery.icdv_id, { delivery_id: delivery.delivery_id, user_id: req.user.user_id });
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = { createDelivery, getDeliveries, getDelivery, updateDelivery, updateDeliveryStatus, deleteDelivery };
