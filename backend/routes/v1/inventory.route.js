const express = require('express');
const router  = express.Router();
const Joi     = require('joi');
const validate    = require('../../middlewares/validate');
const auth        = require('../../middlewares/auth');
const inventory   = require('../../controllers/inventory.controller');

// ── Schemas ───────────────────────────────────────────────────────────────────
const supplierSchema = {
  body: Joi.object().keys({
    company_name:    Joi.string().required(),
    contact_person:  Joi.string().optional().allow('', null),
    email:           Joi.string().email().optional().allow('', null),
    phone_number:    Joi.string().optional().allow('', null),
    address:         Joi.string().optional().allow('', null),
    region_id:       Joi.number().integer().optional().allow(null),
    tax_number:      Joi.string().optional().allow('', null),
    country:         Joi.string().optional().allow('', null),
    currency:        Joi.string().max(10).optional().allow('', null),
    notes:           Joi.string().optional().allow('', null),
    status:          Joi.string().valid('active','inactive','suspended').optional(),
  }),
};

const productSchema = {
  body: Joi.object().keys({
    sku_barcode:    Joi.string().optional().allow('', null),
    product_name:   Joi.string().required(),
    product_type:   Joi.string().valid('hardware','software').required(),
    category_id:    Joi.number().integer().optional().allow(null),
    brand:          Joi.string().optional().allow('', null),
    unit_type:      Joi.string().optional().allow('', null),
    description:    Joi.string().optional().allow('', null),
    status:         Joi.string().valid('active','inactive','discontinued').optional(),
  }),
};

const storeSchema = {
  body: Joi.object().keys({
    store_name:      Joi.string().required(),
    region_id:       Joi.number().integer().required(),
    address:         Joi.string().optional().allow('', null),
    latitude:        Joi.number().min(-90).max(90).optional().allow(null),
    longitude:       Joi.number().min(-180).max(180).optional().allow(null),
    contact_number:  Joi.string().optional().allow('', null),
    manager_name:    Joi.string().optional().allow('', null),
    capacity:        Joi.number().integer().min(0).optional().allow(null),
    notes:           Joi.string().optional().allow('', null),
    status:          Joi.string().valid('active','inactive','maintenance').optional(),
  }),
};

// ── Suppliers ─────────────────────────────────────────────────────────────────
router.route('/suppliers')
  .get(auth('getInventory'),    inventory.getSuppliers)
  .post(auth('manageInventory'), validate(supplierSchema), inventory.createSupplier);

router.route('/suppliers/:id')
  .get(auth('getInventory'),     inventory.getSupplier)
  .patch(auth('manageInventory'), inventory.updateSupplier)
  .delete(auth('manageInventory'), inventory.deleteSupplier);

// ── Products ──────────────────────────────────────────────────────────────────
router.get('/products/meta/categories', auth('getInventory'), inventory.getCategories);

router.route('/products')
  .get(auth('getInventory'),     inventory.getProducts)
  .post(auth('manageInventory'), validate(productSchema), inventory.createProduct);

router.route('/products/:id')
  .get(auth('getInventory'),     inventory.getProduct)
  .patch(auth('manageInventory'), inventory.updateProduct)
  .delete(auth('manageInventory'), inventory.deleteProduct);

// ── Stores ────────────────────────────────────────────────────────────────────
router.route('/stores')
  .get(auth('getInventory'),     inventory.getStores)
  .post(auth('manageInventory'), validate(storeSchema), inventory.createStore);

router.route('/stores/:id')
  .get(auth('getInventory'),     inventory.getStore)
  .patch(auth('manageInventory'), inventory.updateStore)
  .delete(auth('manageInventory'), inventory.deleteStore);

module.exports = router;
