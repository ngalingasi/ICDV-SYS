const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const driverModel = require('../models/driver.model');

const createDriver = catchAsync(async (req, res) => {
  const photoPath = req.file ? `/uploads/drivers/${req.file.filename}` : null;
  const driver = await driverModel.createDriver(req.body, req.user.user_id, photoPath);
  res.status(httpStatus.CREATED).json(driver);
});

const getDrivers = catchAsync(async (req, res) => {
  const result = await driverModel.getDrivers(req.query);
  res.json(result);
});

const getDriver = catchAsync(async (req, res) => {
  const driver = await driverModel.getDriverById(Number(req.params.driverId));
  res.json(driver);
});

const updateDriver = catchAsync(async (req, res) => {
  const photoPath = req.file ? `/uploads/drivers/${req.file.filename}` : null;
  const driver = await driverModel.updateDriver(
    Number(req.params.driverId), req.body, req.user.user_id, photoPath
  );
  res.json(driver);
});

const deleteDriver = catchAsync(async (req, res) => {
  await driverModel.deleteDriver(Number(req.params.driverId));
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = { createDriver, getDrivers, getDriver, updateDriver, deleteDriver };
