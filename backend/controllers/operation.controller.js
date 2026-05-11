const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const operationModel = require('../models/operation.model');

const createOperation       = catchAsync(async (req, res) => { res.status(httpStatus.CREATED).json(await operationModel.createOperation(req.body, req.user.user_id, req.icdvId)); });
const getOperations         = catchAsync(async (req, res) => { res.json(await operationModel.getOperations(req.query, req.icdvId)); });
const getOperation          = catchAsync(async (req, res) => { res.json(await operationModel.getOperationById(Number(req.params.operationId), req.icdvId)); });
const updateOperation       = catchAsync(async (req, res) => { res.json(await operationModel.updateOperation(Number(req.params.operationId), req.body, req.user.user_id, req.icdvId)); });
const updateOperationStatus = catchAsync(async (req, res) => { res.json(await operationModel.updateOperationStatus(Number(req.params.operationId), req.body.status, req.user.user_id, req.body.notes, req.icdvId)); });
const deleteOperation       = catchAsync(async (req, res) => { await operationModel.deleteOperation(Number(req.params.operationId), req.icdvId); res.status(httpStatus.NO_CONTENT).send(); });

module.exports = { createOperation, getOperations, getOperation, updateOperation, updateOperationStatus, deleteOperation };
