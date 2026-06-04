const express = require('express');
const auth   = require('../../middlewares/auth');
const tenant = require('../../middlewares/tenant');
const ctrl   = require('../../controllers/dashboard.controller');
const router = express.Router();

router.get('/',                      auth(), tenant(), ctrl.getDashboard);
router.get('/vehicle-status',        auth(), tenant(), ctrl.getVehicleStatusSummary);
router.get('/manifest/:manifestId',  auth(), tenant(), ctrl.getManifestDashboard);

module.exports = router;
