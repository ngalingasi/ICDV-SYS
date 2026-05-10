const nodemailer = require('nodemailer');
const config = require('../config/config');
const logger = require('../config/logger');

const transport = nodemailer.createTransport(config.email.smtp);

/* istanbul ignore next */
if (config.env !== 'test') {
  transport
    .verify()
    .then(() => logger.info('Email server connected'))
    .catch((err) => logger.warn(`Email server connection failed: ${err.message}`));
}

/**
 * Send an email
 */
const sendEmail = async (to, subject, html) => {
  const msg = { from: config.email.from, to, subject, html };
  await transport.sendMail(msg);
};

/**
 * Send reset password email
 */
const sendResetPasswordEmail = async (to, token) => {
  const subject = 'Reset your password – TPFCS Projects';
  const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
  const html = `
    <p>Hi,</p>
    <p>You requested a password reset. Click the link below to set a new password:</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
    <p>This link expires in ${config.jwt.resetPasswordExpirationMinutes} minutes.</p>
    <p>If you did not request this, ignore this email.</p>
  `;
  await sendEmail(to, subject, html);
};

/**
 * Send email verification
 */
const sendVerificationEmail = async (to, token) => {
  const subject = 'Verify your email – TPFCS Projects';
  const verifyUrl = `${process.env.APP_URL || 'http://localhost:3000'}/verify-email?token=${token}`;
  const html = `
    <p>Hi,</p>
    <p>Please verify your email address by clicking the link below:</p>
    <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    <p>This link expires in ${config.jwt.verifyEmailExpirationMinutes} minutes.</p>
  `;
  await sendEmail(to, subject, html);
};

/**
 * Send account welcome / credentials email
 */
const sendWelcomeEmail = async (to, fullName, username, tempPassword) => {
  const subject = 'Welcome to TPFCS Project Management System';
  const html = `
    <p>Dear ${fullName},</p>
    <p>Your account has been created on the TPFCS Project Management System.</p>
    <p><strong>Username:</strong> ${username}<br/>
       <strong>Temporary Password:</strong> ${tempPassword}</p>
    <p>Please log in and change your password immediately.</p>
    <p>Regards,<br/>TPFCS System Administrator</p>
  `;
  await sendEmail(to, subject, html);
};

/**
 * Send OTP via email
 */
const sendOtpEmail = async (to, otp_code) => {
  const subject = 'Your One-Time Password (OTP) – TPFCS';
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;
                border:1px solid #e0e0e0;border-radius:8px;padding:32px;">
      <h2 style="color:#333;margin-bottom:8px;">Login Verification</h2>
      <p style="color:#555;">
        Use the OTP below to complete your sign-in.
        It expires in <strong>10 minutes</strong>.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <span style="font-size:40px;font-weight:bold;letter-spacing:12px;
                     color:#1a1a2e;background:#f4f4f8;padding:16px 24px;
                     border-radius:8px;display:inline-block;">
          ${otp_code}
        </span>
      </div>
      <p style="color:#888;font-size:13px;">
        If you did not attempt to log in, please ignore this email
        or contact your administrator immediately.
      </p>
    </div>
  `;
  await sendEmail(to, subject, html);
};

module.exports = { sendEmail, sendResetPasswordEmail, sendVerificationEmail, sendWelcomeEmail, sendOtpEmail };
