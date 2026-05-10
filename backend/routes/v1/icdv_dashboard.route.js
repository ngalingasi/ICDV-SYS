const express = require('express');
const auth    = require('../../middlewares/auth');
const ctrl    = require('../../controllers/dashboard.controller');

const router = express.Router();

router.get('/', auth(), ctrl.getDashboard);
router.get('/vehicle-status', auth(), ctrl.getVehicleStatusSummary);

module.exports = router;
