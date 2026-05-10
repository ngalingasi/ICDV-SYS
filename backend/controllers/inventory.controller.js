const httpStatus    = require('http-status');
const catchAsync    = require('../utils/catchAsync');
const supplierModel = require('../models/supplier.model');
const productModel  = require('../models/product.model');
const storeModel    = require('../models/store.model');

// ── Suppliers ─────────────────────────────────────────────────────────────────
const getSuppliers    = catchAsync(async (req, res) => res.send(await supplierModel.getSuppliers(req.query)));
const getSupplier     = catchAsync(async (req, res) => res.send(await supplierModel.getSupplierById(req.params.id)));
const createSupplier  = catchAsync(async (req, res) => res.status(httpStatus.CREATED).send(await supplierModel.createSupplier(req.body, req.user.user_id)));
const updateSupplier  = catchAsync(async (req, res) => res.send(await supplierModel.updateSupplier(req.params.id, req.body, req.user.user_id)));
const deleteSupplier  = catchAsync(async (req, res) => { await supplierModel.deleteSupplier(req.params.id, req.user.user_id); res.status(httpStatus.NO_CONTENT).send(); });

// ── Products ──────────────────────────────────────────────────────────────────
const getProducts     = catchAsync(async (req, res) => res.send(await productModel.getProducts(req.query)));
const getProduct      = catchAsync(async (req, res) => res.send(await productModel.getProductById(req.params.id)));
const getCategories   = catchAsync(async (req, res) => res.send(await productModel.getCategories(req.query.product_type)));
const createProduct   = catchAsync(async (req, res) => res.status(httpStatus.CREATED).send(await productModel.createProduct(req.body, req.user.user_id)));
const updateProduct   = catchAsync(async (req, res) => res.send(await productModel.updateProduct(req.params.id, req.body, req.user.user_id)));
const deleteProduct   = catchAsync(async (req, res) => { await productModel.deleteProduct(req.params.id, req.user.user_id); res.status(httpStatus.NO_CONTENT).send(); });

// ── Stores ────────────────────────────────────────────────────────────────────
const getStores       = catchAsync(async (req, res) => res.send(await storeModel.getStores(req.query)));
const getStore        = catchAsync(async (req, res) => res.send(await storeModel.getStoreById(req.params.id)));
const createStore     = catchAsync(async (req, res) => res.status(httpStatus.CREATED).send(await storeModel.createStore(req.body, req.user.user_id)));
const updateStore     = catchAsync(async (req, res) => res.send(await storeModel.updateStore(req.params.id, req.body, req.user.user_id)));
const deleteStore     = catchAsync(async (req, res) => { await storeModel.deleteStore(req.params.id, req.user.user_id); res.status(httpStatus.NO_CONTENT).send(); });

module.exports = {
  getSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier,
  getProducts, getProduct, getCategories, createProduct, updateProduct, deleteProduct,
  getStores, getStore, createStore, updateStore, deleteStore,
};
