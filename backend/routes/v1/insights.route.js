'use strict';

const express = require('express');
const auth    = require('../../middlewares/auth');
const tenant  = require('../../middlewares/tenant');
const ctrl    = require('../../controllers/insights.controller');

const router = express.Router();

// All Insights — super_admin only (viewInsights right)

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

// ── Payment / Receivables ─────────────────────────────────────────────────────
router.get('/payment/summary',      auth('viewInsights'), tenant(), ctrl.getPaymentSummary);
router.get('/payment/by-icdv',      auth('viewInsights'), tenant(), ctrl.getPaymentByIcdv);
router.get('/payment/overdue',      auth('viewInsights'), tenant(), ctrl.getOverdueInvoices);

// ── Fleet Pipeline ────────────────────────────────────────────────────────────
router.get('/fleet/summary',        auth('viewInsights'), tenant(), ctrl.getFleetPipelineSummary);
router.get('/fleet/by-icdv',        auth('viewInsights'), tenant(), ctrl.getFleetPipelineByIcdv);
router.get('/fleet/stale',          auth('viewInsights'), tenant(), ctrl.getStaleVehicles);

// ── Vessel Productivity ───────────────────────────────────────────────────────
router.get('/vessels/summary',      auth('viewInsights'), tenant(), ctrl.getVesselProductivitySummary);
router.get('/vessels/list',         auth('viewInsights'), tenant(), ctrl.getVesselList);
router.get('/vessels/trend',        auth('viewInsights'), tenant(), ctrl.getMonthlyVesselTrend);

module.exports = router;
