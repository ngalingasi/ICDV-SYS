const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const vehicleModel = require('../models/vehicle.model');
const { captureEvent, captureMetric } = require('../config/traceAndFound');

const createVehicle        = catchAsync(async (req, res) => {
  const vehicle = await vehicleModel.createVehicle(req.body, req.user.user_id, req.icdvId);
  captureEvent('vehicle.created', vehicle.icdv_id, { vehicle_id: vehicle.vehicle_id, chassis_number: vehicle.chassis_number, user_id: req.user.user_id });
  captureMetric('vehicle.created.count', vehicle.icdv_id, 1, { unit: 'vehicles' });
  res.status(httpStatus.CREATED).json(vehicle);
});
const getVehicles          = catchAsync(async (req, res) => { res.json(await vehicleModel.getVehicles(req.query, req.icdvId)); });
const getVehicle           = catchAsync(async (req, res) => { res.json(await vehicleModel.getVehicleById(Number(req.params.vehicleId), req.icdvId)); });
const searchByChassis      = catchAsync(async (req, res) => { res.json(await vehicleModel.getVehicleByChassis(req.params.chassisNumber, req.icdvId)); });
const updateVehicle        = catchAsync(async (req, res) => { res.json(await vehicleModel.updateVehicle(Number(req.params.vehicleId), req.body, req.user.user_id, req.icdvId)); });
const deleteVehicle        = catchAsync(async (req, res) => {
  const vehicle = await vehicleModel.deleteVehicle(Number(req.params.vehicleId), req.icdvId);
  captureEvent('vehicle.deleted', vehicle.icdv_id, { vehicle_id: vehicle.vehicle_id, chassis_number: vehicle.chassis_number, user_id: req.user.user_id });
  captureMetric('vehicle.deleted.count', vehicle.icdv_id, 1, { unit: 'vehicles' });
  res.status(httpStatus.NO_CONTENT).send();
});
const getVehicleOperations = catchAsync(async (req, res) => { res.json(await vehicleModel.getVehicleOperations(Number(req.params.vehicleId), req.icdvId)); });

module.exports = { createVehicle, getVehicles, getVehicle, searchByChassis, updateVehicle, deleteVehicle, getVehicleOperations };
