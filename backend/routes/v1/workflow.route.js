/**
 * workflow.route.js
 * Mounts at /api/v1/workflow
 *
 * MIGRATION 008 — RBAC guard changes:
 *   Confirm endpoints now use per-action rights instead of the generic 'manageVehicles'.
 *   Delivery-sheet endpoints now require 'printDeliverySheet'.
 *   Two new endpoints added:
 *     PATCH /batches/:batchId/status   — backoffice document/GC status
 *     GET   /batches/:batchId/print    — batch chassis list for print
 *     GET   /transfer/tpa-stats        — TPA gate exit counts
 *
 * EXISTING ROLES (operator, supervisor, admin, system_admin, super_admin) receive
 * all new rights in config/roles.js — zero regression for existing users.
 */
const express  = require('express');
const auth     = require('../../middlewares/auth');
const tenant   = require('../../middlewares/tenant');
const ctrl     = require('../../controllers/workflow.controller');
const dsCtrl   = require('../../controllers/deliverySheet.controller');

const router = express.Router();

// ── 1. DISCHARGE ──────────────────────────────────────────────────────────────
router.get( '/discharge/lookup',  auth('getVehicles'),       tenant(), ctrl.dischargeLookup);
router.post('/discharge/confirm', auth('dischargeVehicles'), tenant(), ctrl.dischargeConfirm);

// ── 2. BATCH ──────────────────────────────────────────────────────────────────
router.get( '/batch/lookup',  auth('getVehicles'),       tenant(), ctrl.batchLookup);
router.post('/batch/confirm', auth('dischargeVehicles'), tenant(), ctrl.batchConfirm);

router.get('/batches',            auth('getVehicles'), tenant(), ctrl.listBatches);
router.get('/batches/:batchId',   auth('getVehicles'), tenant(), ctrl.getBatchDetail);

// ── 2b. BATCH STATUS (migration 008) — backoffice_officer only ─────────────────
// PATCH updates document_status and/or gc_status; operational_status is auto-computed
router.patch('/batches/:batchId/status', auth('updateBatchStatus'), tenant(), ctrl.updateBatchStatus);

// ── 2c. BATCH PRINT (migration 008) — backoffice_officer only ─────────────────
// Returns full chassis/vehicle list for printable batch view
router.get('/batches/:batchId/print', auth('printBatches'), tenant(), ctrl.getBatchPrint);

// ── 3. TRANSFER (TPA Gate) ────────────────────────────────────────────────────
router.get( '/transfer/lookup',        auth('getVehicles'),      tenant(), ctrl.transferLookup);
router.get( '/transfer/driver-lookup', auth('getVehicles'),      tenant(), ctrl.driverLookup);
router.post('/transfer/confirm',       auth('transferVehicles'), tenant(), ctrl.transferConfirm);

// ── 3b. TPA STATS (migration 008) — transfer_officer ─────────────────────────
router.get('/transfer/tpa-stats', auth('viewTpaStats'), tenant(), ctrl.getTpaStats);

// ── 4. RECEIVE (Yard) ─────────────────────────────────────────────────────────
router.get( '/receive/lookup',  auth('getVehicles'),    tenant(), ctrl.receiveLookup);
router.post('/receive/confirm', auth('receiveVehicles'), tenant(), ctrl.receiveConfirm);

// ── 5. SEARCH & HISTORY ───────────────────────────────────────────────────────
router.get('/search',                      auth('getVehicles'), tenant(), ctrl.chassisSearch);
router.get('/vehicles/:vehicleId/history', auth('getVehicles'), tenant(), ctrl.vehicleHistory);

// ── 6. DELIVERY SHEET ─────────────────────────────────────────────────────────
// Restricted to printDeliverySheet right (backoffice_officer + yard_officer)
router.get('/batches/:batchId/delivery-sheet',  auth('printDeliverySheet'), tenant(), dsCtrl.getBatchDeliverySheet);
router.get('/vessels/:vesselId/delivery-sheet', auth('printDeliverySheet'), tenant(), dsCtrl.getVesselDeliverySheet);

module.exports = router;
