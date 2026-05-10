const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const budgetModel = require('../models/budget.model');

// ─── Project Budget ───────────────────────────────────────────────────────────
const getProjectBudgetSummary = catchAsync(async (req, res) => {
  const summary = await budgetModel.getProjectBudgetSummary(req.params.projectId);
  res.send(summary);
});

const getProjectBudgetStatus = catchAsync(async (req, res) => {
  const status = await budgetModel.getProjectBudgetStatus(req.params.projectId);
  res.send(status);
});

// ─── Target Budget ────────────────────────────────────────────────────────────
const allocateTargetBudget = catchAsync(async (req, res) => {
  const result = await budgetModel.allocateTargetBudget(
    req.params.targetId,
    Number(req.body.amount),
    req.user.user_id
  );
  res.send(result);
});

const getTargetBudgetSummary = catchAsync(async (req, res) => {
  const summary = await budgetModel.getTargetBudgetSummary(req.params.targetId);
  res.send(summary);
});

// ─── Budget Revision Requests ─────────────────────────────────────────────────
const requestRevision = catchAsync(async (req, res) => {
  const revision = await budgetModel.requestBudgetRevision(
    req.params.activityId,
    Number(req.body.requested_amount),
    req.body.reason,
    req.user.user_id
  );
  res.status(httpStatus.CREATED).send(revision);
});

const getRevisions = catchAsync(async (req, res) => {
  const revisions = await budgetModel.getRevisions(req.query);
  res.send(revisions);
});

const getRevision = catchAsync(async (req, res) => {
  const revision = await budgetModel.getRevisionById(req.params.revisionId);
  res.send(revision);
});

const approveRevision = catchAsync(async (req, res) => {
  const revision = await budgetModel.approveRevision(
    req.params.revisionId,
    req.user.user_id,
    req.body.review_notes
  );
  res.send(revision);
});

const rejectRevision = catchAsync(async (req, res) => {
  const revision = await budgetModel.rejectRevision(
    req.params.revisionId,
    req.user.user_id,
    req.body.review_notes
  );
  res.send(revision);
});

module.exports = {
  getProjectBudgetSummary, getProjectBudgetStatus,
  allocateTargetBudget, getTargetBudgetSummary,
  requestRevision, getRevisions, getRevision, approveRevision, rejectRevision,
};
