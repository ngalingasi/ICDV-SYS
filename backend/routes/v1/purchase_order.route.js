const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const validate = require('../../middlewares/validate');
const auth     = require('../../middlewares/auth');
const po       = require('../../controllers/purchase_order.controller');

const itemSchema = Joi.object({
  product_id:  Joi.number().integer().required(),
  description: Joi.string().optional().allow('', null),
  unit_type:   Joi.string().optional().allow('', null),
  quantity:    Joi.number().positive().required(),
  unit_price:  Joi.number().min(0).required(),
});

const createSchema = {
  body: Joi.object().keys({
    supplier_id:            Joi.number().integer().required(),
    project_id:             Joi.number().integer().optional().allow(null),
    currency_code:          Joi.string().max(10).optional().default('TZS'),
    exchange_rate:          Joi.number().min(0.000001).optional().default(1),
    order_date:             Joi.date().required(),
    expected_delivery_date: Joi.date().optional().allow(null),
    notes:                  Joi.string().optional().allow('', null),
    status:                 Joi.string().valid('draft','pending').optional(),
    items:                  Joi.array().items(itemSchema).min(0).optional(),
  }),
};

const updateSchema = {
  body: Joi.object().keys({
    supplier_id:            Joi.number().integer().optional(),
    project_id:             Joi.number().integer().optional().allow(null),
    currency_code:          Joi.string().max(10).optional(),
    exchange_rate:          Joi.number().min(0.000001).optional(),
    order_date:             Joi.date().optional(),
    expected_delivery_date: Joi.date().optional().allow(null),
    notes:                  Joi.string().optional().allow('', null),
    status:                 Joi.string().valid('draft','pending','approved','ordered',
                              'partially_received','completed','cancelled').optional(),
    items:                  Joi.array().items(itemSchema).optional(),
  }).min(1),
};

router.route('/')
  .get(auth('getInventory'),     po.list)
  .post(auth('manageInventory'), validate(createSchema), po.create);

router.route('/:id')
  .get(auth('getInventory'),     po.get)
  .put(auth('manageInventory'),  validate(updateSchema), po.update)
  .delete(auth('manageInventory'), po.remove);

router.post('/:id/cancel', auth('manageInventory'), po.cancel);

module.exports = router;
