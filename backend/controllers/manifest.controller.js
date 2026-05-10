const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const manifestModel = require('../models/manifest.model');

const createManifest = catchAsync(async (req, res) => {
  const manifest = await manifestModel.createManifest(req.body, req.user.user_id);
  res.status(httpStatus.CREATED).json(manifest);
});

const getManifests = catchAsync(async (req, res) => {
  const result = await manifestModel.getManifests(req.query);
  res.json(result);
});

const getManifest = catchAsync(async (req, res) => {
  const manifest = await manifestModel.getManifestById(Number(req.params.manifestId));
  res.json(manifest);
});

const updateManifest = catchAsync(async (req, res) => {
  const manifest = await manifestModel.updateManifest(Number(req.params.manifestId), req.body, req.user.user_id);
  res.json(manifest);
});

const deleteManifest = catchAsync(async (req, res) => {
  await manifestModel.deleteManifest(Number(req.params.manifestId));
  res.status(httpStatus.NO_CONTENT).send();
});

const importVehicles = catchAsync(async (req, res) => {
  const result = await manifestModel.importVehicles(
    Number(req.params.manifestId), req.body.vehicles, req.user.user_id
  );
  res.json(result);
});

module.exports = { createManifest, getManifests, getManifest, updateManifest, deleteManifest, importVehicles };
