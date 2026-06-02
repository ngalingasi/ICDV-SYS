const express  = require('express');
const multer   = require('multer');
const auth     = require('../../middlewares/auth');
const tenant   = require('../../middlewares/tenant');
const ctrl     = require('../../controllers/manifest.controller');
const dsCtrl   = require('../../controllers/deliverySheet.controller');
const { manifestFuelRouter } = require('./fuel.route');

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'text/csv',
      'application/csv',
      'application/vnd.ms-excel',                                          // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/octet-stream', // some browsers send this for .xlsx
    ];
    const ext = file.originalname.split('.').pop().toLowerCase();
    if (allowed.includes(file.mimetype) || ['csv','xlsx','xls'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files are allowed'), false);
    }
  },
});
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

// ── Delivery Sheet ────────────────────────────────────────────────────────────
// Restricted to printDeliverySheet right (migration 008)
router.get('/:manifestId/delivery-sheet',          auth('printDeliverySheet'), tenant(), dsCtrl.getManifestDeliverySheet);
router.get('/:manifestId/delivery-sheet/combined', auth('printDeliverySheet'), tenant(), dsCtrl.getCombinedDeliverySheet);

// ── Fuel ──────────────────────────────────────────────────────────────────────
router.use('/:manifestId/fuel', manifestFuelRouter);

module.exports = router;
