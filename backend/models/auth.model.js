const httpStatus = require('http-status');
const bcrypt = require('bcryptjs');
const tokenModel = require('./token.model');
const { query } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { tokenTypes } = require('../config/tokens');

/**
 * Login with username/email and password
 */
const loginUser = async (login, password) => {
  const rows = await query(
    'SELECT * FROM users WHERE (email = ? OR username = ?) AND status = "active"',
    [login, login]
  );
  if (!rows.length) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect credentials');
  }
  const user = rows[0];
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Incorrect credentials');
  }
  return user;
};

/**
 * Logout – remove refresh token
 */
const logout = async (refreshToken) => {
  const rows = await query(
    'SELECT * FROM tokens WHERE token = ? AND type = ? AND blacklisted = 0',
    [refreshToken, tokenTypes.REFRESH]
  );
  if (!rows.length) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Token not found');
  }
  await query('DELETE FROM tokens WHERE token = ?', [refreshToken]);
};

/**
 * Refresh auth tokens
 */
const refreshAuth = async (refreshToken) => {
  try {
    const tokenDoc = await tokenModel.verifyToken(refreshToken, tokenTypes.REFRESH);
    const rows = await query('SELECT * FROM users WHERE user_id = ? AND status = "active"', [tokenDoc.user_id]);
    if (!rows.length) throw new Error();
    await query('DELETE FROM tokens WHERE token = ?', [refreshToken]);
    return tokenModel.generateAuthTokens(rows[0]);
  } catch {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate');
  }
};

/**
 * Reset password
 */
const resetPassword = async (resetPasswordToken, newPassword) => {
  try {
    const tokenDoc = await tokenModel.verifyToken(resetPasswordToken, tokenTypes.RESET_PASSWORD);
    const hash = await bcrypt.hash(newPassword, 10);
    await query(
      'UPDATE users SET password_hash = ?, must_change_password = 0, last_password_changed = NOW() WHERE user_id = ?',
      [hash, tokenDoc.user_id]
    );
    await tokenModel.deleteTokensByUserAndType(tokenDoc.user_id, tokenTypes.RESET_PASSWORD);
  } catch {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Password reset failed');
  }
};

/**
 * Change own password (must_change_password flow)
 */
const changePassword = async (userId, currentPassword, newPassword) => {
  const rows = await query('SELECT * FROM users WHERE user_id = ?', [userId]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  const user = rows[0];
  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isMatch) throw new ApiError(httpStatus.UNAUTHORIZED, 'Current password is incorrect');
  const hash = await bcrypt.hash(newPassword, 10);
  await query(
    'UPDATE users SET password_hash = ?, must_change_password = 0, last_password_changed = NOW() WHERE user_id = ?',
    [hash, userId]
  );
};

module.exports = { loginUser, logout, refreshAuth, resetPassword, changePassword };
