// ─────────────────────────────────────────────────────────────────────────────
// NEW FILE: backend/middlewares/tenant.js
//
// Place AFTER auth() in every tenant route.
// Sets req.icdvId and req.isSuperAdmin on every authenticated request.
//
// Super admin:
//   - req.isSuperAdmin = true
//   - req.icdvId       = null  (sees all tenants — no WHERE filter)
//   - Can scope to one tenant by passing ?icdv_id=N or body.icdv_id
//
// All other roles:
//   - req.isSuperAdmin = false
//   - req.icdvId       = user.icdv_id (enforced from JWT; cannot be overridden)
// ─────────────────────────────────────────────────────────────────────────────
const httpStatus = require('http-status');
const ApiError   = require('../utils/ApiError');
const { isSuperAdmin } = require('../config/roles');

const tenant = (opts = {}) => (req, _res, next) => {
  if (isSuperAdmin(req.user)) {
    req.isSuperAdmin = true;

    // Optional: super admin can scope themselves to one tenant via query/body
    const scopedId = req.query.icdv_id || req.body?.icdv_id || null;
    req.icdvId = scopedId ? Number(scopedId) : null;

    if (opts.required && !req.icdvId) {
      return next(new ApiError(httpStatus.BAD_REQUEST, 'icdv_id is required for this operation'));
    }
    return next();
  }

  // All non-super-admin users must have an icdv_id from their JWT
  if (!req.user?.icdv_id) {
    return next(new ApiError(httpStatus.FORBIDDEN, 'User is not assigned to an ICDV'));
  }

  req.isSuperAdmin = false;
  req.icdvId       = Number(req.user.icdv_id);
  next();
};

module.exports = tenant;
