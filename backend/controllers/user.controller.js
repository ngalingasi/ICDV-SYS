const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const userModel  = require('../models/user.model');
const emailModel = require('../models/email.model');
const crypto     = require('crypto');

// When an admin creates a user, auto-scope to their own icdv_id
// Super admin can pass icdv_id explicitly in body
const createUser = catchAsync(async (req, res) => {
  const body = { ...req.body };
  // Non-super-admin: force icdv_id to their own tenant
  if (!req.isSuperAdmin) {
    body.icdv_id = req.icdvId;
    // Non-super-admin cannot create super_admin or admins of other tenants
    if (body.role === 'super_admin') body.role = 'operator';
  }

  if (!body.password) {
    body.password = crypto.randomBytes(8).toString('hex');
    const user = await userModel.createUser(body, req.user.user_id);
    await emailModel.sendWelcomeEmail(user.email, user.full_name, user.username, body.password).catch(() => {});
    return res.status(httpStatus.CREATED).send(user);
  }
  const user = await userModel.createUser(body, req.user.user_id);
  res.status(httpStatus.CREATED).send(user);
});

const getUsers = catchAsync(async (req, res) => {
  // Tenant users only see their own ICDV's users; super admin sees all (or scoped by query)
  const icdvId = req.isSuperAdmin
    ? (req.query.icdv_id ? Number(req.query.icdv_id) : null)
    : req.icdvId;
  const result = await userModel.getUsers(req.query, icdvId);
  res.send(result);
});

const getUser = catchAsync(async (req, res) => {
  const user = await userModel.getUserById(req.params.userId);
  // Tenant users can only see users in their ICDV
  if (!req.isSuperAdmin && user.icdv_id !== req.icdvId) {
    return res.status(httpStatus.NOT_FOUND).json({ message: 'User not found' });
  }
  res.send(user);
});

const updateUser = catchAsync(async (req, res) => {
  // icdv_id (transferring a user to a different ICDV) is a cross-tenant
  // action — only super_admin / system_admin may perform it. Regular ICDV
  // admins cannot move users into or out of their own ICDV via this field.
  if (req.body.icdv_id !== undefined && !req.isSuperAdmin && !req.isSystemAdmin) {
    delete req.body.icdv_id;
  }
  const user = await userModel.updateUser(req.params.userId, req.body);
  res.send(user);
});

const deleteUser = catchAsync(async (req, res) => {
  await userModel.deleteUser(req.params.userId);
  res.status(httpStatus.NO_CONTENT).send();
});

const getSkills = catchAsync(async (req, res) => {
  const skills = await userModel.getSkills();
  res.send(skills);
});

const updateSkills = catchAsync(async (req, res) => {
  await userModel.updateUserSkills(req.params.userId, req.body.skill_ids ?? []);
  const user = await userModel.getUserById(req.params.userId);
  res.send(user);
});

module.exports = { createUser, getUsers, getUser, updateUser, deleteUser, getSkills, updateSkills };
