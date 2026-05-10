/**
 * Activity Permission Helper
 *
 * Resolves the requesting user's relationship to an activity and
 * returns a set of boolean flags that controllers use to gate access.
 *
 * Relationship hierarchy:
 *   admin         → full access to everything
 *   project_manager (the project's project_manager_id) → PM-level access
 *   assigned_user (activity.assigned_user_id)          → limited access
 *   other                                               → no access
 */

const httpStatus = require('http-status');
const { query }  = require('../config/database');
const ApiError   = require('./ApiError');

/**
 * Resolve permissions for a user against a specific activity.
 * @param {number} userId
 * @param {number} activityId
 * @returns {Promise<{
 *   isAdmin: boolean,
 *   isPM: boolean,
 *   isAssigned: boolean,
 *   canView: boolean,
 *   canUpdateStatus: boolean,
 *   canCreateSubActivity: boolean,
 *   canUploadDocument: boolean,
 *   canComment: boolean,
 *   activity: object
 * }>}
 */
const resolveActivityPermission = async (userId, activityId, userRole) => {
  // Load activity + its project manager via target → objective → project chain
  const rows = await query(
    `SELECT a.*,
            p.project_manager_id,
            p.project_id
     FROM activities a
     JOIN targets    t  ON t.target_id    = a.target_id
     JOIN objectives ob ON ob.objective_id = t.objective_id
     JOIN projects   p  ON p.project_id   = ob.project_id
     WHERE a.activity_id = ?`,
    [activityId]
  );

  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Activity not found');

  const activity   = rows[0];
  const isAdmin    = userRole === 'admin';
  const isPM       = !isAdmin && Number(activity.project_manager_id) === Number(userId);
  const isAssigned = !isAdmin && !isPM && Number(activity.assigned_user_id) === Number(userId);

  return {
    isAdmin,
    isPM,
    isAssigned,
    activity,
    // View: admin, PM, or assigned user only
    canView:             isAdmin || isPM || isAssigned,
    // Status updates: admin and PM only
    canUpdateStatus:     isAdmin || isPM,
    // Create sub-activity: admin and PM only
    canCreateSubActivity:isAdmin || isPM,
    // Upload document: admin always, PM for any activity in project, user only on assigned
    canUploadDocument:   isAdmin || isPM || isAssigned,
    // Comment: same as document
    canComment:          isAdmin || isPM || isAssigned,
  };
};

/**
 * Middleware factory — resolves permissions and attaches to req.activityPerms
 * Throws 403 if the user has no relationship to the activity.
 */
const requireActivityAccess = () => async (req, res, next) => {
  try {
    const activityId = req.params.activityId;
    const perms = await resolveActivityPermission(
      req.user.user_id,
      activityId,
      req.user.role
    );
    if (!perms.canView) {
      throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this activity');
    }
    req.activityPerms = perms;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { resolveActivityPermission, requireActivityAccess };
