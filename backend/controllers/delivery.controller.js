const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const deliveryModel = require('../models/delivery.model');

const createDelivery        = catchAsync(async (req, res) => { res.status(httpStatus.CREATED).json(await deliveryModel.createDelivery(req.body, req.user.user_id, req.icdvId)); });
const getDeliveries         = catchAsync(async (req, res) => { res.json(await deliveryModel.getDeliveries(req.query, req.icdvId)); });
const getDelivery           = catchAsync(async (req, res) => { res.json(await deliveryModel.getDeliveryById(Number(req.params.deliveryId), req.icdvId)); });
const updateDelivery        = catchAsync(async (req, res) => { res.json(await deliveryModel.updateDelivery(Number(req.params.deliveryId), req.body, req.user.user_id, req.icdvId)); });
const updateDeliveryStatus  = catchAsync(async (req, res) => { res.json(await deliveryModel.updateDeliveryStatus(Number(req.params.deliveryId), req.body.status, req.user.user_id, req.body, req.icdvId)); });
const deleteDelivery        = catchAsync(async (req, res) => { await deliveryModel.deleteDelivery(Number(req.params.deliveryId), req.icdvId); res.status(httpStatus.NO_CONTENT).send(); });

module.exports = { createDelivery, getDeliveries, getDelivery, updateDelivery, updateDeliveryStatus, deleteDelivery };
