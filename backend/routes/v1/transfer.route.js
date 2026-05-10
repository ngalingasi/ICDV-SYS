const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const validate = require('../../middlewares/validate');
const auth     = require('../../middlewares/auth');
const transfer    = require('../../controllers/transfer.controller');
const catchAsync  = require('../../utils/catchAsync');
const { query }   = require('../../config/database');
const ApiError    = require('../../utils/ApiError');
const httpStatus  = require('http-status');

const itemSchema = Joi.object({ product_id: Joi.number().integer().required(), quantity: Joi.number().positive().required(), notes: Joi.string().optional().allow('',null) });

const createSchema = { body: Joi.object().keys({
  source_store_id:      Joi.number().integer().required(),
  destination_store_id: Joi.number().integer().required(),
  transfer_date:        Joi.date().required(),
  notes:                Joi.string().optional().allow('',null),
  requires_inspection:  Joi.boolean().optional(),
  requires_transit:       Joi.boolean().optional(),
  logistics_company_id:   Joi.number().integer().optional().allow(null),
  transit_method:       Joi.string().optional().allow('',null),
  transit_provider:     Joi.string().optional().allow('',null),
  tracking_number:      Joi.string().optional().allow('',null),
  expected_arrival_date:Joi.date().optional().allow(null),
  vehicle_information:  Joi.string().optional().allow('',null),
  driver_information:   Joi.string().optional().allow('',null),
  logistics_notes:      Joi.string().optional().allow('',null),
  items:                Joi.array().items(itemSchema).min(1).required(),
})};

// Stock levels for a store (used by transfer form for validation)
router.get('/store-stock/:storeId', auth('getInventory'), catchAsync(async (req, res) => {
  const rows = await query(
    `SELECT si.product_id, si.quantity, p.product_name, p.sku_barcode, p.unit_type
     FROM store_inventory si
     JOIN products p ON p.product_id = si.product_id
     WHERE si.store_id = ? AND si.quantity > 0
     ORDER BY p.product_name`,
    [req.params.storeId]
  );
  // Return as a map: product_id -> quantity
  const map = {};
  rows.forEach(r => { map[r.product_id] = { quantity: Number(r.quantity), product_name: r.product_name, sku_barcode: r.sku_barcode, unit_type: r.unit_type }; });
  res.json(map);
}));

router.route('/').get(auth('getInventory'), transfer.list).post(auth('manageInventory'), validate(createSchema), transfer.create);
router.route('/:id').get(auth('getInventory'), transfer.get).put(auth('manageInventory'), transfer.update);
router.post('/:id/approve',   auth('manageInventory'), transfer.approve);
router.post('/:id/dispatch',  auth('manageInventory'), transfer.dispatch);
router.post('/:id/receive',   auth('manageInventory'), transfer.receive);
router.post('/:id/close',     auth('manageInventory'), transfer.close);

// Create logistics shipment from transfer
router.post('/:id/create-shipment', auth('manageInventory'), catchAsync(async (req, res) => {
  const transferModel  = require('../../models/transfer.model');
  const logisticsModel = require('../../models/logistics.model');

  const t = await transferModel.getTransferById(req.params.id);
  if (!Number(t.requires_transit)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'This transfer does not require logistics/transit');
  }

  const payload = {
    source_type:              'TRANSFER',
    stock_transfer_id:        t.transfer_id,
    logistics_company_id:     req.body.logistics_company_id || t.logistics_company_id,
    tracking_number:          req.body.tracking_number          || t.tracking_number || null,
    external_reference_number:req.body.external_reference_number || null,
    shipment_description:     req.body.shipment_description || `Transfer ${t.transfer_number}`,
    pickup_location:          req.body.pickup_location    || t.source_store_name,
    delivery_location:        req.body.delivery_location  || t.destination_store_name,
    pickup_date:              req.body.pickup_date        || t.transfer_date || null,
    expected_delivery_date:   req.body.expected_delivery_date    || t.expected_arrival_date || null,
    vehicle_information:      req.body.vehicle_information       || t.vehicle_information   || null,
    driver_information:       req.body.driver_information        || t.driver_information    || null,
    transit_notes:            req.body.transit_notes || t.logistics_notes || null,
    shipment_cost:            req.body.shipment_cost    || null,
    currency_code:            req.body.currency_code    || 'TZS',
    exchange_rate:            req.body.exchange_rate    || 1,
    payment_status:           req.body.payment_status   || 'pending',
    payment_reference:        req.body.payment_reference || null,
    expense_notes:            req.body.expense_notes    || null,
    status: 'draft',
  };

  if (!payload.logistics_company_id) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Logistics company/provider is required');
  }

  const shipment = await logisticsModel.createTransaction(payload, req.user.user_id);
  res.status(httpStatus.CREATED).send(shipment);
}));
router.post('/:id/cancel',    auth('manageInventory'), transfer.cancel);

module.exports = router;
