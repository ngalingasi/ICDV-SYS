/**
 * ICDV — Role & permissions (multi-tenant)
 *
 * operator     : day-to-day port operations (read + update ops)
 * supervisor   : manage drivers, manifests, operations, deliveries
 * admin        : full ICDV access including user management and lookups
 * system_admin : platform operational user — NOT tied to any ICDV.
 *                Performs workflow operations for any ICDV via chassis resolution.
 *                Can filter manifests/vehicles across all ICDVs.
 *                Cannot manage platform config (ICDVs, platform users).
 * super_admin  : full platform access — no tenant restriction
 */
const allRoles = {
  operator: [
    'getVessels',
    'getManifests',
    'getVehicles',
    'getDrivers',    'manageDrivers',
    'getOperations',
    'updateOperations',
    'getDeliveries',
    'manageVehicles',
  ],
  supervisor: [
    'getVessels',    'manageVessels',
    'getManifests',  'manageManifests',
    'getVehicles',   'manageVehicles',
    'getDrivers',    'manageDrivers',
    'getOperations', 'manageOperations', 'updateOperations',
    'getDeliveries', 'manageDeliveries',
    'getUsers',
  ],
  admin: [
    'getUsers',        'manageUsers',
    'getVessels',      'manageVessels',
    'getManifests',    'manageManifests',
    'getVehicles',     'manageVehicles',
    'getDrivers',      'manageDrivers',
    'getOperations',   'manageOperations', 'updateOperations',
    'getDeliveries',   'manageDeliveries',
    'getLookups',      'manageLookups',
  ],
  // system_admin: full workflow + cross-ICDV read — NO platform management
  system_admin: [
    'getVessels',
    'getManifests',    'manageManifests',
    'getVehicles',     'manageVehicles',
    'getDrivers',      'manageDrivers',
    'getOperations',   'manageOperations', 'updateOperations',
    'getDeliveries',
    'getLookups',
  ],
  super_admin: [
    'getIcdvs',        'manageIcdvs',
    'getUsers',        'manageUsers',
    'getVessels',      'manageVessels',
    'getManifests',    'manageManifests',
    'getVehicles',     'manageVehicles',
    'getDrivers',      'manageDrivers',
    'getOperations',   'manageOperations', 'updateOperations',
    'getDeliveries',   'manageDeliveries',
    'getLookups',      'manageLookups',
  ],
};

const roles      = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

/** Returns true when the user is platform super admin */
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

module.exports = { roles, roleRights, isSuperAdmin, isSystemAdmin, isCrossTenantUser };
