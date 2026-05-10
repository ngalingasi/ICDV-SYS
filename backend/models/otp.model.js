const { query } = require('../config/database');

/**
 * Save a new OTP — invalidates all previous unused OTPs for this email first
 */
const saveOtp = async ({ email, otp_code, expires_at }) => {
  // Invalidate previous unused OTPs
  await query(
    'UPDATE otp_verifications SET used = 1 WHERE email = ? AND used = 0',
    [email]
  );
  // Insert new OTP
  const result = await query(
    'INSERT INTO otp_verifications (email, otp_code, expires_at, used) VALUES (?,?,?,0)',
    [email, otp_code, expires_at]
  );
  return { id: result.insertId };
};

/**
 * Find a valid (unused, not expired) OTP
 */
const findValidOtp = async ({ email, otp_code }) => {
  const rows = await query(
    `SELECT * FROM otp_verifications
     WHERE email = ?
       AND otp_code = ?
       AND used = 0
       AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [email, otp_code]
  );
  return rows.length ? rows[0] : null;
};

/**
 * Mark an OTP as used after successful verification
 */
const markOtpUsed = async (id) => {
  await query('UPDATE otp_verifications SET used = 1 WHERE id = ?', [id]);
};

/**
 * Delete expired OTPs — call periodically to keep table clean
 */
const cleanExpiredOtps = async () => {
  await query('DELETE FROM otp_verifications WHERE expires_at < NOW()', []);
};

module.exports = { saveOtp, findValidOtp, markOtpUsed, cleanExpiredOtps };
