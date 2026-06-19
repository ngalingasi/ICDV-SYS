const jwt = require('jsonwebtoken');
const moment = require('moment');
const httpStatus = require('http-status');
const config = require('../config/config');
const { query } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { tokenTypes } = require('../config/tokens');

/**
 * Generate a signed JWT
 */
const generateToken = (userId, expires, type, secret = config.jwt.secret) => {
  const payload = {
    sub: userId,
    iat: moment().unix(),
    exp: expires.unix(),
    type,
  };
  return jwt.sign(payload, secret);
};

/**
 * Save a refresh/reset/verify token in the DB
 * We store only non-access tokens (access tokens are stateless)
 */
const saveToken = async (token, userId, expires, type, blacklisted = false) => {
  // Use a simple token table (create if missing)
  await query(
    `INSERT INTO tokens (token, user_id, expires, type, blacklisted) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE expires = VALUES(expires), blacklisted = VALUES(blacklisted)`,
    [token, userId, expires.toDate(), type, blacklisted ? 1 : 0]
  );
  return { token, userId, expires: expires.toDate(), type, blacklisted };
};

/**
 * Verify a token and return its record from DB
 */
const verifyToken = async (token, type) => {
  const payload = jwt.verify(token, config.jwt.secret);
  const rows = await query(
    'SELECT * FROM tokens WHERE token = ? AND type = ? AND user_id = ? AND blacklisted = 0',
    [token, type, payload.sub]
  );
  if (!rows.length) {
    throw new Error('Token not found');
  }
  return rows[0];
};

/**
 * Generate access + refresh tokens for a user
 */
const generateAuthTokens = async (user) => {
  const accessTokenExpires = moment().add(config.jwt.accessExpirationMinutes, 'minutes');
  const accessToken = generateToken(user.user_id, accessTokenExpires, tokenTypes.ACCESS);

  const refreshTokenExpires = moment().add(config.jwt.refreshExpirationDays, 'days');
  const refreshToken = generateToken(user.user_id, refreshTokenExpires, tokenTypes.REFRESH);
  await saveToken(refreshToken, user.user_id, refreshTokenExpires, tokenTypes.REFRESH);

  return {
    access: { token: accessToken, expires: accessTokenExpires.toDate() },
    refresh: { token: refreshToken, expires: refreshTokenExpires.toDate() },
  };
};

/**
 * Generate a reset-password token
 */
const generateResetPasswordToken = async (email) => {
  const rows = await query('SELECT user_id FROM users WHERE email = ? AND status = "active"', [email]);
  if (!rows.length) {
    // Return silently — do not reveal whether email exists (prevents user enumeration)
    return null;
  }
  const userId = rows[0].user_id;
  const expires = moment().add(config.jwt.resetPasswordExpirationMinutes, 'minutes');
  const resetToken = generateToken(userId, expires, tokenTypes.RESET_PASSWORD);
  await saveToken(resetToken, userId, expires, tokenTypes.RESET_PASSWORD);
  return resetToken;
};

/**
 * Generate an email-verification token
 */
const generateVerifyEmailToken = async (user) => {
  const expires = moment().add(config.jwt.verifyEmailExpirationMinutes, 'minutes');
  const verifyEmailToken = generateToken(user.user_id, expires, tokenTypes.VERIFY_EMAIL);
  await saveToken(verifyEmailToken, user.user_id, expires, tokenTypes.VERIFY_EMAIL);
  return verifyEmailToken;
};

/**
 * Delete tokens by user + type
 */
const deleteTokensByUserAndType = async (userId, type) => {
  await query('DELETE FROM tokens WHERE user_id = ? AND type = ?', [userId, type]);
};

module.exports = {
  generateToken,
  saveToken,
  verifyToken,
  generateAuthTokens,
  generateResetPasswordToken,
  generateVerifyEmailToken,
  deleteTokensByUserAndType,
};
