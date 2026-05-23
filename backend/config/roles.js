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
    // New rights — admin has full access to all new features
    'dischargeVehicles',
    'transferVehicles',
    'receiveVehicles',
    'printBatches',
    'printDeliverySheet',
    'updateBatchStatus',
    'viewTpaStats',
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
    // New rights — system_admin retains full workflow access
    'dischargeVehicles',
    'transferVehicles',
    'receiveVehicles',
    'printBatches',
    'printDeliverySheet',
    'updateBatchStatus',
    'viewTpaStats',
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
  ],

  // ── New operational roles ────────────────────────────────────────────────────

  discharge_officer: [
    // Read access
    'getVessels',
    'getManifests',
    'getVehicles',
    'getDrivers',
    'getDeliveries',
    // Workflow: discharge from vessel + assign to batch
    'dischargeVehicles',
    // Cannot: transfer, receive, print batches, print delivery sheets, update doc/gc
  ],

  backoffice_officer: [
    // Read access
    'getVessels',
    'getManifests',
    'getVehicles',
    'getDrivers',
    'getDeliveries',
    'getOperations',
    // Operational updates
    'updateOperations',
    // Batch document + GC status management
    'updateBatchStatus',
    // Print features
    'printBatches',
    'printDeliverySheet',
    // Cannot: discharge, transfer, receive vehicles
  ],

  transfer_officer: [
    // Read access (vehicles + drivers only — scoped view)
    'getVehicles',
    'getDrivers',
    // Workflow: transfer batched vehicles through TPA gate
    'transferVehicles',
    // Reporting: view TPA gate exit counts
    'viewTpaStats',
    // Cannot: discharge, batch, receive, print delivery sheets
  ],

  yard_officer: [
    // Read access
    'getVehicles',
    'getManifests',
    'getDrivers',
    // Workflow: receive vehicles at yard
    'receiveVehicles',
    // Print: delivery sheet for received vehicles
    'printDeliverySheet',
    // Cannot: discharge, batch, transfer, print batch chassis list, update doc/gc
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
