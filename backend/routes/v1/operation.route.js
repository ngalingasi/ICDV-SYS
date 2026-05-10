const express = require('express');
const auth    = require('../../middlewares/auth');
const ctrl    = require('../../controllers/operation.controller');

const router = express.Router();

router.route('/')
  .get(auth('getOperations'),     ctrl.getOperations)
  .post(auth('manageOperations'), ctrl.createOperation);

router.route('/:operationId')
  .get(auth('getOperations'),       ctrl.getOperation)
  .patch(auth('manageOperations'),  ctrl.updateOperation)
  .delete(auth('manageOperations'), ctrl.deleteOperation);

router.patch('/:operationId/status', auth('updateOperations'), ctrl.updateOperationStatus);

module.exports = router;
