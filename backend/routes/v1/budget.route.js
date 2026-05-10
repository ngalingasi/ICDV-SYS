const express = require('express');
const router = express.Router();
const Joi = require('joi');
const validate = require('../../middlewares/validate');
const auth = require('../../middlewares/auth');
const budgetController = require('../../controllers/budget.controller');

const allocateSchema = {
  params: Joi.object().keys({ targetId: Joi.number().integer().required() }),
  body: Joi.object().keys({
    amount: Joi.number().positive().required()
      .description('Budget amount to allocate to this target'),
  }),
};

const revisionRequestSchema = {
  params: Joi.object().keys({ activityId: Joi.number().integer().required() }),
  body: Joi.object().keys({
    requested_amount: Joi.number().positive().required()
      .description('New total budget amount requested (must be greater than current)'),
    reason: Joi.string().min(10).required()
      .description('Justification for the extra budget'),
  }),
};

const reviewSchema = {
  params: Joi.object().keys({ revisionId: Joi.number().integer().required() }),
  body: Joi.object().keys({
    review_notes: Joi.string().optional().allow('', null),
  }),
};

// ─── Project budget ───────────────────────────────────────────────────────────
router.get('/projects/:projectId/summary',
  auth('getProjects'), budgetController.getProjectBudgetSummary);

router.get('/projects/:projectId/status',
  auth('getProjects'), budgetController.getProjectBudgetStatus);

// ─── Target budget allocation ─────────────────────────────────────────────────
router.put('/targets/:targetId/allocate',
  auth('manageProjects'), validate(allocateSchema), budgetController.allocateTargetBudget);

router.get('/targets/:targetId/summary',
  auth('getProjects'), budgetController.getTargetBudgetSummary);

// ─── Budget revision requests ─────────────────────────────────────────────────
router.get('/revisions',
  auth('getProjects'), budgetController.getRevisions);

router.get('/revisions/:revisionId',
  auth('getProjects'), budgetController.getRevision);

router.post('/activities/:activityId/revisions',
  auth(), validate(revisionRequestSchema), budgetController.requestRevision);

router.put('/revisions/:revisionId/approve',
  auth('manageProjects'), validate(reviewSchema), budgetController.approveRevision);

router.put('/revisions/:revisionId/reject',
  auth('manageProjects'), validate(reviewSchema), budgetController.rejectRevision);


module.exports = router;
