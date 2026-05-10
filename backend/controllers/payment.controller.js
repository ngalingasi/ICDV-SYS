const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const paymentModel = require('../models/payment.model');
const { resolveActivityPermission } = require('../utils/activityPermission');
const ApiError = require('../utils/ApiError');

// Only PM and admin can record/approve payments
const requirePMOrAdmin = (perms) => {
  if (!perms.isAdmin && !perms.isPM) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only project managers and admins can manage payments');
  }
};

const getPayments = catchAsync(async (req, res) => {
  const perms = await resolveActivityPermission(req.user.user_id, req.params.activityId, req.user.role);
  if (!perms.canView) throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
  const payments = await paymentModel.getPayments(Number(req.params.activityId));
  res.send(payments);
});

const getSummary = catchAsync(async (req, res) => {
  const perms = await resolveActivityPermission(req.user.user_id, req.params.activityId, req.user.role);
  if (!perms.canView) throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
  const summary = await paymentModel.getPaymentSummary(Number(req.params.activityId));
  res.send(summary);
});

const createPayment = catchAsync(async (req, res) => {
  const perms = await resolveActivityPermission(req.user.user_id, req.params.activityId, req.user.role);
  requirePMOrAdmin(perms);
  const payment = await paymentModel.createPayment(
    Number(req.params.activityId),
    req.body,
    req.file ?? null,
    req.user.user_id
  );
  res.status(httpStatus.CREATED).send(payment);
});

const updateStatus = catchAsync(async (req, res) => {
  const perms = await resolveActivityPermission(req.user.user_id, req.params.activityId, req.user.role);
  // Only admin can approve/reject
  if (!perms.isAdmin && !perms.isPM) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only project managers and admins can approve payments');
  }
  const payment = await paymentModel.updatePaymentStatus(
    req.params.paymentId,
    req.body.status,
    req.user.user_id
  );
  res.send(payment);
});

const deletePayment = catchAsync(async (req, res) => {
  const perms = await resolveActivityPermission(req.user.user_id, req.params.activityId, req.user.role);
  if (!perms.canView) throw new ApiError(httpStatus.FORBIDDEN, 'Access denied');
  await paymentModel.deletePayment(req.params.paymentId, req.user.user_id, req.user.role);
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = { getPayments, getSummary, createPayment, updateStatus, deletePayment };
