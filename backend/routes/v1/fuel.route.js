/**
 * fuel.route.js
 *
 * Mounted at /api/v1/fuel and also adds sub-routes under /api/v1/manifests/:manifestId/fuel
 * (the manifest sub-routes are registered from manifest.route.js via fuelRouter export)
 *
 * Rights:
 *   viewFuel          — GET orders, stock, dashboard
 *   createFuelOrders  — POST new fuel order
 *   approveFuelOrders — PATCH approve / reject
 *   dispenseFuel      — POST dispense to vehicle
 */
const express = require('express');
const auth    = require('../../middlewares/auth');
const tenant  = require('../../middlewares/tenant');
const ctrl    = require('../../controllers/fuel.controller');

// ── Sub-router for /manifests/:manifestId/fuel/* ──────────────────────────────
const manifestFuelRouter = express.Router({ mergeParams: true });

manifestFuelRouter.get( '/orders',              auth('viewFuel'),           tenant(), ctrl.listOrders);
manifestFuelRouter.post('/orders',              auth('createFuelOrders'),   tenant(), ctrl.createOrder);
manifestFuelRouter.get( '/orders/:orderId',     auth('viewFuel'),           tenant(), ctrl.getOrder);
manifestFuelRouter.patch('/orders/:orderId/approve', auth('approveFuelOrders'), tenant(), ctrl.approveOrder);
manifestFuelRouter.patch('/orders/:orderId/reject',  auth('approveFuelOrders'), tenant(), ctrl.rejectOrder);
manifestFuelRouter.get( '/dashboard',           auth('viewFuel'),           tenant(), ctrl.getDashboard);

// ── Top-level /fuel/* for dispense operations (vehicle-centric, not manifest-centric) ──
const fuelRouter = express.Router();

fuelRouter.get( '/lookup',   auth('dispenseFuel'), tenant(), ctrl.lookup);
fuelRouter.post('/dispense', auth('dispenseFuel'), tenant(), ctrl.dispense);

module.exports = { fuelRouter, manifestFuelRouter };
