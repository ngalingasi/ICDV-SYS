const express = require('express');
const auth    = require('../../middlewares/auth');
const ctrl    = require('../../controllers/vehicle.controller');

const router = express.Router();

router.route('/')
  .get(auth('getVehicles'),     ctrl.getVehicles)
  .post(auth('manageVehicles'), ctrl.createVehicle);

router.get('/search/:chassisNumber', auth('getVehicles'), ctrl.searchByChassis);

router.route('/:vehicleId')
  .get(auth('getVehicles'),       ctrl.getVehicle)
  .patch(auth('manageVehicles'),  ctrl.updateVehicle)
  .delete(auth('manageVehicles'), ctrl.deleteVehicle);

router.get('/:vehicleId/operations', auth('getVehicles'), ctrl.getVehicleOperations);

module.exports = router;
