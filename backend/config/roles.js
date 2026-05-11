/**
 * ICDV — Role & permissions (multi-tenant)
 * operator    : day-to-day port operations (read + update ops)
 * supervisor  : manage drivers, manifests, operations, deliveries
 * admin       : full ICDV access including user management and lookups
 * super_admin : platform-wide, not tied to any tenant — has every right
 */
const allRoles = {
  operator: [
    'getVessels',
    'getManifests',
    'getVehicles',
    'getDrivers',
    'getOperations',
    'updateOperations',
    'getDeliveries',
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
  super_admin: [
    // Platform management
    'getIcdvs',        'manageIcdvs',
    // All tenant rights
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

module.exports = { roles, roleRights, isSuperAdmin };
