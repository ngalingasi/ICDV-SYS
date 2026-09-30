const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const authModel  = require('../models/auth.model');
const tokenModel = require('../models/token.model');
const emailModel = require('../models/email.model');
const { query }  = require('../config/database');
const { captureEvent } = require('../config/traceAndFound');

// Always include these fields in the response (null if not set)
const SAFE_USER_FIELDS = [
  'user_id', 'full_name', 'username', 'email',
  'mobile', 'gender', 'avatar', 'role',
  'icdv_id', 'icdv_name',          // always present — null for super_admin or unassigned
  'status', 'must_change_password',
];

// Build safe user object — use null for missing fields so frontend always gets them
const sanitizeUser = (user) =>
  SAFE_USER_FIELDS.reduce((obj, key) => {
    obj[key] = user[key] !== undefined ? user[key] : null;
    return obj;
  }, {});

// Look up icdv_name from icdvs table using the user's icdv_id.
// Safe even if icdv_id column doesn't exist yet in users table.
const enrichUser = async (user) => {
  const icdvId = user.icdv_id ?? null;
  if (icdvId) {
    try {
      const rows = await query('SELECT name FROM icdvs WHERE icdv_id = ?', [icdvId]);
      user.icdv_name = rows.length ? rows[0].name : null;
    } catch {
      user.icdv_name = null;
    }
  } else {
    user.icdv_name = null;
  }
  return user;
};

const login = catchAsync(async (req, res) => {
  const { login: loginId, password } = req.body;
  let user;
  try {
    user = await authModel.loginUser(loginId, password);
  } catch (err) {
    // Incorrect-credentials is an operational 401 — it would never reach the
    // centralized error handler's capture. Security-relevant on its own
    // (brute-force visibility), so tracked explicitly here. Never log the
    // password itself — only which identifier was attempted.
    captureEvent('auth.login_failed', null, { attempted_login: loginId });
    throw err;
  }
  await enrichUser(user);
  const tokens = await tokenModel.generateAuthTokens(user);
  res.status(httpStatus.OK).json({
    status:  true,
    message: 'Login successful',
    user:    sanitizeUser(user),
    tokens,
  });
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
  await enrichUser(req.user);
  res.send(sanitizeUser(req.user));
});

module.exports = { login, logout, refreshTokens, forgotPassword, resetPassword, changePassword, getMe };
