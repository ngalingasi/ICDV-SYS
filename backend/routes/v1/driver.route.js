const express = require('express');
const auth   = require('../../middlewares/auth');
const tenant = require('../../middlewares/tenant');
const upload = require('../../middlewares/upload');
const ctrl   = require('../../controllers/driver.controller');
const router = express.Router();

router.route('/')
  .get( auth('getDrivers'),    tenant(), ctrl.getDrivers)
  .post(auth('manageDrivers'), tenant(), upload.single('photo'), ctrl.createDriver);

router.route('/:driverId')
  .get(   auth('getDrivers'),    tenant(), ctrl.getDriver)
  .patch( auth('manageDrivers'), tenant(), upload.single('photo'), ctrl.updateDriver)
  .delete(auth('manageDrivers'), tenant(), ctrl.deleteDriver);

module.exports = router;
