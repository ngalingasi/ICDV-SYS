const catchAsync = require('../utils/catchAsync');
const dashboardModel = require('../models/dashboard.model');

const getDashboard           = catchAsync(async (req, res) => { res.json(await dashboardModel.getDashboardStats(req.icdvId)); });
const getVehicleStatusSummary= catchAsync(async (req, res) => { res.json(await dashboardModel.getVehicleStatusSummary(req.icdvId)); });

module.exports = { getDashboard, getVehicleStatusSummary };
