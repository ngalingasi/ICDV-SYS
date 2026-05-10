/**
 * ICDV Vehicle Import & Delivery Management System
 * Status definitions — single source of truth for all entities
 */

const VESSEL_STATUSES = {
  EXPECTED:   'expected',
  ARRIVED:    'arrived',
  PROCESSING: 'processing',
  COMPLETED:  'completed',
  DEPARTED:   'departed',
};
const VESSEL_STATUS_LIST = Object.values(VESSEL_STATUSES);

const MANIFEST_STATUSES = {
  PENDING:   'pending',
  ACTIVE:    'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};
const MANIFEST_STATUS_LIST = Object.values(MANIFEST_STATUSES);

const RELEASE_STATUSES = {
  UNRELEASED: 'unreleased',
  RELEASED:   'released',
  COLLECTED:  'collected',
  ON_HOLD:    'on_hold',
};
const RELEASE_STATUS_LIST = Object.values(RELEASE_STATUSES);

const OPERATIONAL_STATUSES = {
  PENDING:      'pending',
  IN_OPERATION: 'in_operation',
  READY:        'ready',
  DELIVERED:    'delivered',
  CANCELLED:    'cancelled',
};
const OPERATIONAL_STATUS_LIST = Object.values(OPERATIONAL_STATUSES);

const OPERATION_STATUSES = {
  PENDING:     'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED:   'completed',
  CANCELLED:   'cancelled',
};
const OPERATION_STATUS_LIST = Object.values(OPERATION_STATUSES);

const DELIVERY_STATUSES = {
  SCHEDULED:  'scheduled',
  IN_TRANSIT: 'in_transit',
  DELIVERED:  'delivered',
  FAILED:     'failed',
  CANCELLED:  'cancelled',
};
const DELIVERY_STATUS_LIST = Object.values(DELIVERY_STATUSES);

const VESSEL_STATUS_TRANSITIONS = {
  expected:   ['arrived', 'departed'],
  arrived:    ['processing', 'departed'],
  processing: ['completed', 'arrived'],
  completed:  ['departed'],
  departed:   [],
};

const OPERATION_STATUS_TRANSITIONS = {
  pending:     ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed:   [],
  cancelled:   [],
};

const DELIVERY_STATUS_TRANSITIONS = {
  scheduled:  ['in_transit', 'cancelled'],
  in_transit: ['delivered', 'failed'],
  delivered:  [],
  failed:     ['scheduled'],
  cancelled:  [],
};

module.exports = {
  VESSEL_STATUSES, VESSEL_STATUS_LIST, VESSEL_STATUS_TRANSITIONS,
  MANIFEST_STATUSES, MANIFEST_STATUS_LIST,
  RELEASE_STATUSES, RELEASE_STATUS_LIST,
  OPERATIONAL_STATUSES, OPERATIONAL_STATUS_LIST,
  OPERATION_STATUSES, OPERATION_STATUS_LIST, OPERATION_STATUS_TRANSITIONS,
  DELIVERY_STATUSES, DELIVERY_STATUS_LIST, DELIVERY_STATUS_TRANSITIONS,
};
