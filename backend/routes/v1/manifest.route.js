const express = require('express');
const auth    = require('../../middlewares/auth');
const ctrl    = require('../../controllers/manifest.controller');

const router = express.Router();

router.route('/')
  .get(auth('getManifests'),     ctrl.getManifests)
  .post(auth('manageManifests'), ctrl.createManifest);

router.route('/:manifestId')
  .get(auth('getManifests'),       ctrl.getManifest)
  .patch(auth('manageManifests'),  ctrl.updateManifest)
  .delete(auth('manageManifests'), ctrl.deleteManifest);

router.post('/:manifestId/import-vehicles', auth('manageManifests'), ctrl.importVehicles);

module.exports = router;
