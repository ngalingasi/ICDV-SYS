const express  = require('express');
const multer   = require('multer');
const auth     = require('../../middlewares/auth');
const tenant   = require('../../middlewares/tenant');
const ctrl     = require('../../controllers/manifest.controller');

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const router = express.Router();

router.get('/next-number', auth('getManifests'), tenant(), ctrl.getNextNumber);

router.route('/')
  .get( auth('getManifests'),    tenant(), ctrl.getManifests)
  .post(auth('manageManifests'), tenant(), ctrl.createManifest);

router.route('/:manifestId')
  .get(   auth('getManifests'),    tenant(), ctrl.getManifest)
  .patch( auth('manageManifests'), tenant(), ctrl.updateManifest)
  .delete(auth('manageManifests'), tenant(), ctrl.deleteManifest);

router.post('/:manifestId/preview-csv',    auth('manageManifests'), tenant(), csvUpload.single('csv'), ctrl.previewCSV);
router.post('/:manifestId/import-vehicles',auth('manageManifests'), tenant(), csvUpload.single('csv'), ctrl.importVehicles);

module.exports = router;
