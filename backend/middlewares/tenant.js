// ─────────────────────────────────────────────────────────────────────────────
// backend/middlewares/tenant.js
//
// Sets req.icdvId and req.isSuperAdmin on every authenticated request.
//
// Super admin:
//   req.isSuperAdmin = true
//   req.icdvId       = null  (unless ?icdv_id=N is passed)
//
// Tenant user WITH icdv_id:
//   req.isSuperAdmin = false
//   req.icdvId       = Number(user.icdv_id)
//
// Tenant user WITHOUT icdv_id (migration not yet run, or unassigned):
//   req.isSuperAdmin = false
//   req.icdvId       = null  (no tenant filter — sees all data)
//   Pass opts.strict = true to reject these users with 403 instead.
// ─────────────────────────────────────────────────────────────────────────────
const httpStatus   = require('http-status');
const ApiError     = require('../utils/ApiError');
const { isSuperAdmin } = require('../config/roles');

const tenant = (opts = {}) => (req, _res, next) => {
  if (isSuperAdmin(req.user)) {
    req.isSuperAdmin = true;
    const scopedId = req.query.icdv_id || req.body?.icdv_id || null;
    req.icdvId = scopedId ? Number(scopedId) : null;
    if (opts.required && !req.icdvId) {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'icdv_id is required for this operation'));
    }
    return next();
  }

  req.isSuperAdmin = false;

  const rawId = req.user?.icdv_id ?? null;
  if (rawId) {
    req.icdvId = Number(rawId);
    return next();
  }

  // icdv_id not set — either migration not run, or user genuinely unassigned
  if (opts.strict) {
    return next(new ApiError(httpStatus.FORBIDDEN, 'User is not assigned to an ICDV'));
  }

  // Fallback: no tenant filter (user sees all data until they are assigned)
  req.icdvId = null;
  next();
};

module.exports = tenant;
