const express = require('express');
const multer  = require('multer');
const auth    = require('../../middlewares/auth');
const ctrl    = require('../../controllers/manifest.controller');

// Use memory storage for CSV — we parse the buffer, never save to disk
const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const router = express.Router();

router.get('/next-number', auth('getManifests'), ctrl.getNextNumber);

router.route('/')
  .get(auth('getManifests'),    ctrl.getManifests)
  .post(auth('manageManifests'), ctrl.createManifest);

router.route('/:manifestId')
  .get(auth('getManifests'),     ctrl.getManifest)
  .patch(auth('manageManifests'), ctrl.updateManifest)
  .delete(auth('manageManifests'), ctrl.deleteManifest);

router.post('/:manifestId/preview-csv',
  auth('manageManifests'), csvUpload.single('csv'), ctrl.previewCSV);

router.post('/:manifestId/import-vehicles',
  auth('manageManifests'), csvUpload.single('csv'), ctrl.importVehicles);

module.exports = router;
