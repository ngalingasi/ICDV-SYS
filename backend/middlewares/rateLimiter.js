const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  skipSuccessfulRequests: true,
  message: { code: 429, message: 'Too many requests, please try again later' },
});

module.exports = { authLimiter };
