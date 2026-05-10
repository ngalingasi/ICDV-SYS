const httpStatus    = require('http-status');
const catchAsync    = require('../utils/catchAsync');
const transferModel = require('../models/transfer.model');
const ApiError      = require('../utils/ApiError');

const canManage = (user) => {
  if (!['admin','manager'].includes(user.role)) throw new ApiError(httpStatus.FORBIDDEN, 'Insufficient permissions');
};

const list     = catchAsync(async (req, res) => res.send(await transferModel.getTransfers(req.query)));
const get      = catchAsync(async (req, res) => res.send(await transferModel.getTransferById(req.params.id)));
const create   = catchAsync(async (req, res) => { canManage(req.user); res.status(httpStatus.CREATED).send(await transferModel.createTransfer(req.body, req.user.user_id)); });
const update   = catchAsync(async (req, res) => { canManage(req.user); res.send(await transferModel.updateTransfer(req.params.id, req.body, req.user.user_id)); });
const approve  = catchAsync(async (req, res) => { canManage(req.user); res.send(await transferModel.approveTransfer(req.params.id, req.user.user_id)); });
const dispatch = catchAsync(async (req, res) => { canManage(req.user); res.send(await transferModel.dispatchTransfer(req.params.id, req.user.user_id)); });
const receive  = catchAsync(async (req, res) => { canManage(req.user); res.send(await transferModel.receiveTransfer(req.params.id, null, req.user.user_id)); });
const close    = catchAsync(async (req, res) => { canManage(req.user); res.send(await transferModel.closeTransfer(req.params.id, req.user.user_id)); });
const cancel   = catchAsync(async (req, res) => { canManage(req.user); res.send(await transferModel.cancelTransfer(req.params.id, req.user.user_id)); });

module.exports = { list, get, create, update, approve, dispatch, receive, close, cancel };
