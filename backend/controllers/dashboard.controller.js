const catchAsync = require('../utils/catchAsync');
const dashboardModel = require('../models/dashboard.model');

const getDashboard = catchAsync(async (req, res) => {
  const data = await dashboardModel.getDashboardStats();
  res.json(data);
});

const getVehicleStatusSummary = catchAsync(async (req, res) => {
  const data = await dashboardModel.getVehicleStatusSummary();
  res.json(data);
});

module.exports = { getDashboard, getVehicleStatusSummary };
