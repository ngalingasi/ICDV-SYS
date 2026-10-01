const httpStatus  = require('http-status');
const catchAsync  = require('../utils/catchAsync');
const driverModel = require('../models/driver.model');
const path        = require('path');
const config      = require('../config/config');
const { captureEvent, captureMetric } = require('../config/traceAndFound');

const toRelativePath = (filePath) => {
  if (!filePath) return null;
  const normalised = filePath.replace(/\\/g, '/');
  const idx = normalised.indexOf('/uploads/');
  if (idx !== -1) return normalised.slice(idx);
  return '/' + config.upload.dir + '/' + path.basename(filePath);
};

const createDriver = catchAsync(async (req, res) => {
  const photo = toRelativePath(req.file?.path ?? null);
  // icdvId may be null for super_admin — that creates a global driver
  const driver = await driverModel.createDriver(req.body, req.user.user_id, photo, req.icdvId);
  captureEvent('driver.created', driver.icdv_id, { driver_id: driver.driver_id, full_name: driver.full_name, user_id: req.user.user_id });
  captureMetric('driver.created.count', driver.icdv_id, 1, { unit: 'drivers' });
  res.status(httpStatus.CREATED).json(driver);
});

const getDrivers = catchAsync(async (req, res) => {
  res.json(await driverModel.getDrivers(req.query, req.icdvId));
});

const getDriver = catchAsync(async (req, res) => {
  res.json(await driverModel.getDriverById(Number(req.params.driverId), req.icdvId));
});

const updateDriver = catchAsync(async (req, res) => {
  const photo = toRelativePath(req.file?.path ?? null);
  res.json(
    await driverModel.updateDriver(
      Number(req.params.driverId), req.body, req.user.user_id, photo, req.icdvId
    )
  );
});

// Release driver from their ICDV → they become globally available
// Named distinctly from workflow's 'driver.released' (which releases a driver
// from an in-progress vehicle transfer assignment) — this is a different action
// entirely: removing the driver from the tenant's roster altogether.
const releaseDriver = catchAsync(async (req, res) => {
  const driverId = Number(req.params.driverId);
  const beforeIcdvId = req.icdvId; // tag the event to the ICDV they're being released FROM
  const driver = await driverModel.releaseDriverFromIcdv(driverId, req.user.user_id, req.icdvId);
  captureEvent('driver.released_from_icdv', beforeIcdvId, { driver_id: driverId, full_name: driver.full_name, user_id: req.user.user_id });
  res.json(driver);
});

const deleteDriver = catchAsync(async (req, res) => {
  const driver = await driverModel.deleteDriver(Number(req.params.driverId), req.icdvId);
  captureEvent('driver.deleted', driver.icdv_id, { driver_id: driver.driver_id, full_name: driver.full_name, user_id: req.user.user_id });
  captureMetric('driver.deleted.count', driver.icdv_id, 1, { unit: 'drivers' });
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = { createDriver, getDrivers, getDriver, updateDriver, releaseDriver, deleteDriver };
