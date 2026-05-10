const httpStatus   = require('http-status');
const catchAsync   = require('../utils/catchAsync');
const activityModel = require('../models/activity.model');
const documentModel = require('../models/document.model');
const commentModel  = require('../models/comment.model');
const { query }    = require('../config/database');
const ApiError     = require('../utils/ApiError');
const { resolveActivityPermission } = require('../utils/activityPermission');

// ── Helper: get PM for this user's activity context ────────────────────────────
const getActivityPerms = (req, activityId) =>
  resolveActivityPermission(req.user.user_id, activityId, req.user.role);

// ── List activities ───────────────────────────────────────────────────────────
// Admin/Manager: all activities (optionally filtered)
// User (role=user): only their assigned activities
const getActivities = catchAsync(async (req, res) => {
  const params = { ...req.query };

  if (req.user.role === 'user') {
    // Force filter to only assigned activities
    params.assigned_user_id = req.user.user_id;
  } else if (req.user.role === 'manager') {
    // Manager sees activities on projects they manage
    // If no specific filter, filter by their projects
    if (!params.assigned_user_id && !params.target_id) {
      params.project_manager_id = req.user.user_id;
    }
  }
  // admin: no filter — sees everything

  const result = await activityModel.getActivities(params);
  res.send(result);
});

// ── Get single activity ───────────────────────────────────────────────────────
const getActivity = catchAsync(async (req, res) => {
  const perms = await getActivityPerms(req, req.params.activityId);
  if (!perms.canView) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this activity');
  }
  res.send(perms.activity);
});

// ── Create activity ───────────────────────────────────────────────────────────
// Admin and Manager (PM) only
const createActivity = catchAsync(async (req, res) => {
  if (req.user.role === 'user') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only project managers can create activities');
  }
  const activity = await activityModel.createActivity(req.body, req.user.user_id);
  res.status(httpStatus.CREATED).send(activity);
});

// ── Update activity ───────────────────────────────────────────────────────────
// Status changes: PM and admin only
// Other field updates: PM and admin only
const updateActivity = catchAsync(async (req, res) => {
  const perms = await getActivityPerms(req, req.params.activityId);

  if (!perms.canView) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have access to this activity');
  }

  // Assigned user cannot update status
  if (perms.isAssigned && req.body.status !== undefined) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Assigned users cannot change activity status. Contact the project manager.');
  }

  // Assigned user can only update progress (not status, not reassign)
  if (perms.isAssigned) {
    const allowed = ['progress', 'description'];
    const requested = Object.keys(req.body);
    const forbidden = requested.filter(k => !allowed.includes(k));
    if (forbidden.length) {
      throw new ApiError(httpStatus.FORBIDDEN, `Assigned users can only update: ${allowed.join(', ')}`);
    }
  }

  const activity = await activityModel.updateActivity(req.params.activityId, req.body, req.user.user_id);
  res.send(activity);
});

// ── Create sub-activity ────────────────────────────────────────────────────────
// PM and admin only (not assigned user)
const createSubActivity = catchAsync(async (req, res) => {
  const perms = await getActivityPerms(req, req.params.activityId);

  if (!perms.canCreateSubActivity) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only project managers can create sub-activities');
  }

  // Auto-set main_activity_id from the parent
  req.body.main_activity_id = Number(req.params.activityId);
  // Inherit target_id from parent if not provided
  if (!req.body.target_id) {
    req.body.target_id = perms.activity.target_id;
  }

  const subActivity = await activityModel.createActivity(req.body, req.user.user_id);
  res.status(httpStatus.CREATED).send(subActivity);
});

// ── Delete activity ───────────────────────────────────────────────────────────
const deleteActivity = catchAsync(async (req, res) => {
  if (req.user.role === 'user') {
    throw new ApiError(httpStatus.FORBIDDEN, 'Insufficient permissions');
  }
  await activityModel.deleteActivity(req.params.activityId);
  res.status(httpStatus.NO_CONTENT).send();
});

// ── Status history ────────────────────────────────────────────────────────────
const getStatusHistory = catchAsync(async (req, res) => {
  const perms = await getActivityPerms(req, req.params.activityId);
  if (!perms.canView) throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
  const history = await activityModel.getActivityStatusHistory(req.params.activityId);
  res.send(history);
});

// ── Sub-activities list ───────────────────────────────────────────────────────
const getSubActivities = catchAsync(async (req, res) => {
  const perms = await getActivityPerms(req, req.params.activityId);
  if (!perms.canView) throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
  const subs = await activityModel.getSubActivities(req.params.activityId);
  // Filter for assigned user: only show subs they are assigned to
  const result = perms.isAssigned
    ? subs.filter(s => Number(s.assigned_user_id) === Number(req.user.user_id))
    : subs;
  res.send(result);
});

// ── Documents ─────────────────────────────────────────────────────────────────
const uploadDocument = catchAsync(async (req, res) => {
  const perms = await getActivityPerms(req, req.params.activityId);
  if (!perms.canUploadDocument) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to upload documents to this activity');
  }
  if (!req.file) throw new ApiError(httpStatus.BAD_REQUEST, 'No file uploaded');

  const doc = await documentModel.createDocument(
    { activity_id: Number(req.params.activityId), name: req.body.name || req.file.originalname },
    req.file,
    req.user.user_id
  );
  res.status(httpStatus.CREATED).send(doc);
});

const getDocuments = catchAsync(async (req, res) => {
  const perms = await getActivityPerms(req, req.params.activityId);
  if (!perms.canView) throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
  const docs = await documentModel.getDocumentsByActivity(Number(req.params.activityId));
  res.send(docs);
});

// ── Comments ──────────────────────────────────────────────────────────────────
const getComments = catchAsync(async (req, res) => {
  const perms = await getActivityPerms(req, req.params.activityId);
  if (!perms.canView) throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
  const comments = await commentModel.getCommentsByActivity(Number(req.params.activityId));
  res.send(comments);
});

const addComment = catchAsync(async (req, res) => {
  const perms = await getActivityPerms(req, req.params.activityId);
  if (!perms.canComment) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission to comment on this activity');
  }
  if (!req.body.comment?.trim()) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Comment text is required');
  }
  const comment = await commentModel.createComment(
    Number(req.params.activityId),
    req.user.user_id,
    req.body.comment.trim()
  );
  res.status(httpStatus.CREATED).send(comment);
});

const deleteComment = catchAsync(async (req, res) => {
  const perms = await getActivityPerms(req, req.params.activityId);
  if (!perms.canView) throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
  await commentModel.deleteComment(req.params.commentId, req.user.user_id, req.user.role);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  getActivities, getActivity, createActivity, updateActivity,
  createSubActivity, deleteActivity, getStatusHistory, getSubActivities,
  uploadDocument, getDocuments,
  getComments, addComment, deleteComment,
};
