'use strict';

const express = require('express');
const auth    = require('../../middlewares/auth');
const tenant  = require('../../middlewares/tenant');
const ctrl    = require('../../controllers/insights.controller');

const router = express.Router();

// All Insights routes — super_admin only (viewInsights right)
// Mounted at /api/v1/insights by routes/v1/index.js

// ── Profit & Loss ─────────────────────────────────────────────────────────────
router.get('/profit-summary',       auth('viewInsights'), tenant(), ctrl.getProfitSummary);
router.get('/profit-by-icdv',       auth('viewInsights'), tenant(), ctrl.getProfitByIcdv);
router.get('/profit-trend',         auth('viewInsights'), tenant(), ctrl.getProfitTrend);
router.get('/revenue-by-status',    auth('viewInsights'), tenant(), ctrl.getRevenueByStatusTrend);
router.get('/profit-by-manifest',   auth('viewInsights'), tenant(), ctrl.getProfitByManifest);

// ── Transfer Turnaround ───────────────────────────────────────────────────────
router.get('/turnaround/summary',   auth('viewInsights'), tenant(), ctrl.getTurnaroundSummary);
router.get('/turnaround/trend',     auth('viewInsights'), tenant(), ctrl.getTurnaroundTrend);
router.get('/turnaround/by-icdv',   auth('viewInsights'), tenant(), ctrl.getTurnaroundByIcdv);
router.get('/turnaround/by-driver', auth('viewInsights'), tenant(), ctrl.getTurnaroundByDriver);
router.get('/turnaround/slowest',   auth('viewInsights'), tenant(), ctrl.getSlowestTransfers);

module.exports = router;
