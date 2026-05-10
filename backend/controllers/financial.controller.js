const catchAsync      = require('../utils/catchAsync');
const financialModel  = require('../models/financial.model');

const getSummary = catchAsync(async (req, res) => {
  const projectId = req.query.project_id ? Number(req.query.project_id) : null;

  const [totals, buckets, payStatus, cashFlow, revisions, topSpend] = await Promise.all([
    financialModel.getTotals(projectId),
    financialModel.getBuckets(projectId),
    financialModel.getPaymentStatus(projectId),
    financialModel.getCashFlow(projectId),
    financialModel.getRevisionSummary(projectId),
    financialModel.getTopSpend(projectId),
  ]);

  res.json({
    totals,
    buckets,
    pay_status:  payStatus,
    cash_flow:   cashFlow,
    revisions,
    top_spend:   topSpend,
  });
});

module.exports = { getSummary };
