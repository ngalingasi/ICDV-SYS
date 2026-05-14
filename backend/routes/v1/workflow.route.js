/**
 * workflow.route.js
 * Mounts at /api/v1/workflow
 * Follows existing route pattern: auth() then tenant() on every route.
 */
const express  = require('express');
const auth     = require('../../middlewares/auth');
const tenant   = require('../../middlewares/tenant');
const ctrl     = require('../../controllers/workflow.controller');
const dsCtrl   = require('../../controllers/deliverySheet.controller');

const router = express.Router();

// All workflow routes require authentication and tenant scope
// Using 'getVehicles' right as minimum for lookups; 'manageVehicles' for confirmations

// ── 1. DISCHARGE ──────────────────────────────────────────────────────────────
router.get( '/discharge/lookup',  auth('getVehicles'),    tenant(), ctrl.dischargeLookup);
router.post('/discharge/confirm', auth('manageVehicles'), tenant(), ctrl.dischargeConfirm);

// ── 2. BATCH ──────────────────────────────────────────────────────────────────
router.get( '/batch/lookup',   auth('getVehicles'),    tenant(), ctrl.batchLookup);
router.post('/batch/confirm',  auth('manageVehicles'), tenant(), ctrl.batchConfirm);
router.get( '/batches',        auth('getVehicles'),    tenant(), ctrl.listBatches);
router.get( '/batches/:batchId', auth('getVehicles'), tenant(), ctrl.getBatchDetail);

// ── 3. TRANSFER (TPA Gate) ────────────────────────────────────────────────────
router.get( '/transfer/lookup',        auth('getVehicles'),    tenant(), ctrl.transferLookup);
router.get( '/transfer/driver-lookup', auth('getVehicles'),    tenant(), ctrl.driverLookup);
router.post('/transfer/confirm',       auth('manageVehicles'), tenant(), ctrl.transferConfirm);

// ── 4. RECEIVE (Yard) ─────────────────────────────────────────────────────────
router.get( '/receive/lookup',  auth('getVehicles'),    tenant(), ctrl.receiveLookup);
router.post('/receive/confirm', auth('manageVehicles'), tenant(), ctrl.receiveConfirm);

// ── 5. SEARCH & HISTORY ───────────────────────────────────────────────────────
router.get('/search',                      auth('getVehicles'), tenant(), ctrl.chassisSearch);
router.get('/vehicles/:vehicleId/history', auth('getVehicles'), tenant(), ctrl.vehicleHistory);

// ── 6. DELIVERY SHEET ─────────────────────────────────────────────────────────
router.get('/batches/:batchId/delivery-sheet',   auth('getVehicles'), tenant(), dsCtrl.getBatchDeliverySheet);
router.get('/vessels/:vesselId/delivery-sheet',  auth('getVehicles'), tenant(), dsCtrl.getVesselDeliverySheet);

module.exports = router;
