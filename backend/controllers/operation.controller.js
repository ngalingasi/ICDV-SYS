const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const operationModel = require('../models/operation.model');

const createOperation = catchAsync(async (req, res) => {
  const op = await operationModel.createOperation(req.body, req.user.user_id);
  res.status(httpStatus.CREATED).json(op);
});

const getOperations = catchAsync(async (req, res) => {
  const result = await operationModel.getOperations(req.query);
  res.json(result);
});

const getOperation = catchAsync(async (req, res) => {
  const op = await operationModel.getOperationById(Number(req.params.operationId));
  res.json(op);
});

const updateOperation = catchAsync(async (req, res) => {
  const op = await operationModel.updateOperation(Number(req.params.operationId), req.body, req.user.user_id);
  res.json(op);
});

const updateOperationStatus = catchAsync(async (req, res) => {
  const op = await operationModel.updateOperationStatus(
    Number(req.params.operationId), req.body.status, req.user.user_id, req.body.notes
  );
  res.json(op);
});

const deleteOperation = catchAsync(async (req, res) => {
  await operationModel.deleteOperation(Number(req.params.operationId));
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = { createOperation, getOperations, getOperation, updateOperation, updateOperationStatus, deleteOperation };
