const passport   = require('passport');
const httpStatus = require('http-status');
const ApiError   = require('../utils/ApiError');
const { roleRights, isSuperAdmin } = require('../config/roles');

// Paths allowed even when must_change_password = 1
const PASSWORD_CHANGE_WHITELIST = [
  '/auth/change-password',
  '/auth/logout',
  '/auth/me',
];

const verifyCallback = (req, resolve, reject, requiredRights) => async (err, user, info) => {
  if (err || info || !user) {
    return reject(new ApiError(httpStatus.UNAUTHORIZED, 'Please authenticate'));
  }
  req.user = user;

  // Force password change before any other action
  if (user.must_change_password) {
    const url = req.originalUrl.split('?')[0];
    const isWhitelisted = PASSWORD_CHANGE_WHITELIST.some((suffix) =>
      url.endsWith(suffix) || url.includes(suffix)
    );
    if (!isWhitelisted) {
      return reject(new ApiError(
        httpStatus.FORBIDDEN,
        'You must change your password before continuing. POST /api/auth/change-password'
      ));
    }
  }

  if (requiredRights.length) {
    // Super admin bypasses all right checks — has access to everything
    if (isSuperAdmin(user)) {
      return resolve();
    }

    const userRights = roleRights.get(user.role) || [];
    const hasRequiredRights = requiredRights.every((right) => userRights.includes(right));

    if (!hasRequiredRights) {
      const isSelfAccess =
        req.params.userId !== undefined &&
        req.params.userId === String(user.user_id);

      if (!isSelfAccess) {
        return reject(new ApiError(httpStatus.FORBIDDEN, 'Forbidden'));
      }
    }
  }

  resolve();
};

const auth = (...requiredRights) => async (req, res, next) => {
  return new Promise((resolve, reject) => {
    passport.authenticate('jwt', { session: false }, verifyCallback(req, resolve, reject, requiredRights))(req, res, next);
  })
    .then(() => next())
    .catch((err) => next(err));
};

module.exports = auth;
