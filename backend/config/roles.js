/**
 * ICDV — Role & permissions (multi-tenant)
 *
 * ── EXISTING ROLES (unchanged) ────────────────────────────────────────────────
 * operator       : day-to-day port operations (read + update ops)
 * supervisor     : manage drivers, manifests, operations, deliveries
 * admin          : full ICDV access including user management and lookups
 * system_admin   : platform operational user — NOT tied to any ICDV.
 *                  Performs workflow operations for any ICDV via chassis resolution.
 *                  Can filter manifests/vehicles across all ICDVs.
 *                  Cannot manage platform config (ICDVs, platform users).
 * super_admin    : full platform access — no tenant restriction (bypasses all checks)
 *
 * ── NEW OPERATIONAL ROLES (migration 008) ─────────────────────────────────────
 * discharge_officer  : Receives vehicles from vessel → discharges + batches only
 * backoffice_officer : Manages document/GC batch statuses, prints, updates ops
 * transfer_officer   : Transfers batched vehicles through TPA gate only
 * yard_officer       : Receives vehicles at yard only, can print delivery sheets
 *
 * ── NEW RIGHTS (migration 008) ────────────────────────────────────────────────
 * dischargeVehicles  : POST discharge/confirm + batch/confirm
 * transferVehicles   : POST transfer/confirm
 * receiveVehicles    : POST receive/confirm
 * printBatches       : GET /batches/:id/print  (chassis list print)
 * printDeliverySheet : GET delivery-sheet endpoints
 * updateBatchStatus  : PATCH /batches/:id/status  (document + gc status)
 * viewTpaStats       : GET /transfer/tpa-stats  (TPA gate exit counts)
 */

