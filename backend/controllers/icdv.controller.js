const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const icdvModel  = require('../models/icdv.model');
const userModel  = require('../models/user.model');
const { captureEvent, captureMetric } = require('../config/traceAndFound');

const createIcdv       = catchAsync(async (req, res) => {
  const icdv = await icdvModel.createIcdv(req.body, req.user.user_id);
  // A brand-new tenant onboarding — its own event is the icdv itself, so tag with its own id.
  captureEvent('icdv.created', icdv.icdv_id, { icdv_id: icdv.icdv_id, name: icdv.name, code: icdv.code, user_id: req.user.user_id });
  captureMetric('icdv.created.count', icdv.icdv_id, 1, { unit: 'tenants' });
  res.status(httpStatus.CREATED).json(icdv);
});
const getIcdvs         = catchAsync(async (req, res) => { res.json(await icdvModel.getIcdvs(req.query)); });
const getIcdv          = catchAsync(async (req, res) => { res.json(await icdvModel.getIcdvById(Number(req.params.icdvId))); });
const updateIcdv       = catchAsync(async (req, res) => { res.json(await icdvModel.updateIcdv(Number(req.params.icdvId), req.body)); });
const deleteIcdv       = catchAsync(async (req, res) => {
  const icdvId = Number(req.params.icdvId);
  const existing = await icdvModel.getIcdvById(icdvId);
  await icdvModel.deleteIcdv(icdvId);
  captureEvent('icdv.deleted', icdvId, { icdv_id: icdvId, name: existing.name, user_id: req.user.user_id });
  captureMetric('icdv.deleted.count', icdvId, 1, { unit: 'tenants' });
  res.status(httpStatus.NO_CONTENT).send();
});
const getPlatformStats = catchAsync(async (req, res) => { res.json(await icdvModel.getPlatformStats()); });

// GET /icdvs/me/batch-capacity — any authenticated ICDV user can read their
// own ICDV's batch capacity (super_admin/system_admin get the fallback 20
// since they're not tied to a single ICDV here).
const getBatchCapacity = catchAsync(async (req, res) => {
  res.json(await icdvModel.getBatchCapacity(req.icdvId));
});

// POST /icdvs/:icdvId/admins — create an admin user scoped to a specific ICDV
const createIcdvAdmin = catchAsync(async (req, res) => {
  const icdvId = Number(req.params.icdvId);
  await icdvModel.getIcdvById(icdvId); // existence check
  const user = await userModel.createUser(
    { ...req.body, role: 'admin', icdv_id: icdvId },
    req.user.user_id
  );
  captureEvent('icdv.admin_created', icdvId, { icdv_id: icdvId, user_id: user.user_id, username: user.username, created_by: req.user.user_id });
  res.status(httpStatus.CREATED).json(user);
});

// GET /icdvs/:icdvId/users
const getIcdvUsers = catchAsync(async (req, res) => {
  await icdvModel.getIcdvById(Number(req.params.icdvId));
  res.json(await userModel.getUsers(req.query, Number(req.params.icdvId)));
});

module.exports = { createIcdv, getIcdvs, getIcdv, updateIcdv, deleteIcdv, getPlatformStats, createIcdvAdmin, getIcdvUsers, getBatchCapacity };
