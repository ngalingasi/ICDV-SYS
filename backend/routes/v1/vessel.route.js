const express = require('express');
const auth    = require('../../middlewares/auth');
const ctrl    = require('../../controllers/vessel.controller');

const router = express.Router();

router.route('/')
  .get(auth('getVessels'),    ctrl.getVessels)
  .post(auth('manageVessels'), ctrl.createVessel);

router.route('/:vesselId')
  .get(auth('getVessels'),      ctrl.getVessel)
  .patch(auth('manageVessels'), ctrl.updateVessel)
  .delete(auth('manageVessels'), ctrl.deleteVessel);

router.patch('/:vesselId/status', auth('manageVessels'), ctrl.updateVesselStatus);

module.exports = router;
