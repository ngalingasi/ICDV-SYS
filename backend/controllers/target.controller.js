const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const targetModel = require('../models/target.model');

const createTarget = catchAsync(async (req, res) => {
  const target = await targetModel.createTarget(req.body, req.user.user_id);
  res.status(httpStatus.CREATED).send(target);
});

const getTargetsByObjective = catchAsync(async (req, res) => {
  const targets = await targetModel.getTargetsByObjective(req.params.objectiveId);
  res.send(targets);
});

const getTarget = catchAsync(async (req, res) => {
  const target = await targetModel.getTargetById(req.params.targetId);
  res.send(target);
});

const updateTarget = catchAsync(async (req, res) => {
  const target = await targetModel.updateTarget(req.params.targetId, req.body);
  res.send(target);
});

const deleteTarget = catchAsync(async (req, res) => {
  await targetModel.deleteTarget(req.params.targetId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = { createTarget, getTargetsByObjective, getTarget, updateTarget, deleteTarget };
