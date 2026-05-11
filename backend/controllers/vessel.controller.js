const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const vesselModel = require('../models/vessel.model');

const createVessel = catchAsync(async (req, res) => {
  res.status(httpStatus.CREATED).json(await vesselModel.createVessel(req.body, req.user.user_id, req.icdvId));
});
const getVessels = catchAsync(async (req, res) => {
  res.json(await vesselModel.getVessels(req.query, req.icdvId));
});
const getVessel = catchAsync(async (req, res) => {
  res.json(await vesselModel.getVesselById(Number(req.params.vesselId), req.icdvId));
});
const updateVessel = catchAsync(async (req, res) => {
  res.json(await vesselModel.updateVessel(Number(req.params.vesselId), req.body, req.user.user_id, req.icdvId));
});
const updateVesselStatus = catchAsync(async (req, res) => {
  res.json(await vesselModel.updateVesselStatus(Number(req.params.vesselId), req.body.status, req.user.user_id, req.icdvId));
});
const deleteVessel = catchAsync(async (req, res) => {
  await vesselModel.deleteVessel(Number(req.params.vesselId), req.icdvId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = { createVessel, getVessels, getVessel, updateVessel, updateVesselStatus, deleteVessel };
