const express = require('express');
const auth   = require('../../middlewares/auth');
const tenant = require('../../middlewares/tenant');
const ctrl   = require('../../controllers/icdv.controller');
const router = express.Router();

// All routes below require super_admin (only role with getIcdvs / manageIcdvs rights)
router.get( '/stats', auth('getIcdvs'), ctrl.getPlatformStats);

// Exception: any authenticated ICDV user can read their OWN ICDV's batch
// capacity (narrow, read-only — does not expose the rest of the ICDV record).
// Must be declared before /:icdvId so "me" isn't swallowed as an icdvId param.
router.get('/me/batch-capacity', auth('getVehicles'), tenant(), ctrl.getBatchCapacity);

router.route('/')
  .get( auth('getIcdvs'),    ctrl.getIcdvs)
  .post(auth('manageIcdvs'), ctrl.createIcdv);

router.route('/:icdvId')
  .get(   auth('getIcdvs'),    ctrl.getIcdv)
  .patch( auth('manageIcdvs'), ctrl.updateIcdv)
  .delete(auth('manageIcdvs'), ctrl.deleteIcdv);

router.get( '/:icdvId/users',  auth('manageIcdvs'), ctrl.getIcdvUsers);
router.post('/:icdvId/admins', auth('manageIcdvs'), ctrl.createIcdvAdmin);

module.exports = router;