const allRoles = {
  // ── Existing roles — all original rights preserved + new rights added ────────
  operator: [
    'getVessels',
    'getManifests',
    'getVehicles',
    'getDrivers',       'manageDrivers',
    'getOperations',
    'updateOperations',
    'getDeliveries',
    'manageVehicles',
    // New rights — operator retains full workflow access
    'dischargeVehicles',
    'transferVehicles',
    'receiveVehicles',
    'printBatches',
    'printDeliverySheet',
    'updateBatchStatus',
    'viewTpaStats',
    'viewFuel',
  ],

  supervisor: [
    'getVessels',        'manageVessels',
    'getManifests',      'manageManifests',
    'getVehicles',       'manageVehicles',
    'getDrivers',        'manageDrivers',
    'getOperations',     'manageOperations',  'updateOperations',
    'getDeliveries',     'manageDeliveries',
    'getUsers',
    // New rights — supervisor retains full workflow access
    'dischargeVehicles',
    'transferVehicles',
    'receiveVehicles',
    'printBatches',
    'printDeliverySheet',
    'updateBatchStatus',
    'viewTpaStats',
    'viewFuel',
    'approveFuelOrders',
    'dispenseFuel',
    'createFuelOrders',
    'manageIncidents',
  ],

  admin: [
    'getUsers',           'manageUsers',
    'getVessels',         'manageVessels',
    'getManifests',       'manageManifests',
    'getVehicles',        'manageVehicles',
    'getDrivers',         'manageDrivers',
    'getOperations',      'manageOperations',  'updateOperations',
    'getDeliveries',      'manageDeliveries',
    'getLookups',         'manageLookups',
    'dischargeVehicles',
    'transferVehicles',
    'receiveVehicles',
    'printBatches',
    'printDeliverySheet',
    'updateBatchStatus',
    'viewTpaStats',
    'viewFuel',
    'approveFuelOrders',
    'dispenseFuel',
    'createFuelOrders',
    'manageIncidents',
    // Billing — ICDV admin can view invoices, approve, mark as paid,
    // and upload payment evidence (proof of payment) when marking paid
    'viewInvoices',
    'approveInvoice',
    'markInvoicePaid',
    'uploadPaymentEvidence',
  ],

  // system_admin: full workflow + cross-ICDV read — NO platform management
  system_admin: [
    'getVessels',
    'getManifests',       'manageManifests',
    'getVehicles',        'manageVehicles',
    'getDrivers',         'manageDrivers',
    'getOperations',      'manageOperations',  'updateOperations',
    'getDeliveries',
    'getLookups',
    'getIcdvs',           // read-only: needed to populate ICDV selector on cross-tenant forms
    // New rights — system_admin retains full workflow access
    'dischargeVehicles',
    'transferVehicles',
    'receiveVehicles',
    'printBatches',
    'printDeliverySheet',
    'updateBatchStatus',
    'viewTpaStats',
    'viewFuel',
    'approveFuelOrders',
    'dispenseFuel',
    'createFuelOrders',
  ],

  super_admin: [
    'getIcdvs',           'manageIcdvs',
    'getUsers',           'manageUsers',
    'getVessels',         'manageVessels',
    'getManifests',       'manageManifests',
    'getVehicles',        'manageVehicles',
    'getDrivers',         'manageDrivers',
    'getOperations',      'manageOperations',  'updateOperations',
    'getDeliveries',      'manageDeliveries',
    'getLookups',         'manageLookups',
    // New rights — super_admin also bypasses via isSuperAdmin() in auth middleware
    'dischargeVehicles',
    'transferVehicles',
    'receiveVehicles',
    'printBatches',
    'printDeliverySheet',
    'updateBatchStatus',
    'viewTpaStats',
    'viewFuel',
    'approveFuelOrders',
    'dispenseFuel',
    'createFuelOrders',
    // Invoicing — super_admin issues/edits/cancels invoices, and issues the
    // official payment RECEIPT back to the ICDV once paid. Approval is
    // intentionally NOT here — that belongs to the ICDV admin (see admin role).
    // Uploading payment EVIDENCE (proof of payment) belongs to the
    // cashier/admin side, not super_admin — see those roles below.
    'manageInvoices',        // create / edit / cancel
    'viewInvoices',
    'markInvoicePaid',
    'uploadPaymentReceipt',  // super_admin only — issue the official receipt
    // Expenses — super_admin only, simple create/edit/delete, no workflow
    'manageExpenses',
    // Insights — BI dashboards (Profit & Loss etc.), super_admin only since
    // it cross-references invoices + expenses across all ICDVs
    'viewInsights',
  ],

  // ── New operational roles ────────────────────────────────────────────────────

  discharge_officer: [
    'getVessels',
    'getManifests',
    'getVehicles',
    'getDrivers',
    'getDeliveries',
    'dischargeVehicles',
  ],

  backoffice_officer: [
    'getVessels',
    'getManifests',
    'getVehicles',
    'getDrivers',
    'getDeliveries',
    'getOperations',
    'manageVessels',
    'manageManifests',
    'updateOperations',
    'updateBatchStatus',
    'printBatches',
    'printDeliverySheet',
  ],

  transfer_officer: [
    'getVehicles',
    'getDrivers',
    'transferVehicles',
    'viewTpaStats',
  ],

  yard_officer: [
    'getVehicles',
    'getManifests',
    'getDrivers',
    'receiveVehicles',
    'printDeliverySheet',
  ],

  // ── Fuel officer (migration 011) ─────────────────────────────────────────────
  fuel_officer: [
    'getVehicles',
    'getManifests',
    'createFuelOrders',
    'dispenseFuel',
    'viewFuel',
  ],

  // ── Cashier (migration 016) ───────────────────────────────────────────────────
  // ICDV-scoped. Can view approved/paid invoices and mark as paid.
  // Cannot approve, create, or cancel invoices.
  cashier: [
    'viewInvoices',          // view billing list (approved + paid)
    'markInvoicePaid',       // mark approved invoices as paid
    'uploadPaymentEvidence', // upload proof of payment (bank slip etc.)
    // Read-only access to vehicles/manifests for reference
    'getManifests',
    'getVehicles',
  ],
};

const roles      = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

/** Returns true when the user is platform super admin — bypasses ALL right checks */
const isSuperAdmin = (user) => user && user.role === 'super_admin';

/**
 * Returns true for platform-level operational users (system_admin).
 * These users have no fixed icdv_id — they operate across all ICDVs
 * by automatic chassis-based tenant resolution.
 */
const isSystemAdmin = (user) => user && user.role === 'system_admin';

/**
 * Returns true for users who have no fixed ICDV and need cross-tenant access.
 * Used by tenant middleware to allow null icdvId for workflow routes.
 */
const isCrossTenantUser = (user) => isSuperAdmin(user) || isSystemAdmin(user);

/**
 * Returns true for users who should bypass the batch operational_status gate
 * in confirmTransfer. Admins can force-transfer regardless of batch readiness.
 */
const canBypassBatchGate = (user) =>
  user && ['admin', 'super_admin', 'system_admin'].includes(user.role);

module.exports = {
  roles,
  roleRights,
  isSuperAdmin,
  isSystemAdmin,
  isCrossTenantUser,
  canBypassBatchGate,
};
