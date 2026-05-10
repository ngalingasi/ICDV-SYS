const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const vesselModel = require('../models/vessel.model');

const createVessel = catchAsync(async (req, res) => {
  const vessel = await vesselModel.createVessel(req.body, req.user.user_id);
  res.status(httpStatus.CREATED).json(vessel);
});

const getVessels = catchAsync(async (req, res) => {
  const result = await vesselModel.getVessels(req.query);
  res.json(result);
});

const getVessel = catchAsync(async (req, res) => {
  const vessel = await vesselModel.getVesselById(Number(req.params.vesselId));
  res.json(vessel);
});

const updateVessel = catchAsync(async (req, res) => {
  const vessel = await vesselModel.updateVessel(Number(req.params.vesselId), req.body, req.user.user_id);
  res.json(vessel);
});

const updateVesselStatus = catchAsync(async (req, res) => {
  const vessel = await vesselModel.updateVesselStatus(
    Number(req.params.vesselId), req.body.status, req.user.user_id
  );
  res.json(vessel);
});

const deleteVessel = catchAsync(async (req, res) => {
  await vesselModel.deleteVessel(Number(req.params.vesselId));
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = { createVessel, getVessels, getVessel, updateVessel, updateVesselStatus, deleteVessel };
