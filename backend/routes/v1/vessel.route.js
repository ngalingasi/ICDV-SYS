const express = require('express');
const auth   = require('../../middlewares/auth');
const tenant = require('../../middlewares/tenant');
const ctrl   = require('../../controllers/vessel.controller');
const router = express.Router();

router.route('/')
  .get( auth('getVessels'),    tenant(), ctrl.getVessels)
  .post(auth('manageVessels'), tenant(), ctrl.createVessel);

router.route('/:vesselId')
  .get(   auth('getVessels'),    tenant(), ctrl.getVessel)
  .patch( auth('manageVessels'), tenant(), ctrl.updateVessel)
  .delete(auth('manageVessels'), tenant(), ctrl.deleteVessel);

router.patch('/:vesselId/status', auth('manageVessels'), tenant(), ctrl.updateVesselStatus);

module.exports = router;
