// ─────────────────────────────────────────────────────────────────────────────
// backend/middlewares/tenant.js
//
// Sets req.icdvId, req.isSuperAdmin, req.isSystemAdmin on every request.
//
// ┌───────────────────┬────────────────────────────────────────────────────────┐
// │ Role              │ req.icdvId behavior                                    │
// ├───────────────────┼────────────────────────────────────────────────────────┤
// │ super_admin       │ Read from body.icdv_id or query.icdv_id if present.   │
// │                   │ null otherwise (workflow routes: resolved from chassis)│
// ├───────────────────┼────────────────────────────────────────────────────────┤
// │ system_admin      │ Same as super_admin                                    │
// ├───────────────────┼────────────────────────────────────────────────────────┤
// │ ICDV user         │ Always Number(user.icdv_id) — never overridable        │
// ├───────────────────┼────────────────────────────────────────────────────────┤
// │ unassigned user   │ null; opts.strict=true → 403                           │
// └───────────────────┴────────────────────────────────────────────────────────┘
//
// IMPORTANT: For CREATE operations (manifest, vessel, vehicle, driver) the
// super_admin / system_admin MUST pass icdv_id in the request body.
// The model guards will reject null with a clear error message.
//
// For WORKFLOW routes the icdv_id is resolved automatically from the vehicle
// record in the workflow model — no icdv_id needs to be passed.
// ─────────────────────────────────────────────────────────────────────────────
const httpStatus = require('http-status');
const ApiError   = require('../utils/ApiError');
const { isSuperAdmin, isSystemAdmin } = require('../config/roles');

const tenant = (opts = {}) => (req, _res, next) => {
  // ── Super admin ─────────────────────────────────────────────────────────────
  if (isSuperAdmin(req.user)) {
    req.isSuperAdmin  = true;
    req.isSystemAdmin = false;

    // Resolve icdv_id from body first, then query string
    const raw = req.body?.icdv_id ?? req.query?.icdv_id ?? null;
    req.icdvId = raw ? Number(raw) : null;

    if (opts.required && !req.icdvId)
      return next(new ApiError(
        httpStatus.BAD_REQUEST,
        'icdv_id is required. Super admins must specify which ICDV to operate on behalf of.'
      ));
    return next();
  }

  // ── System admin ─────────────────────────────────────────────────────────────
  if (isSystemAdmin(req.user)) {
    req.isSuperAdmin  = false;
    req.isSystemAdmin = true;

    const raw = req.body?.icdv_id ?? req.query?.icdv_id ?? null;
    req.icdvId = raw ? Number(raw) : null;

    if (opts.required && !req.icdvId)
      return next(new ApiError(
        httpStatus.BAD_REQUEST,
        'icdv_id is required. System admins must specify which ICDV to operate on behalf of.'
      ));
    return next();
  }

  // ── Regular ICDV-scoped user ─────────────────────────────────────────────────
  req.isSuperAdmin  = false;
  req.isSystemAdmin = false;

  const rawId = req.user?.icdv_id ?? null;
  if (rawId) {
    req.icdvId = Number(rawId);
    return next();
  }

  // icdv_id not set on user account
  if (opts.strict)
    return next(new ApiError(httpStatus.FORBIDDEN, 'User is not assigned to an ICDV'));

  req.icdvId = null;
  next();
};

module.exports = tenant;
