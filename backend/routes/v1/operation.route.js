const express = require('express');
const auth   = require('../../middlewares/auth');
const tenant = require('../../middlewares/tenant');
const ctrl   = require('../../controllers/operation.controller');
const router = express.Router();

router.route('/')
  .get( auth('getOperations'),    tenant(), ctrl.getOperations)
  .post(auth('manageOperations'), tenant(), ctrl.createOperation);

router.route('/:operationId')
  .get(   auth('getOperations'),    tenant(), ctrl.getOperation)
  .patch( auth('manageOperations'), tenant(), ctrl.updateOperation)
  .delete(auth('manageOperations'), tenant(), ctrl.deleteOperation);

router.patch('/:operationId/status', auth('updateOperations'), tenant(), ctrl.updateOperationStatus);

module.exports = router;
