const express = require('express');
const auth   = require('../../middlewares/auth');
const tenant = require('../../middlewares/tenant');
const ctrl   = require('../../controllers/vehicle.controller');
const router = express.Router();

router.route('/')
  .get( auth('getVehicles'),    tenant(), ctrl.getVehicles)
  .post(auth('manageVehicles'), tenant(), ctrl.createVehicle);

router.get('/search/:chassisNumber', auth('getVehicles'), tenant(), ctrl.searchByChassis);

router.route('/:vehicleId')
  .get(   auth('getVehicles'),    tenant(), ctrl.getVehicle)
  .patch( auth('manageVehicles'), tenant(), ctrl.updateVehicle)
  .delete(auth('manageVehicles'), tenant(), ctrl.deleteVehicle);

router.get('/:vehicleId/operations', auth('getVehicles'), tenant(), ctrl.getVehicleOperations);

module.exports = router;
