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

// ── WORKFLOW STATUSES (5-step operational flow) ────────────────────────────────
const WORKFLOW_STATUSES = {
  MANIFESTED: 'manifested',
  DISCHARGED: 'discharged',
  BATCHED:    'batched',
  IN_TRANSIT: 'in_transit',
  RECEIVED:   'received',
};
const WORKFLOW_STATUS_LIST = Object.values(WORKFLOW_STATUSES);

const WORKFLOW_STATUS_TRANSITIONS = {
  manifested: ['discharged'],
  discharged: ['batched'],
  batched:    ['in_transit'],
  in_transit: ['received'],
  received:   [],
};

// ── VEHICLE LOCATIONS ─────────────────────────────────────────────────────────
const VEHICLE_LOCATIONS = {
  VESSEL:           'vessel',
  HOLDING_GROUND:   'holding_ground',
  TPA_GATE:         'tpa_gate',
  TPA_GATE_TO_YARD: 'tpa_gate_to_yard',
  ICDV_YARD:        'icdv_yard',
};
const VEHICLE_LOCATION_LIST = Object.values(VEHICLE_LOCATIONS);

// Map workflow status → physical location
const WORKFLOW_TO_LOCATION = {
  manifested: VEHICLE_LOCATIONS.VESSEL,
  discharged: VEHICLE_LOCATIONS.HOLDING_GROUND,
  batched:    VEHICLE_LOCATIONS.HOLDING_GROUND,
  in_transit: VEHICLE_LOCATIONS.TPA_GATE_TO_YARD,
  received:   VEHICLE_LOCATIONS.ICDV_YARD,
};

// ── Existing status transitions ────────────────────────────────────────────────
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
  // Workflow
  WORKFLOW_STATUSES, WORKFLOW_STATUS_LIST, WORKFLOW_STATUS_TRANSITIONS,
  VEHICLE_LOCATIONS, VEHICLE_LOCATION_LIST, WORKFLOW_TO_LOCATION,
};
