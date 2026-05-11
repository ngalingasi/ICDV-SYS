const httpStatus  = require('http-status');
const catchAsync  = require('../utils/catchAsync');
const driverModel = require('../models/driver.model');
const path        = require('path');
const config      = require('../config/config');

// Convert multer's absolute disk path to a URL-friendly relative path
// e.g. /home/.../uploads/drivers/xyz.jpg  →  /uploads/drivers/xyz.jpg
const toRelativePath = (filePath) => {
  if (!filePath) return null;
  // Normalise to forward slashes, then extract everything from /uploads/ onward
  const normalised = filePath.replace(/\\/g, '/');
  const idx = normalised.indexOf('/uploads/');
  if (idx !== -1) return normalised.slice(idx);
  // Fallback: just prefix with /uploads/
  return '/' + config.upload.dir + '/' + path.basename(filePath);
};

const createDriver = catchAsync(async (req, res) => {
  const photo = toRelativePath(req.file?.path ?? null);
  res.status(httpStatus.CREATED).json(
    await driverModel.createDriver(req.body, req.user.user_id, photo, req.icdvId)
  );
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

const deleteDriver = catchAsync(async (req, res) => {
  await driverModel.deleteDriver(Number(req.params.driverId), req.icdvId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = { createDriver, getDrivers, getDriver, updateDriver, deleteDriver };
