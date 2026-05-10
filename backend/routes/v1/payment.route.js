const express = require('express');
const router  = express.Router({ mergeParams: true }); // mergeParams for :activityId
const Joi     = require('joi');
const validate = require('../../middlewares/validate');
const auth    = require('../../middlewares/auth');
const upload  = require('../../middlewares/upload');
const paymentController = require('../../controllers/payment.controller');

const createSchema = {
  body: Joi.object().keys({
    amount:          Joi.number().positive().required(),
    payment_date:    Joi.date().required(),
    payment_method:  Joi.string().optional().allow('', null),
    reference_no:    Joi.string().optional().allow('', null),
    payee:           Joi.string().optional().allow('', null),
    description:     Joi.string().optional().allow('', null),
    status:          Joi.string().valid('pending', 'approved').optional(),
  }),
};

const statusSchema = {
  body: Joi.object().keys({
    status: Joi.string().valid('pending', 'approved', 'rejected').required(),
  }),
};

router.route('/')
  .get(auth('getActivities'), paymentController.getPayments)
  .post(auth('getActivities'), upload.single('evidence'), validate(createSchema), paymentController.createPayment);

router.get('/summary', auth('getActivities'), paymentController.getSummary);

router.route('/:paymentId')
  .delete(auth('getActivities'), paymentController.deletePayment);

router.patch('/:paymentId/status', auth('getActivities'), validate(statusSchema), paymentController.updateStatus);

module.exports = router;
