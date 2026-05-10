const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const authModel = require('../models/auth.model');
const tokenModel = require('../models/token.model');
const emailModel = require('../models/email.model');

// Fields safe to expose in auth responses
const SAFE_USER_FIELDS = [
  'user_id', 'full_name', 'username', 'email',
  'mobile', 'gender', 'avatar', 'role', 'status',
  'must_change_password',
];

const sanitizeUser = (user) =>
  SAFE_USER_FIELDS.reduce((obj, key) => {
    if (user[key] !== undefined) obj[key] = user[key];
    return obj;
  }, {});

const login = catchAsync(async (req, res) => {
  const { login, password } = req.body;
  const user = await authModel.loginUser(login, password);
  const tokens = await tokenModel.generateAuthTokens(user);
  res.status(httpStatus.OK).send({ user: sanitizeUser(user), tokens });
});

const logout = catchAsync(async (req, res) => {
  await authModel.logout(req.body.refreshToken);
  res.status(httpStatus.NO_CONTENT).send();
});

const refreshTokens = catchAsync(async (req, res) => {
  const tokens = await authModel.refreshAuth(req.body.refreshToken);
  res.send(tokens);
});

const forgotPassword = catchAsync(async (req, res) => {
  const resetToken = await tokenModel.generateResetPasswordToken(req.body.email);
  // Send email only if user exists — always respond 204 to prevent email enumeration
  if (resetToken) {
    await emailModel.sendResetPasswordEmail(req.body.email, resetToken);
  }
  res.status(httpStatus.NO_CONTENT).send();
});

const resetPassword = catchAsync(async (req, res) => {
  await authModel.resetPassword(req.query.token, req.body.password);
  res.status(httpStatus.NO_CONTENT).send();
});

const changePassword = catchAsync(async (req, res) => {
  await authModel.changePassword(req.user.user_id, req.body.currentPassword, req.body.newPassword);
  res.status(httpStatus.NO_CONTENT).send();
});

const getMe = catchAsync(async (req, res) => {
  res.send(sanitizeUser(req.user));
});

module.exports = { login, logout, refreshTokens, forgotPassword, resetPassword, changePassword, getMe };
