'use strict';

const express = require('express');
const auth    = require('../../middlewares/auth');
const tenant  = require('../../middlewares/tenant');
const ctrl    = require('../../controllers/expense.controller');

const router = express.Router();

// Entire module is super_admin only (manageExpenses right) — no ICDV-side
// access, no separate view/manage split, no approval workflow.

// ── Expense items catalog ───────────────────────────────────────────────────
router.route('/items')
  .post(auth('manageExpenses'), tenant(), ctrl.createExpenseItem)
  .get( auth('manageExpenses'), tenant(), ctrl.getExpenseItems);

router.route('/items/:itemId')
  .get(   auth('manageExpenses'), tenant(), ctrl.getExpenseItem)
  .patch( auth('manageExpenses'), tenant(), ctrl.updateExpenseItem)
  .delete(auth('manageExpenses'), tenant(), ctrl.deleteExpenseItem);

// ── Expenses ─────────────────────────────────────────────────────────────────
router.route('/')
  .post(auth('manageExpenses'), tenant(), ctrl.createExpense)
  .get( auth('manageExpenses'), tenant(), ctrl.getExpenses);

router.route('/:expenseId')
  .get(   auth('manageExpenses'), tenant(), ctrl.getExpense)
  .patch( auth('manageExpenses'), tenant(), ctrl.updateExpense)
  .delete(auth('manageExpenses'), tenant(), ctrl.deleteExpense);

module.exports = router;
