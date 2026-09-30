'use strict';

const httpStatus    = require('http-status');
const catchAsync    = require('../utils/catchAsync');
const expenseModel   = require('../models/expense.model');
const { captureEvent } = require('../config/traceAndFound');

// ── Expense items catalog ───────────────────────────────────────────────────
const createExpenseItem = catchAsync(async (req, res) => {
  const item = await expenseModel.createExpenseItem(req.body, req.user.user_id);
  res.status(httpStatus.CREATED).json(item);
});

const getExpenseItems = catchAsync(async (req, res) => {
  res.json(await expenseModel.getExpenseItems({ status: req.query.status }));
});

const getExpenseItem = catchAsync(async (req, res) => {
  res.json(await expenseModel.getExpenseItemById(req.params.itemId));
});

const updateExpenseItem = catchAsync(async (req, res) => {
  res.json(await expenseModel.updateExpenseItem(req.params.itemId, req.body, req.user.user_id));
});

const deleteExpenseItem = catchAsync(async (req, res) => {
  await expenseModel.deleteExpenseItem(req.params.itemId);
  res.status(httpStatus.NO_CONTENT).send();
});

// ── Expenses ─────────────────────────────────────────────────────────────────
const createExpense = catchAsync(async (req, res) => {
  const exp = await expenseModel.createExpense(req.body, req.user.user_id);
  captureEvent('expense.created', exp.icdv_id, {
    expense_id: exp.expense_id, expense_number: exp.expense_number,
    total_amount: exp.total_amount, manifest_id: exp.manifest_id, user_id: req.user.user_id,
  });
  res.status(httpStatus.CREATED).json(exp);
});

const getExpenses = catchAsync(async (req, res) => {
  res.json(await expenseModel.getExpenses(req.query));
});

const getExpense = catchAsync(async (req, res) => {
  res.json(await expenseModel.getExpenseById(req.params.expenseId));
});

const updateExpense = catchAsync(async (req, res) => {
  res.json(await expenseModel.updateExpense(req.params.expenseId, req.body, req.user.user_id));
});

const deleteExpense = catchAsync(async (req, res) => {
  const existing = await expenseModel.getExpenseById(req.params.expenseId);
  await expenseModel.deleteExpense(req.params.expenseId);
  captureEvent('expense.deleted', existing.icdv_id, {
    expense_id: existing.expense_id, expense_number: existing.expense_number, user_id: req.user.user_id,
  });
  res.status(httpStatus.NO_CONTENT).send();
});

module.exports = {
  createExpenseItem, getExpenseItems, getExpenseItem, updateExpenseItem, deleteExpenseItem,
  createExpense, getExpenses, getExpense, updateExpense, deleteExpense,
};
