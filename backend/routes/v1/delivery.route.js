const express = require('express');
const auth    = require('../../middlewares/auth');
const ctrl    = require('../../controllers/delivery.controller');

const router = express.Router();

router.route('/')
  .get(auth('getDeliveries'),     ctrl.getDeliveries)
  .post(auth('manageDeliveries'), ctrl.createDelivery);

router.route('/:deliveryId')
  .get(auth('getDeliveries'),       ctrl.getDelivery)
  .patch(auth('manageDeliveries'),  ctrl.updateDelivery)
  .delete(auth('manageDeliveries'), ctrl.deleteDelivery);

router.patch('/:deliveryId/status', auth('manageDeliveries'), ctrl.updateDeliveryStatus);

module.exports = router;
