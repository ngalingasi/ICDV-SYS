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

// ── BATCH STATUS (lifecycle of the batch container) ───────────────────────────
const BATCH_STATUSES = {
  OPEN:        'open',        // accepting vehicles (< 20)
  FULL:        'full',        // reached 20 vehicles, no longer accepting
  CLOSED:      'closed',      // manually or system finalised
  TRANSFERRED: 'transferred', // all vehicles have been transferred
};
const BATCH_STATUS_LIST = Object.values(BATCH_STATUSES);

// ── BATCH DOCUMENT STATUS (migration 008) ─────────────────────────────────────
// Set by backoffice_officer to indicate import documents are ready
const BATCH_DOCUMENT_STATUSES = {
  NOT_READY: 'not_ready',
  READY:     'ready',
};
const BATCH_DOCUMENT_STATUS_LIST = Object.values(BATCH_DOCUMENT_STATUSES);

// ── BATCH GC STATUS (migration 008) ───────────────────────────────────────────
// Set by backoffice_officer to indicate batch has been sent to General Cargo
const BATCH_GC_STATUSES = {
  NOT_SENT: 'not_sent',
  SENT:     'sent',
};
const BATCH_GC_STATUS_LIST = Object.values(BATCH_GC_STATUSES);

// ── BATCH OPERATIONAL STATUS (migration 008) ──────────────────────────────────
// Auto-computed: ready = document_status READY + gc_status SENT
// Gating condition for confirmTransfer
const BATCH_OPERATIONAL_STATUSES = {
  NOT_READY: 'not_ready',
  READY:     'ready',
};
const BATCH_OPERATIONAL_STATUS_LIST = Object.values(BATCH_OPERATIONAL_STATUSES);

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
  // Batch lifecycle
  BATCH_STATUSES, BATCH_STATUS_LIST,
  // Batch operational readiness (migration 008)
  BATCH_DOCUMENT_STATUSES, BATCH_DOCUMENT_STATUS_LIST,
  BATCH_GC_STATUSES, BATCH_GC_STATUS_LIST,
  BATCH_OPERATIONAL_STATUSES, BATCH_OPERATIONAL_STATUS_LIST,
};
