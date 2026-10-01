const catchAsync = require('../utils/catchAsync');
const dashboardModel = require('../models/dashboard.model');
const { captureMetric } = require('../config/traceAndFound');

// Sampled each time the dashboard loads (not on a timer) — these are the
// platform-health numbers worth charting over time on the TraceAndFound side.
const DASHBOARD_METRIC_KEYS = [
  'total_vessels', 'total_manifests', 'total_vehicles',
  'released_vehicles', 'delivered_vehicles', 'unreleased_vehicles',
  'manifested_count', 'discharged_count', 'batched_count',
  'in_transit_count', 'received_count', 'open_batches',
];

const getDashboard           = catchAsync(async (req, res) => {
  const data = await dashboardModel.getDashboardStats(req.icdvId);
  for (const key of DASHBOARD_METRIC_KEYS) {
    if (data.stats[key] !== undefined) captureMetric(`dashboard.${key}`, req.icdvId, Number(data.stats[key]), { unit: 'vehicles' });
  }
  res.json(data);
});
const getVehicleStatusSummary= catchAsync(async (req, res) => { res.json(await dashboardModel.getVehicleStatusSummary(req.icdvId)); });
const getManifestDashboard   = catchAsync(async (req, res) => {
  res.json(await dashboardModel.getManifestDashboardStats(Number(req.params.manifestId), req.icdvId));
});

module.exports = { getDashboard, getVehicleStatusSummary, getManifestDashboard };
