const express = require('express');
const auth   = require('../../middlewares/auth');
const ctrl   = require('../../controllers/icdv.controller');
const router = express.Router();

// All routes require super_admin (only role with getIcdvs / manageIcdvs rights)
router.get( '/stats', auth('getIcdvs'), ctrl.getPlatformStats);

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
