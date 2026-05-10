const httpStatus = require('http-status');
const bcrypt = require('bcryptjs');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const tokenModel = require('../models/token.model');
const emailModel = require('../models/email.model');
const smsModel = require('../models/sms.model');
const otpModel = require('../models/otp.model');
const { query } = require('../config/database');
const config = require('../config/config');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const getExpiresAt = (minutes = 10) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + minutes);
    d.setHours(d.getHours() + 3); // ← add EAT offset (UTC+3)
    return d.toISOString().slice(0, 19).replace('T', ' ');
};

const maskEmail = (email) =>
  email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) =>
    a + '*'.repeat(Math.max(b.length, 3)) + c
  );

const maskPhone = (phone) => {
  const clean = String(phone).replace(/\D/g, '');
  if (clean.length < 6) return '****';
  return clean.slice(0, 3) + '*'.repeat(clean.length - 6) + clean.slice(-3);
};

const getBrandBoxSettings = () => ({
  api_key:        config.sms.brandbox.apiKey,
  api_secret_key: config.sms.brandbox.apiSecret,
  sender_name:    config.sms.brandbox.senderName,
});

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

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 — POST /v1/auth/validate-credentials
// Validates login + password. Returns available OTP channels with masked info.
// Does NOT send any OTP yet.
// ─────────────────────────────────────────────────────────────────────────────
const validateCredentials = catchAsync(async (req, res) => {
  const { login, password } = req.body;

  const rows = await query(
    'SELECT * FROM users WHERE (email = ? OR username = ?) AND status = "active"',
    [login, login]
  );

  // Always return same vague message to prevent user enumeration
  if (!rows.length) {
    return res.status(httpStatus.UNAUTHORIZED).json({
      status: false,
      message: 'Invalid credentials',
    });
  }

  const user = rows[0];

  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return res.status(httpStatus.UNAUTHORIZED).json({
      status: false,
      message: 'Invalid credentials',
    });
  }

  // Prompt password change if required — skip OTP for this flow
  if (user.must_change_password) {
    return res.status(httpStatus.OK).json({
      status:         false,
      must_change_password: true,
      message:        'You must change your password before continuing',
    });
  }

  // Build available channels
  const channels = [];

  if (user.email) {
    channels.push({
      type:    'email',
      display: maskEmail(user.email),
      label:   'Email',
    });
  }

  if (user.mobile) {
    channels.push({
      type:    'sms',
      display: maskPhone(user.mobile),
      label:   'SMS',
    });
  }

  return res.status(httpStatus.OK).json({
    status:   true,
    message:  'Credentials valid. Please choose an OTP delivery channel.',
    channels,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 2 — POST /v1/auth/send-otp
// User picks a channel. Generate OTP and dispatch to that channel only.
// ─────────────────────────────────────────────────────────────────────────────
const sendOtp = catchAsync(async (req, res) => {
  const { login, channel } = req.body;

  if (!['email', 'sms'].includes(channel)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Channel must be "email" or "sms"');
  }

  const rows = await query(
    'SELECT * FROM users WHERE (email = ? OR username = ?) AND status = "active"',
    [login, login]
  );

  // Vague response to prevent enumeration
  if (!rows.length) {
    return res.status(httpStatus.OK).json({
      status:  true,
      message: 'If the account exists, an OTP has been sent',
    });
  }

  const user = rows[0];

  // Clean expired OTPs in background
  otpModel.cleanExpiredOtps().catch(() => {});

  const otp_code   = generateOtp();
  const expires_at = getExpiresAt(config.otp.expiryMinutes);

  await otpModel.saveOtp({ email: user.email, otp_code, expires_at });

  if (channel === 'email') {
    await emailModel.sendOtpEmail(user.email, otp_code);

    return res.status(httpStatus.OK).json({
      status:        true,
      message:       'OTP sent to your email',
      channel:       'email',
      maskedContact: maskEmail(user.email),
    });
  }

  if (channel === 'sms') {
    if (!user.mobile) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'No phone number on record for this account');
    }

    await smsModel.sendSmsBrandBox(
      `Your TPFCS login OTP is: ${otp_code}. Valid for ${config.otp.expiryMinutes} minutes. Do not share this code.`,
      [user.mobile],
      getBrandBoxSettings()
    );

    return res.status(httpStatus.OK).json({
      status:        true,
      message:       'OTP sent via SMS',
      channel:       'sms',
      maskedContact: maskPhone(user.mobile),
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 — POST /v1/auth/verify-otp
// Verify OTP and return full JWT auth tokens + user profile.
// ─────────────────────────────────────────────────────────────────────────────
const verifyOtp = catchAsync(async (req, res) => {
  const { login, otp } = req.body;

  const rows = await query(
    'SELECT * FROM users WHERE (email = ? OR username = ?) AND status = "active"',
    [login, login]
  );

  if (!rows.length) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired OTP');
  }

  const user = rows[0];

  const validOtp = await otpModel.findValidOtp({ email: user.email, otp_code: otp });

  if (!validOtp) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid or expired OTP. Please request a new one.');
  }

  // Mark OTP as used
  await otpModel.markOtpUsed(validOtp.id);

  // Generate auth tokens
  const tokens = await tokenModel.generateAuthTokens(user);

  return res.status(httpStatus.OK).json({
    status:  true,
    message: 'Login successful',
    user:    sanitizeUser(user),
    tokens,
  });
});

module.exports = { validateCredentials, sendOtp, verifyOtp };
