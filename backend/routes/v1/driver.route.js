const express = require('express');
const auth    = require('../../middlewares/auth');
const ctrl    = require('../../controllers/driver.controller');

const router = express.Router();

router.route('/')
  .get(auth('getDrivers'),     ctrl.getDrivers)
  .post(auth('manageDrivers'), ctrl.createDriver);

router.route('/:driverId')
  .get(auth('getDrivers'),       ctrl.getDriver)
  .patch(auth('manageDrivers'),  ctrl.updateDriver)
  .delete(auth('manageDrivers'), ctrl.deleteDriver);

module.exports = router;
