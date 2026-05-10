const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const vehicleModel = require('../models/vehicle.model');

const createVehicle = catchAsync(async (req, res) => {
  const vehicle = await vehicleModel.createVehicle(req.body, req.user.user_id);
  res.status(httpStatus.CREATED).json(vehicle);
});

const getVehicles = catchAsync(async (req, res) => {
  const result = await vehicleModel.getVehicles(req.query);
  res.json(result);
});

const getVehicle = catchAsync(async (req, res) => {
  const vehicle = await vehicleModel.getVehicleById(Number(req.params.vehicleId));
  res.json(vehicle);
});

const searchByChassis = catchAsync(async (req, res) => {
  const vehicle = await vehicleModel.getVehicleByChassis(req.params.chassisNumber);
  res.json(vehicle);
});

const updateVehicle = catchAsync(async (req, res) => {
  const vehicle = await vehicleModel.updateVehicle(Number(req.params.vehicleId), req.body, req.user.user_id);
  res.json(vehicle);
});

const deleteVehicle = catchAsync(async (req, res) => {
  await vehicleModel.deleteVehicle(Number(req.params.vehicleId));
  res.status(httpStatus.NO_CONTENT).send();
});

const getVehicleOperations = catchAsync(async (req, res) => {
  const ops = await vehicleModel.getVehicleOperations(Number(req.params.vehicleId));
  res.json(ops);
});

module.exports = { createVehicle, getVehicles, getVehicle, searchByChassis, updateVehicle, deleteVehicle, getVehicleOperations };
