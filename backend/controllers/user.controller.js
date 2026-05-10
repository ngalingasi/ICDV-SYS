const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const userModel  = require('../models/user.model');
const emailModel = require('../models/email.model');
const crypto     = require('crypto');

const createUser = catchAsync(async (req, res) => {
  if (!req.body.password) {
    req.body.password = crypto.randomBytes(8).toString('hex');
    const user = await userModel.createUser(req.body, req.user.user_id);
    await emailModel.sendWelcomeEmail(user.email, user.full_name, user.username, req.body.password).catch(() => {});
    return res.status(httpStatus.CREATED).send(user);
  }
  const user = await userModel.createUser(req.body, req.user.user_id);
  res.status(httpStatus.CREATED).send(user);
});

const getUsers = catchAsync(async (req, res) => {
  const result = await userModel.getUsers(req.query);
  res.send(result);
});

const getUser = catchAsync(async (req, res) => {
  const user = await userModel.getUserById(req.params.userId);
  res.send(user);
});

const updateUser = catchAsync(async (req, res) => {
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

// Single clean export — no Object.assign
module.exports = { createUser, getUsers, getUser, updateUser, deleteUser, getSkills, updateSkills };
