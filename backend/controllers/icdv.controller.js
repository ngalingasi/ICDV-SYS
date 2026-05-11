const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const icdvModel  = require('../models/icdv.model');
const userModel  = require('../models/user.model');

const createIcdv       = catchAsync(async (req, res) => { res.status(httpStatus.CREATED).json(await icdvModel.createIcdv(req.body, req.user.user_id)); });
const getIcdvs         = catchAsync(async (req, res) => { res.json(await icdvModel.getIcdvs(req.query)); });
const getIcdv          = catchAsync(async (req, res) => { res.json(await icdvModel.getIcdvById(Number(req.params.icdvId))); });
const updateIcdv       = catchAsync(async (req, res) => { res.json(await icdvModel.updateIcdv(Number(req.params.icdvId), req.body)); });
const deleteIcdv       = catchAsync(async (req, res) => { await icdvModel.deleteIcdv(Number(req.params.icdvId)); res.status(httpStatus.NO_CONTENT).send(); });
const getPlatformStats = catchAsync(async (req, res) => { res.json(await icdvModel.getPlatformStats()); });

// POST /icdvs/:icdvId/admins — create an admin user scoped to a specific ICDV
const createIcdvAdmin = catchAsync(async (req, res) => {
  const icdvId = Number(req.params.icdvId);
  await icdvModel.getIcdvById(icdvId); // existence check
  const user = await userModel.createUser(
    { ...req.body, role: 'admin', icdv_id: icdvId },
    req.user.user_id
  );
  res.status(httpStatus.CREATED).json(user);
});

// GET /icdvs/:icdvId/users
const getIcdvUsers = catchAsync(async (req, res) => {
  await icdvModel.getIcdvById(Number(req.params.icdvId));
  res.json(await userModel.getUsers({ ...req.query, icdv_id: Number(req.params.icdvId) }));
});

module.exports = { createIcdv, getIcdvs, getIcdv, updateIcdv, deleteIcdv, getPlatformStats, createIcdvAdmin, getIcdvUsers };
