const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const model      = require('../models/logistics.model');
const ApiError   = require('../utils/ApiError');

const canManage = (user) => {
  if (!['admin','manager'].includes(user.role))
    throw new ApiError(httpStatus.FORBIDDEN, 'Insufficient permissions');
};

// ── Companies ──────────────────────────────────────────────────────────────────
const listCompanies   = catchAsync(async (req, res) => res.send(await model.getCompanies(req.query)));
const getCompany      = catchAsync(async (req, res) => res.send(await model.getCompanyById(req.params.id)));
const createCompany   = catchAsync(async (req, res) => { canManage(req.user); res.status(httpStatus.CREATED).send(await model.createCompany(req.body, req.user.user_id)); });
const updateCompany   = catchAsync(async (req, res) => { canManage(req.user); res.send(await model.updateCompany(req.params.id, req.body, req.user.user_id)); });
const deleteCompany   = catchAsync(async (req, res) => { canManage(req.user); await model.deleteCompany(req.params.id); res.status(httpStatus.NO_CONTENT).send(); });

// ── Transactions ───────────────────────────────────────────────────────────────
const listTransactions  = catchAsync(async (req, res) => res.send(await model.getTransactions(req.query)));
const getTransaction    = catchAsync(async (req, res) => res.send(await model.getTransactionById(req.params.id)));
const createTransaction = catchAsync(async (req, res) => { canManage(req.user); res.status(httpStatus.CREATED).send(await model.createTransaction(req.body, req.user.user_id)); });
const updateTransaction = catchAsync(async (req, res) => { canManage(req.user); res.send(await model.updateTransaction(req.params.id, req.body, req.user.user_id)); });

// ── Status transitions ─────────────────────────────────────────────────────────
const schedulePickup  = catchAsync(async (req, res) => { canManage(req.user); res.send(await model.schedulePickup(req.params.id,  req.body, req.user.user_id)); });
const markPickedUp    = catchAsync(async (req, res) => { canManage(req.user); res.send(await model.markPickedUp(req.params.id,    req.body, req.user.user_id)); });
const markInTransit   = catchAsync(async (req, res) => { canManage(req.user); res.send(await model.markInTransit(req.params.id,   req.body, req.user.user_id)); });
const markDelayed     = catchAsync(async (req, res) => { canManage(req.user); res.send(await model.markDelayed(req.params.id,     req.body, req.user.user_id)); });
const markArrived     = catchAsync(async (req, res) => { canManage(req.user); res.send(await model.markArrived(req.params.id,     req.body, req.user.user_id)); });
const markDelivered   = catchAsync(async (req, res) => { canManage(req.user); res.send(await model.markDelivered(req.params.id,   req.body, req.user.user_id)); });
const cancelShipment  = catchAsync(async (req, res) => { canManage(req.user); res.send(await model.cancelTransaction(req.params.id, req.body, req.user.user_id)); });
const addNote         = catchAsync(async (req, res) => res.send(await model.addNote(req.params.id, req.body, req.user.user_id)));

module.exports = {
  listCompanies, getCompany, createCompany, updateCompany, deleteCompany,
  listTransactions, getTransaction, createTransaction, updateTransaction,
  schedulePickup, markPickedUp, markInTransit, markDelayed, markArrived, markDelivered,
  cancelShipment, addNote,
};
