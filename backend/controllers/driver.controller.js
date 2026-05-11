const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const driverModel = require('../models/driver.model');

const createDriver = catchAsync(async (req, res) => { res.status(httpStatus.CREATED).json(await driverModel.createDriver(req.body, req.user.user_id, req.file?.path || null, req.icdvId)); });
const getDrivers   = catchAsync(async (req, res) => { res.json(await driverModel.getDrivers(req.query, req.icdvId)); });
const getDriver    = catchAsync(async (req, res) => { res.json(await driverModel.getDriverById(Number(req.params.driverId), req.icdvId)); });
const updateDriver = catchAsync(async (req, res) => { res.json(await driverModel.updateDriver(Number(req.params.driverId), req.body, req.user.user_id, req.file?.path || null, req.icdvId)); });
const deleteDriver = catchAsync(async (req, res) => { await driverModel.deleteDriver(Number(req.params.driverId), req.icdvId); res.status(httpStatus.NO_CONTENT).send(); });

module.exports = { createDriver, getDrivers, getDriver, updateDriver, deleteDriver };
