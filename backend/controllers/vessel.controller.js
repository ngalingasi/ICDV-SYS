const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const vesselModel = require('../models/vessel.model');
const { captureEvent } = require('../config/traceAndFound');

const createVessel = catchAsync(async (req, res) => {
  const vessel = await vesselModel.createVessel(req.body, req.user.user_id, req.icdvId);
  captureEvent('vessel.created', vessel.icdv_id, { vessel_id: vessel.vessel_id, name: vessel.name, user_id: req.user.user_id });
  res.status(httpStatus.CREATED).json(vessel);
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
  const vessel = await vesselModel.updateVesselStatus(Number(req.params.vesselId), req.body.status, req.user.user_id, req.icdvId);
  captureEvent('vessel.status_updated', vessel.icdv_id, { vessel_id: vessel.vessel_id, status: vessel.status, user_id: req.user.user_id });
  res.json(vessel);
});
const deleteVessel = catchAsync(async (req, res) => {
  const vessel = await vesselModel.deleteVessel(Number(req.params.vesselId), req.icdvId);
  captureEvent('vessel.deleted', vessel.icdv_id, { vessel_id: vessel.vessel_id, name: vessel.name, user_id: req.user.user_id });
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = { createVessel, getVessels, getVessel, updateVessel, updateVesselStatus, deleteVessel };
