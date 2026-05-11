const express = require('express');
const auth   = require('../../middlewares/auth');
const tenant = require('../../middlewares/tenant');
const ctrl   = require('../../controllers/delivery.controller');
const router = express.Router();

router.route('/')
  .get( auth('getDeliveries'),    tenant(), ctrl.getDeliveries)
  .post(auth('manageDeliveries'), tenant(), ctrl.createDelivery);

router.route('/:deliveryId')
  .get(   auth('getDeliveries'),    tenant(), ctrl.getDelivery)
  .patch( auth('manageDeliveries'), tenant(), ctrl.updateDelivery)
  .delete(auth('manageDeliveries'), tenant(), ctrl.deleteDelivery);

router.patch('/:deliveryId/status', auth('manageDeliveries'), tenant(), ctrl.updateDeliveryStatus);

module.exports = router;
