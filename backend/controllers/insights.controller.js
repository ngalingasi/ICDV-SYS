'use strict';

const catchAsync     = require('../utils/catchAsync');
const insightsModel  = require('../models/insights.model');

// ── Profit & Loss ─────────────────────────────────────────────────────────────
const getProfitSummary        = catchAsync(async (req, res) => { res.json(await insightsModel.getProfitSummary(req.query)); });
const getProfitByIcdv         = catchAsync(async (req, res) => { res.json(await insightsModel.getProfitByIcdv(req.query)); });
const getProfitTrend          = catchAsync(async (req, res) => { res.json(await insightsModel.getProfitTrend(req.query)); });
const getRevenueByStatusTrend = catchAsync(async (req, res) => { res.json(await insightsModel.getRevenueByStatusTrend(req.query)); });
const getProfitByManifest     = catchAsync(async (req, res) => { res.json(await insightsModel.getProfitByManifest(req.query)); });

// ── Transfer Turnaround ───────────────────────────────────────────────────────
const getTurnaroundSummary  = catchAsync(async (req, res) => { res.json(await insightsModel.getTurnaroundSummary(req.query)); });
const getTurnaroundTrend    = catchAsync(async (req, res) => { res.json(await insightsModel.getTurnaroundTrend(req.query)); });
const getTurnaroundByIcdv   = catchAsync(async (req, res) => { res.json(await insightsModel.getTurnaroundByIcdv(req.query)); });
const getTurnaroundByDriver = catchAsync(async (req, res) => { res.json(await insightsModel.getTurnaroundByDriver(req.query)); });
const getSlowestTransfers   = catchAsync(async (req, res) => { res.json(await insightsModel.getSlowestTransfers(req.query)); });

// ── Payment / Receivables ─────────────────────────────────────────────────────
const getPaymentSummary   = catchAsync(async (req, res) => { res.json(await insightsModel.getPaymentSummary(req.query)); });
const getPaymentByIcdv    = catchAsync(async (req, res) => { res.json(await insightsModel.getPaymentByIcdv(req.query)); });
const getOverdueInvoices  = catchAsync(async (req, res) => { res.json(await insightsModel.getOverdueInvoices(req.query)); });

// ── Fleet Pipeline ────────────────────────────────────────────────────────────
const getFleetPipelineSummary = catchAsync(async (req, res) => { res.json(await insightsModel.getFleetPipelineSummary()); });
const getFleetPipelineByIcdv  = catchAsync(async (req, res) => { res.json(await insightsModel.getFleetPipelineByIcdv()); });
const getStaleVehicles        = catchAsync(async (req, res) => { res.json(await insightsModel.getStaleVehicles(req.query)); });

// ── Vessel Productivity ───────────────────────────────────────────────────────
const getVesselProductivitySummary = catchAsync(async (req, res) => { res.json(await insightsModel.getVesselProductivitySummary()); });
const getVesselList                = catchAsync(async (req, res) => { res.json(await insightsModel.getVesselList(req.query)); });
const getMonthlyVesselTrend        = catchAsync(async (req, res) => { res.json(await insightsModel.getMonthlyVesselTrend(req.query)); });

module.exports = {
  // Profit & Loss
  getProfitSummary, getProfitByIcdv, getProfitTrend, getRevenueByStatusTrend, getProfitByManifest,
  // Transfer Turnaround
  getTurnaroundSummary, getTurnaroundTrend, getTurnaroundByIcdv, getTurnaroundByDriver, getSlowestTransfers,
  // Payment / Receivables
  getPaymentSummary, getPaymentByIcdv, getOverdueInvoices,
  // Fleet Pipeline
  getFleetPipelineSummary, getFleetPipelineByIcdv, getStaleVehicles,
  // Vessel Productivity
  getVesselProductivitySummary, getVesselList, getMonthlyVesselTrend,
};
