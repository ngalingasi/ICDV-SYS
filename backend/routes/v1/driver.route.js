const express = require('express');
const auth    = require('../../middlewares/auth');
const upload  = require('../../middlewares/upload');
const ctrl    = require('../../controllers/driver.controller');

const router = express.Router();

router.route('/')
  .get(auth('getDrivers'),     ctrl.getDrivers)
  .post(auth('manageDrivers'), upload.single('photo'), ctrl.createDriver);

router.route('/:driverId')
  .get(auth('getDrivers'),       ctrl.getDriver)
  .patch(auth('manageDrivers'),  upload.single('photo'), ctrl.updateDriver)
  .delete(auth('manageDrivers'), ctrl.deleteDriver);

module.exports = router;
