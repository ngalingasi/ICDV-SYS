const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const objectiveModel = require('../models/objective.model');

const createObjective = catchAsync(async (req, res) => {
  const obj = await objectiveModel.createObjective(req.body, req.user.user_id);
  res.status(httpStatus.CREATED).send(obj);
});

const getObjectivesByProject = catchAsync(async (req, res) => {
  const objs = await objectiveModel.getObjectivesByProject(req.params.projectId);
  res.send(objs);
});

const getObjective = catchAsync(async (req, res) => {
  const obj = await objectiveModel.getObjectiveById(req.params.objectiveId);
  res.send(obj);
});

const updateObjective = catchAsync(async (req, res) => {
  const obj = await objectiveModel.updateObjective(req.params.objectiveId, req.body);
  res.send(obj);
});

const deleteObjective = catchAsync(async (req, res) => {
  await objectiveModel.deleteObjective(req.params.objectiveId);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = { createObjective, getObjectivesByProject, getObjective, updateObjective, deleteObjective };
