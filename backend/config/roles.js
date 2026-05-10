/**
 * ICDV — Role & permissions
 * operator  : day-to-day port operations
 * supervisor: can approve operations, manage drivers, manage manifests
 * admin     : full access including user management and lookups
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
};

const roles = Object.keys(allRoles);
const roleRights = new Map(Object.entries(allRoles));

module.exports = { roles, roleRights };
