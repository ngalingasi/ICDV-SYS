const express = require('express');
const router = express.Router();
const auth = require('../../middlewares/auth');
const lookupController = require('../../controllers/lookup.controller');

// Sectors
router.route('/sectors')
  .post(auth('manageSectors'), lookupController.createSector)
  .get(auth(), lookupController.getSectors);
router.route('/sectors/:sectorId')
  .get(auth(), lookupController.getSector)
  .patch(auth('manageSectors'), lookupController.updateSector)
  .delete(auth('manageSectors'), lookupController.deleteSector);

// Regions
router.route('/regions')
  .post(auth('manageRegions'), lookupController.createRegion)
  .get(auth(), lookupController.getRegions);
router.route('/regions/:regionId')
  .get(auth(), lookupController.getRegion)
  .patch(auth('manageRegions'), lookupController.updateRegion)
  .delete(auth('manageRegions'), lookupController.deleteRegion);

// Implementers
router.route('/implementers')
  .post(auth('manageImplementers'), lookupController.createImplementer)
  .get(auth(), lookupController.getImplementers);
router.route('/implementers/:implementerId')
  .get(auth(), lookupController.getImplementer)
  .patch(auth('manageImplementers'), lookupController.updateImplementer)
  .delete(auth('manageImplementers'), lookupController.deleteImplementer);

module.exports = router;
