const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validate = require('../../middlewares/validate');
const auth = require('../../middlewares/auth');
const authController = require('../../controllers/auth.controller');
const otpController  = require('../../controllers/otp.controller');

const loginSchema = {
  body: Joi.object().keys({
    login: Joi.string().required(),
    password: Joi.string().required(),
  }),
};

const refreshSchema = {
  body: Joi.object().keys({
    refreshToken: Joi.string().required(),
  }),
};

const forgotPasswordSchema = {
  body: Joi.object().keys({
    email: Joi.string().email().required(),
  }),
};

const resetPasswordSchema = {
  query: Joi.object().keys({ token: Joi.string().required() }),
  body: Joi.object().keys({ password: Joi.string().min(8).required() }),
};

const changePasswordSchema = {
  body: Joi.object().keys({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).required(),
  }),
};

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication endpoints
 */

// ─── Standard login (no OTP) ─────────────────────────────────────────────────
router.post('/login', validate(loginSchema), authController.login);

// ─── OTP 2FA login (3-step) ──────────────────────────────────────────────────
const validateCredentialsSchema = {
  body: Joi.object().keys({
    login:    Joi.string().required(),
    password: Joi.string().required(),
  }),
};

const sendOtpSchema = {
  body: Joi.object().keys({
    login:   Joi.string().required(),
    channel: Joi.string().valid('email', 'sms').required(),
  }),
};

const verifyOtpSchema = {
  body: Joi.object().keys({
    login: Joi.string().required(),
    otp:   Joi.string().length(6).pattern(/^\d{6}$/).required()
      .description('6-digit OTP code'),
  }),
};

// Step 1 — validate credentials, return available channels
router.post('/validate-credentials', validate(validateCredentialsSchema), otpController.validateCredentials);
// Step 2 — user picks channel, OTP is sent
router.post('/send-otp', validate(sendOtpSchema), otpController.sendOtp);
// Step 3 — verify OTP, receive JWT tokens
router.post('/verify-otp', validate(verifyOtpSchema), otpController.verifyOtp);
router.post('/logout', validate(refreshSchema), authController.logout);
router.post('/refresh-tokens', validate(refreshSchema), authController.refreshTokens);
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);
router.post('/change-password', auth(), validate(changePasswordSchema), authController.changePassword);
router.get('/me', auth(), authController.getMe);

module.exports = router;
