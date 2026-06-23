/**
 * workflow.model.js
 *
 * Every operation atomically updates:
 *   vehicles.workflow_status        — the 5-step state (single source of truth)
 *   vehicles.current_location       — physical location
 *   vehicles.operational_status     — kept in sync so old queries still work
 *   vehicles.release_status         — set to 'released' at transfer, 'collected' at receive
 *   manifests.*_count               — running totals per step
 *   manifests.status                — auto-advances: pending→active→completed
 *   vehicle_operations              — full audit log entry
 *
 * MIGRATION 008 ADDITIONS:
 *   updateBatchStatus()             — backoffice: set document_status + gc_status per batch
 *   getBatchPrintData()             — backoffice/yard: full chassis list for batch print
 *   getTpaStats()                   — transfer officer: count vehicles at TPA gate
 *   confirmTransfer()               — now gates on batch.operational_status = 'ready'
 *                                     (bypassable by admin / super_admin / system_admin)
 *
 * Uses query(), transaction(), connQuery() — existing database helpers.
 */
const httpStatus = require('http-status');
const { query, transaction, connQuery } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');
const {
  WORKFLOW_STATUSES,
  WORKFLOW_STATUS_TRANSITIONS,
  WORKFLOW_TO_LOCATION,
  BATCH_DOCUMENT_STATUSES,
  BATCH_GC_STATUSES,
  BATCH_OPERATIONAL_STATUSES,
} = require('../config/statuses');
const { canBypassBatchGate } = require('../config/roles');

// ─────────────────────────────────────────────────────────────────────────────
// STATUS MAPPING — single source of truth
// Maps each workflow step → { operational_status, release_status }
// ─────────────────────────────────────────────────────────────────────────────
const WORKFLOW_TO_OP_STATUS = {
  manifested: 'pending',
  discharged: 'pending',
  batched:    'pending',
  in_transit: 'in_operation',
  received:   'ready',
};

const WORKFLOW_TO_RELEASE = {
  manifested: 'unreleased',
  discharged: 'unreleased',
  batched:    'unreleased',
  in_transit: 'released',
  received:   'collected',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const findByChassisLast4 = async (last4, icdvId) => {
  const scopeClause = icdvId ? 'AND v.icdv_id = ?' : '';
  const params      = icdvId ? [`%${last4}`, icdvId] : [`%${last4}`];
  return query(
    `SELECT v.vehicle_id, v.icdv_id, v.chassis_number, v.brand, v.model,
            v.color, v.year, v.customer_name, v.destination,
            v.workflow_status, v.current_location, v.batch_id,
            v.release_status, v.operational_status,
            v.manifest_id,
            m.manifest_number, m.arrival_date AS manifest_arrival_date,
            vs.name AS vessel_name, vs.vessel_id, vs.imo_number,
            ic.name AS icdv_name, ic.code AS icdv_code
     FROM vehicles v
     LEFT JOIN manifests m ON m.manifest_id = v.manifest_id
     LEFT JOIN vessels vs  ON vs.vessel_id  = m.vessel_id
     LEFT JOIN icdvs ic    ON ic.icdv_id    = v.icdv_id
     WHERE v.chassis_number LIKE ? ${scopeClause}
     ORDER BY v.created_at DESC`,
    params
  );
};

/**
 * Returns a plain-language description of where a vehicle currently is
 * in the workflow, suitable for showing directly to an operator.
 */
const statusDescription = (status) => {
  switch (status) {
    case 'manifested':  return 'It is under a manifest and has not yet been discharged from the vessel';
    case 'discharged':  return 'It has been discharged and is in the port holding area, awaiting batching';
    case 'batched':     return 'It has been batched and is awaiting transfer to the ICDV yard';
    case 'in_transit':  return 'It is currently in transit to the ICDV yard';
    case 'received':    return 'It has been received at the ICDV yard';
    default:            return `Its current status is "${status}"`;
  }
};

const resolveVehicle = async (last4, icdvId) => {
  const matches = await findByChassisLast4(last4, icdvId);
  if (!matches.length)
    throw new ApiError(httpStatus.NOT_FOUND, `No vehicle found with chassis ending in '${last4}'`);
  if (matches.length > 1)
    throw new ApiError(httpStatus.CONFLICT, `Multiple vehicles match '${last4}'. Enter more chassis digits.`);
  return matches[0];
};

const assertTransition = (currentStatus, nextStatus) => {
  const allowed = WORKFLOW_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus))
    throw new ApiError(
      httpStatus.CONFLICT,
      `Cannot perform this action. ${statusDescription(currentStatus)}. ` +
      `Allowed next steps: ${allowed.length ? allowed.map(s => s.replace(/_/g, ' ')).join(', ') : 'none'}.`
    );
};

/** Write audit log row inside or outside transaction */
const logOperation = (connOrNull, data) => {
  const sql = `
    INSERT INTO vehicle_operations
      (icdv_id, vehicle_id, chassis_number, operation_type,
       from_status, to_status, from_location, to_location,
       batch_id, transfer_id, notes, performed_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;
  const p = [
    data.icdvId, data.vehicleId, data.chassisNumber, data.operationType,
    data.fromStatus ?? null, data.toStatus ?? null,
    data.fromLocation ?? null, data.toLocation ?? null,
    data.batchId ?? null, data.transferId ?? null,
    data.notes ?? null, data.performedBy,
  ];
  return connOrNull ? connQuery(connOrNull, sql, p) : query(sql, p);
};

/**
 * Central vehicle status update — called inside every operation transaction.
 * Updates workflow_status, current_location, operational_status, release_status atomically.
 */
const applyVehicleStatus = (conn, vehicleId, newWorkflowStatus, operatorId) =>
  connQuery(conn,
    `UPDATE vehicles
     SET workflow_status    = ?,
         current_location   = ?,
         operational_status = ?,
         release_status     = ?,
         updated_by         = ?,
         updated_at         = NOW()
     WHERE vehicle_id = ?`,
    [
      newWorkflowStatus,
      WORKFLOW_TO_LOCATION[newWorkflowStatus],
      WORKFLOW_TO_OP_STATUS[newWorkflowStatus],
      WORKFLOW_TO_RELEASE[newWorkflowStatus],
      operatorId,
      vehicleId,
    ]
  );

/**
 * Sync manifest summary counts + auto-advance manifest status.
 * Called inside every operation transaction after vehicle update.
 */
const syncManifestStatus = async (conn, manifestId) => {
  await connQuery(conn,
    `UPDATE manifests m
     SET
       manifested_count = (SELECT COUNT(*) FROM vehicles v WHERE v.manifest_id=? AND v.workflow_status='manifested'),
       discharged_count = (SELECT COUNT(*) FROM vehicles v WHERE v.manifest_id=? AND v.workflow_status='discharged'),
       batched_count    = (SELECT COUNT(*) FROM vehicles v WHERE v.manifest_id=? AND v.workflow_status='batched'),
       in_transit_count = (SELECT COUNT(*) FROM vehicles v WHERE v.manifest_id=? AND v.workflow_status='in_transit'),
       received_count   = (SELECT COUNT(*) FROM vehicles v WHERE v.manifest_id=? AND v.workflow_status='received'),
       updated_at       = NOW()
     WHERE m.manifest_id = ?`,
    [manifestId, manifestId, manifestId, manifestId, manifestId, manifestId]
  );

  await connQuery(conn,
    `UPDATE manifests m
     JOIN (
       SELECT manifest_id,
              COUNT(*) AS total,
              SUM(workflow_status != 'manifested') AS started,
              SUM(workflow_status  = 'received')   AS received_count
       FROM vehicles
       WHERE manifest_id = ?
       GROUP BY manifest_id
     ) s ON s.manifest_id = m.manifest_id
     SET m.status = CASE
       WHEN s.total > 0 AND s.received_count = s.total THEN 'completed'
       WHEN s.started > 0                               THEN 'active'
       ELSE m.status
     END
     WHERE m.manifest_id = ? AND m.status NOT IN ('cancelled')`,
    [manifestId, manifestId]
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. DISCHARGE
// ─────────────────────────────────────────────────────────────────────────────

const lookupForDischarge = async (last4, icdvId) => {
  const vehicle = await resolveVehicle(last4, icdvId);
  if (vehicle.workflow_status !== WORKFLOW_STATUSES.MANIFESTED)
    throw new ApiError(httpStatus.CONFLICT,
      vehicle.workflow_status === 'received'
        ? `Vehicle ${vehicle.chassis_number} has been received at the ICDV yard.`
        : `Vehicle ${vehicle.chassis_number} cannot be discharged. ${statusDescription(vehicle.workflow_status)}.`);
  return vehicle;
};

const discharge = async (vehicleId, notes, operatorId, icdvId) =>
  transaction(async (conn) => {
    const [vehicle] = await connQuery(conn,
      `SELECT v.vehicle_id, v.icdv_id, v.chassis_number, v.workflow_status,
              v.current_location, v.manifest_id
       FROM vehicles v WHERE v.vehicle_id=? FOR UPDATE`,
      [vehicleId]
    );
    if (!vehicle) throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');
    if (icdvId !== null && vehicle.icdv_id !== icdvId)
      throw new ApiError(httpStatus.FORBIDDEN, 'Vehicle does not belong to your ICDV');

    assertTransition(vehicle.workflow_status, WORKFLOW_STATUSES.DISCHARGED);

    await applyVehicleStatus(conn, vehicleId, WORKFLOW_STATUSES.DISCHARGED, operatorId);
    await syncManifestStatus(conn, vehicle.manifest_id);
    await logOperation(conn, {
      icdvId, vehicleId, chassisNumber: vehicle.chassis_number,
      operationType: 'discharged',
      fromStatus: vehicle.workflow_status, toStatus: WORKFLOW_STATUSES.DISCHARGED,
      fromLocation: vehicle.current_location, toLocation: WORKFLOW_TO_LOCATION.discharged,
      notes, performedBy: operatorId,
    });

    const [updated] = await connQuery(conn,
      `SELECT v.*, m.manifest_number, vs.name AS vessel_name
       FROM vehicles v
       LEFT JOIN manifests m ON m.manifest_id = v.manifest_id
       LEFT JOIN vessels vs ON vs.vessel_id = m.vessel_id
       WHERE v.vehicle_id=?`,
      [vehicleId]
    );
    return updated;
  });

// ─────────────────────────────────────────────────────────────────────────────
// 2. BATCH
// ─────────────────────────────────────────────────────────────────────────────

// Fallback only — actual capacity now comes from icdvs.batch_capacity
// (super_admin configurable per ICDV, see migration 019). This is used
// only if that lookup somehow returns null/0.
const BATCH_MAX_FALLBACK = 20;

/**
 * generateBatchNumber(vesselId, icdvId, conn)
 * Produces sequential batch numbers per vessel — date-independent.
 * Format: <VESSEL_CODE>-BATCH-<NN>
 */
const generateBatchNumber = async (vesselId, icdvId, conn = null) => {
  const exec = conn ? connQuery.bind(null, conn) : query;

  const [vessel] = await exec(
    'SELECT name, imo_number FROM vessels WHERE vessel_id=?',
    [vesselId]
  );
  const code = (vessel?.imo_number || vessel?.name || 'VES')
    .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

  const prefix = `${code}-BATCH-`;
  const [row] = await exec(
    `SELECT MAX(CAST(SUBSTRING_INDEX(batch_number, '-', -1) AS UNSIGNED)) AS last
     FROM batches
     WHERE icdv_id=? AND vessel_id=? AND batch_number LIKE ?`,
    [icdvId, vesselId, `${prefix}%`]
  );
  const last = row?.last || 0;
  return `${prefix}${String(last + 1).padStart(2, '0')}`;
};

const lookupForBatch = async (last4, icdvId) => {
  const vehicle = await resolveVehicle(last4, icdvId);
  const allowed = [WORKFLOW_STATUSES.MANIFESTED, WORKFLOW_STATUSES.DISCHARGED];
  if (!allowed.includes(vehicle.workflow_status))
    throw new ApiError(httpStatus.CONFLICT,
      vehicle.workflow_status === 'received'
        ? `Vehicle ${vehicle.chassis_number} has been received at the ICDV yard.`
        : `Vehicle ${vehicle.chassis_number} cannot be batched. ${statusDescription(vehicle.workflow_status)}.`);
  if (vehicle.batch_id)
    throw new ApiError(httpStatus.CONFLICT, `Vehicle ${vehicle.chassis_number} is already in a batch.`);
  return vehicle;
};

const addToBatch = async (vehicleId, notes, operatorId, icdvId) =>
  transaction(async (conn) => {
    const [vehicle] = await connQuery(conn,
      `SELECT v.vehicle_id, v.icdv_id, v.chassis_number, v.workflow_status,
              v.batch_id, v.manifest_id, m.vessel_id
       FROM vehicles v
       LEFT JOIN manifests m ON m.manifest_id = v.manifest_id
       WHERE v.vehicle_id=? FOR UPDATE`,
      [vehicleId]
    );
    if (!vehicle) throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');
    if (icdvId !== null && vehicle.icdv_id !== icdvId)
      throw new ApiError(httpStatus.FORBIDDEN, 'Vehicle does not belong to your ICDV');
    if (vehicle.batch_id)
      throw new ApiError(httpStatus.CONFLICT, 'Vehicle is already in a batch');

    const vesselId = vehicle.vessel_id;

    // Batch capacity is per-ICDV (set by super_admin on the ICDV profile,
    // default 20). Always resolve from the vehicle's actual ICDV — icdvId
    // here can be null for cross-tenant (super_admin) calls.
    const [icdvRow] = await connQuery(conn,
      `SELECT batch_capacity FROM icdvs WHERE icdv_id=?`,
      [vehicle.icdv_id]
    );
    const batchMax = icdvRow?.batch_capacity || BATCH_MAX_FALLBACK;

    const [openBatch] = await connQuery(conn,
      `SELECT batch_id, vehicle_count, batch_number FROM batches
       WHERE icdv_id=? AND vessel_id=? AND status='open'
       ORDER BY batch_id ASC LIMIT 1 FOR UPDATE`,
      [icdvId, vesselId]
    );

    let batchId, batchNumber;
    if (openBatch) {
      batchId     = openBatch.batch_id;
      batchNumber = openBatch.batch_number;
      const newCount = openBatch.vehicle_count + 1;

      if (newCount >= batchMax) {
        await connQuery(conn,
          `UPDATE batches SET vehicle_count=?, status='full', updated_at=NOW() WHERE batch_id=?`,
          [newCount, batchId]
        );
      } else {
        await connQuery(conn,
          `UPDATE batches SET vehicle_count=vehicle_count+1, updated_at=NOW() WHERE batch_id=?`,
          [batchId]
        );
      }
    } else {
      const today = new Date().toISOString().slice(0, 10);
      batchNumber = await generateBatchNumber(vesselId, icdvId, conn);
      const r = await connQuery(conn,
        `INSERT INTO batches
           (icdv_id, batch_number, vessel_id, manifest_id, batch_date, vehicle_count, status, created_by)
         VALUES (?,?,?,?,?,1,'open',?)`,
        [icdvId, batchNumber, vesselId, vehicle.manifest_id, today, operatorId]
      );
      batchId = r.insertId;
    }

    await connQuery(conn,
      `UPDATE vehicles
       SET workflow_status    = ?,
           current_location   = ?,
           operational_status = ?,
           release_status     = ?,
           batch_id           = ?,
           updated_by         = ?,
           updated_at         = NOW()
       WHERE vehicle_id = ?`,
      [
        WORKFLOW_STATUSES.BATCHED,
        WORKFLOW_TO_LOCATION.batched,
        WORKFLOW_TO_OP_STATUS.batched,
        WORKFLOW_TO_RELEASE.batched,
        batchId,
        operatorId,
        vehicleId,
      ]
    );

    await syncManifestStatus(conn, vehicle.manifest_id);
    await logOperation(conn, {
      icdvId, vehicleId, chassisNumber: vehicle.chassis_number,
      operationType: 'batched',
      fromStatus: vehicle.workflow_status, toStatus: WORKFLOW_STATUSES.BATCHED,
      fromLocation: vehicle.current_location, toLocation: WORKFLOW_TO_LOCATION.batched,
      batchId, notes, performedBy: operatorId,
    });

    return { vehicle_id: vehicleId, batch_id: batchId, batch_number: batchNumber };
  });

const getBatch = async (batchId, icdvId) => {
  const batchWhere = icdvId ? 'WHERE b.batch_id=? AND b.icdv_id=?' : 'WHERE b.batch_id=?';
  const batchPrms  = icdvId ? [batchId, icdvId] : [batchId];
  const [batch] = await query(
    `SELECT b.*, vs.name AS vessel_name, vs.imo_number,
            ic.name AS icdv_name, ic.code AS icdv_code,
            u.full_name AS document_updated_by_name,
            u2.full_name AS gc_updated_by_name
     FROM batches b
     LEFT JOIN vessels vs ON vs.vessel_id = b.vessel_id
     LEFT JOIN icdvs ic   ON ic.icdv_id   = b.icdv_id
     LEFT JOIN users u    ON u.user_id    = b.document_updated_by
     LEFT JOIN users u2   ON u2.user_id   = b.gc_updated_by
     ${batchWhere}`,
    batchPrms
  );
  if (!batch) throw new ApiError(httpStatus.NOT_FOUND, 'Batch not found');
  const vehWhere = icdvId ? 'WHERE v.batch_id=? AND v.icdv_id=?' : 'WHERE v.batch_id=?';
  const vehPrms  = icdvId ? [batchId, icdvId] : [batchId];
  batch.vehicles = await query(
    `SELECT v.vehicle_id, v.chassis_number, v.brand, v.model, v.color,
            v.workflow_status, v.current_location, v.release_status,
            v.operational_status, v.customer_name
     FROM vehicles v ${vehWhere}`,
    vehPrms
  );
  return batch;
};

const getBatches = async ({ page, limit, vessel_id, manifest_id, status, document_status, gc_status, operational_status, search } = {}, icdvId = null) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  let where = '1=1'; const params = [];
  if (icdvId !== null)        { where += ' AND b.icdv_id=?';             params.push(icdvId); }
  if (vessel_id)              { where += ' AND b.vessel_id=?';           params.push(vessel_id); }
  if (manifest_id)            { where += ' AND b.manifest_id=?';         params.push(manifest_id); }
  if (status)                 { where += ' AND b.status=?';              params.push(status); }
  if (document_status)        { where += ' AND b.document_status=?';     params.push(document_status); }
  if (gc_status)              { where += ' AND b.gc_status=?';           params.push(gc_status); }
  if (operational_status)     { where += ' AND b.operational_status=?';  params.push(operational_status); }
  if (search)                 { where += ' AND b.batch_number LIKE ?';   params.push(`%${search}%`); }

  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM batches b WHERE ${where}`, params);
  const rows = await query(
    `SELECT b.*, vs.name AS vessel_name, u.full_name AS created_by_name
     FROM batches b
     LEFT JOIN vessels vs ON vs.vessel_id = b.vessel_id
     LEFT JOIN users u ON u.user_id = b.created_by
     WHERE ${where} ORDER BY b.created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );
  return paginate(rows, total);
};

// ─────────────────────────────────────────────────────────────────────────────
// 2b. BATCH STATUS UPDATE (migration 008)
// Called by backoffice_officer to set document_status and/or gc_status.
// operational_status is auto-computed: ready only when both doc=ready & gc=sent.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * updateBatchStatus(batchId, body, updatedById, icdvId)
 *
 * body can contain any combination of:
 *   { document_status, document_remark, gc_status, gc_remark }
 *
 * operational_status is always recomputed after any change.
 * Returns the updated batch.
 */
const updateBatchStatus = async (batchId, body, updatedById, icdvId) => {
  const batchWhere = icdvId ? 'WHERE batch_id=? AND icdv_id=?' : 'WHERE batch_id=?';
  const batchPrms  = icdvId ? [batchId, icdvId] : [batchId];

  const [existing] = await query(
    `SELECT batch_id, document_status, gc_status, operational_status FROM batches ${batchWhere}`,
    batchPrms
  );
  if (!existing) throw new ApiError(httpStatus.NOT_FOUND, 'Batch not found');

  const {
    document_status = existing.document_status,
    document_remark,
    gc_status       = existing.gc_status,
    gc_remark,
  } = body;

  // Validate values against allowed enums
  if (!Object.values(BATCH_DOCUMENT_STATUSES).includes(document_status))
    throw new ApiError(httpStatus.BAD_REQUEST,
      `Invalid document_status. Allowed: ${Object.values(BATCH_DOCUMENT_STATUSES).join(', ')}`);

  if (!Object.values(BATCH_GC_STATUSES).includes(gc_status))
    throw new ApiError(httpStatus.BAD_REQUEST,
      `Invalid gc_status. Allowed: ${Object.values(BATCH_GC_STATUSES).join(', ')}`);

  // ── Business rule: GC cannot be marked SENT while documents are NOT READY ───
  // This is enforced on the backend (not just the frontend) to prevent API abuse.
  if (gc_status === BATCH_GC_STATUSES.SENT && document_status !== BATCH_DOCUMENT_STATUSES.READY) {
    throw new ApiError(
      httpStatus.UNPROCESSABLE_ENTITY,
      'Document status must be "Ready" before GC can be marked as "Sent".'
    );
  }

  // Auto-compute operational_status
  const newOperationalStatus =
    document_status === BATCH_DOCUMENT_STATUSES.READY &&
    gc_status === BATCH_GC_STATUSES.SENT
      ? BATCH_OPERATIONAL_STATUSES.READY
      : BATCH_OPERATIONAL_STATUSES.NOT_READY;

  // Track which fields are actually being changed — only write audit columns
  // for the field that was explicitly included in the request body.
  const docChanged = body.document_status !== undefined;
  const gcChanged  = body.gc_status  !== undefined;

  const fields  = [];
  const params  = [];

  // Document status — only stamp audit columns when this field is in the request
  fields.push('document_status=?');
  params.push(document_status);
  if (docChanged) {
    fields.push('document_updated_by=?', 'document_updated_at=NOW()');
    params.push(updatedById);
  }

  if (document_remark !== undefined) {
    fields.push('document_remark=?');
    params.push(document_remark ?? null);
  }

  // GC status — only stamp audit columns when this field is in the request
  fields.push('gc_status=?');
  params.push(gc_status);
  if (gcChanged) {
    fields.push('gc_updated_by=?', 'gc_updated_at=NOW()');
    params.push(updatedById);
  }

  if (gc_remark !== undefined) {
    fields.push('gc_remark=?');
    params.push(gc_remark ?? null);
  }

  fields.push('operational_status=?', 'updated_at=NOW()');
  params.push(newOperationalStatus);

  // WHERE clause params
  params.push(batchId);
  if (icdvId !== null) params.push(icdvId);

  await query(
    `UPDATE batches SET ${fields.join(',')} ${batchWhere}`,
    params
  );

  return getBatch(batchId, icdvId);
};

// ─────────────────────────────────────────────────────────────────────────────
// 2c. BATCH PRINT DATA (migration 008)
// Returns batch header + full vehicle/chassis list for printable view.
// This is DIFFERENT from delivery sheet (which shows driver assignments).
// Batch print shows all vehicles in the batch with their details.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getBatchPrintData(batchId, icdvId)
 *
 * Returns:
 * {
 *   batch:    { batch_id, batch_number, batch_date, status, vehicle_count,
 *               document_status, document_remark, gc_status, gc_remark,
 *               operational_status, vessel_name, icdv_name, icdv_code }
 *   vehicles: [ { vehicle_id, chassis_number, brand, model, color, year,
 *                 customer_name, destination, workflow_status,
 *                 current_location, release_status, bill_of_lading_no } ]
 *   printed_at: ISO timestamp
 * }
 */
const getBatchPrintData = async (batchId, icdvId) => {
  const batchWhere = icdvId ? 'WHERE b.batch_id=? AND b.icdv_id=?' : 'WHERE b.batch_id=?';
  const batchPrms  = icdvId ? [batchId, icdvId] : [batchId];

  const [batch] = await query(
    `SELECT
       b.batch_id,
       b.batch_number,
       b.batch_date,
       b.status,
       b.vehicle_count,
       b.max_vehicles,
       b.document_status,
       b.document_remark,
       b.gc_status,
       b.gc_remark,
       b.operational_status,
       b.notes,
       b.created_at,
       b.updated_at,
       vs.name        AS vessel_name,
       vs.imo_number  AS vessel_imo,
       ic.name        AS icdv_name,
       ic.code        AS icdv_code,
       u.full_name    AS created_by_name,
       u2.full_name   AS document_updated_by_name,
       b.document_updated_at,
       u3.full_name   AS gc_updated_by_name,
       b.gc_updated_at
     FROM batches b
     LEFT JOIN vessels vs ON vs.vessel_id = b.vessel_id
     LEFT JOIN icdvs   ic ON ic.icdv_id   = b.icdv_id
     LEFT JOIN users   u  ON u.user_id    = b.created_by
     LEFT JOIN users   u2 ON u2.user_id   = b.document_updated_by
     LEFT JOIN users   u3 ON u3.user_id   = b.gc_updated_by
     ${batchWhere}`,
    batchPrms
  );
  if (!batch) throw new ApiError(httpStatus.NOT_FOUND, 'Batch not found');

  const vehWhere = icdvId ? 'WHERE v.batch_id=? AND v.icdv_id=?' : 'WHERE v.batch_id=?';
  const vehPrms  = icdvId ? [batchId, icdvId] : [batchId];

  const vehicles = await query(
    `SELECT
       v.vehicle_id,
       v.chassis_number,
       v.engine_number,
       v.brand,
       v.model,
       v.color,
       v.year,
       v.customer_name,
       v.destination,
       v.delivery_location,
       v.bill_of_lading_no,
       v.workflow_status,
       v.current_location,
       v.release_status,
       v.operational_status
     FROM vehicles v
     ${vehWhere}
     ORDER BY v.chassis_number ASC`,
    vehPrms
  );

  return {
    batch,
    vehicles,
    vehicle_count: vehicles.length,
    printed_at: new Date().toISOString(),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. TRANSFER
// ─────────────────────────────────────────────────────────────────────────────

const lookupForTransfer = async (last4, icdvId) => {
  const vehicle = await resolveVehicle(last4, icdvId);
  if (vehicle.workflow_status !== WORKFLOW_STATUSES.BATCHED)
    throw new ApiError(httpStatus.CONFLICT,
      vehicle.workflow_status === 'received'
        ? `Vehicle ${vehicle.chassis_number} has been received at the ICDV yard.`
        : `Vehicle ${vehicle.chassis_number} cannot be transferred. ${statusDescription(vehicle.workflow_status)}.`);
  return vehicle;
};

const lookupDriverByIdCard = async (idCard, icdvId) => {
  // Driver lookup is GLOBAL — a driver can work for any ICDV transfer
  // as long as they are active and have no pending active assignment.
  // icdvId is kept as a parameter for API compatibility but is no longer
  // used to scope the driver query.
  const [driver] = await query('SELECT * FROM drivers WHERE id_number=?', [idCard]);
  if (!driver)
    throw new ApiError(httpStatus.NOT_FOUND, `No driver found with ID card '${idCard}'`);
  if (driver.status !== 'active')
    throw new ApiError(httpStatus.CONFLICT,
      `Driver ${driver.full_name} cannot perform transfers — their status is "${driver.status}". Only active drivers can be assigned to transfers.`);

  // Check globally — driver must not have ANY active assignment regardless of ICDV
  const [activeAssign] = await query(
    `SELECT da.assignment_id, v.chassis_number
     FROM driver_assignments da
     JOIN vehicles v ON v.vehicle_id = da.vehicle_id
     WHERE da.driver_id=? AND da.status='active'`,
    [driver.driver_id]
  );
  if (activeAssign)
    throw new ApiError(httpStatus.CONFLICT,
      `Driver ${driver.full_name} is already assigned to vehicle ${activeAssign.chassis_number}. Complete that transfer first.`);
  return driver;
};

/**
 * confirmTransfer — now checks batch.operational_status = 'ready' before
 * allowing a transfer, unless the operator has admin/super_admin/system_admin role.
 *
 * @param {number} vehicleId
 * @param {number} driverId
 * @param {string} driverIdCard
 * @param {string|null} notes
 * @param {number} operatorId
 * @param {number|null} icdvId
 * @param {object} operatorUser — req.user, used to check canBypassBatchGate
 */
const confirmTransfer = async (vehicleId, driverId, driverIdCard, notes, operatorId, icdvId, operatorUser = null) =>
  transaction(async (conn) => {
    const [vehicle] = await connQuery(conn,
      `SELECT v.vehicle_id, v.icdv_id, v.chassis_number, v.workflow_status,
              v.batch_id, v.current_location, v.manifest_id
       FROM vehicles v WHERE v.vehicle_id=? FOR UPDATE`,
      [vehicleId]
    );
    if (!vehicle) throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');
    if (icdvId !== null && vehicle.icdv_id !== icdvId)
      throw new ApiError(httpStatus.FORBIDDEN, 'Vehicle does not belong to your ICDV');
    assertTransition(vehicle.workflow_status, WORKFLOW_STATUSES.IN_TRANSIT);

    // ── Batch operational readiness gate (migration 008) ──────────────────────
    // Admin / super_admin / system_admin bypass this check.
    // All other roles (including transfer_officer) must have batch ready.
    if (vehicle.batch_id && !canBypassBatchGate(operatorUser)) {
      const [batch] = await connQuery(conn,
        'SELECT batch_id, batch_number, operational_status FROM batches WHERE batch_id=? FOR UPDATE',
        [vehicle.batch_id]
      );
      if (batch && batch.operational_status !== BATCH_OPERATIONAL_STATUSES.READY) {
        throw new ApiError(
          httpStatus.CONFLICT,
          `Batch ${batch.batch_number} is not operationally ready. ` +
          `Document status and GC status must both be marked READY/SENT by the Backoffice Officer before transfer can proceed.`
        );
      }
    }

    // Lock driver globally — driver must not be active in any ICDV transfer.
    // icdv_id for the assignment record comes from the vehicle (vehicle.icdv_id),
    // not from the driver's home ICDV.
    const effectiveIcdvForDriver = icdvId ?? vehicle.icdv_id;
    if (driverId !== null) {
      const [active] = await connQuery(conn,
        "SELECT assignment_id FROM driver_assignments WHERE driver_id=? AND status='active' FOR UPDATE",
        [driverId]
      );
      if (active) throw new ApiError(httpStatus.CONFLICT, 'Driver already has an active assignment');
    }

    // Create transfer record
    const tr = await connQuery(conn,
      `INSERT INTO transfers
         (icdv_id, vehicle_id, batch_id, driver_id, driver_id_card, transferred_by, transfer_notes, status)
       VALUES (?,?,?,?,?,?,?,'active')`,
      [effectiveIcdvForDriver, vehicleId, vehicle.batch_id, driverId, driverIdCard, operatorId, notes]
    );
    const transferId = tr.insertId;

    // Driver assignment — only created when a driver is assigned
    if (driverId !== null) {
      await connQuery(conn,
        `INSERT INTO driver_assignments (icdv_id, driver_id, vehicle_id, transfer_id, assigned_by, status)
         VALUES (?,?,?,?,?,'active')`,
        [effectiveIcdvForDriver, driverId, vehicleId, transferId, operatorId]
      );
    }

    await applyVehicleStatus(conn, vehicleId, WORKFLOW_STATUSES.IN_TRANSIT, operatorId);
    await syncManifestStatus(conn, vehicle.manifest_id);
    await logOperation(conn, {
      icdvId: effectiveIcdvForDriver, vehicleId, chassisNumber: vehicle.chassis_number,
      operationType: 'transferred',
      fromStatus: vehicle.workflow_status, toStatus: WORKFLOW_STATUSES.IN_TRANSIT,
      fromLocation: vehicle.current_location, toLocation: WORKFLOW_TO_LOCATION.in_transit,
      batchId: vehicle.batch_id, transferId,
      notes, performedBy: operatorId,
    });

    return { transfer_id: transferId, vehicle_id: vehicleId, driver_id: driverId };
  });

// ─────────────────────────────────────────────────────────────────────────────
// 3b. TPA STATS (migration 008)
// Transfer officer view: count of vehicles currently at TPA gate / in_transit
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getTpaStats(icdvId)
 *
 * Returns counts for vehicles that have exited through TPA gate:
 * - in_transit_count  : vehicles currently moving (in_transit / tpa_gate_to_yard)
 * - transferred_today : vehicles transferred today
 * - transferred_total : all vehicles ever transferred (workflow_status reached in_transit)
 * - active_drivers    : drivers currently assigned (in transit)
 * - by_batch          : breakdown per batch
 */
const getTpaStats = async (icdvId = null) => {
  const scopeW = icdvId ? ' AND icdv_id=?' : '';
  const scopeP = icdvId ? [icdvId] : [];

  const [
    [{ in_transit_count }],
    [{ transferred_today }],
    [{ transferred_total }],
    [{ active_drivers }],
    byBatch,
  ] = await Promise.all([
    // Currently in transit
    query(
      `SELECT COUNT(*) AS in_transit_count FROM vehicles WHERE workflow_status='in_transit'${scopeW}`,
      scopeP
    ),
    // Transferred today
    query(
      `SELECT COUNT(*) AS transferred_today FROM transfers
       WHERE DATE(transferred_at) = CURDATE() AND status != 'cancelled'${scopeW}`,
      scopeP
    ),
    // All-time transfers (vehicles that reached in_transit or beyond)
    query(
      `SELECT COUNT(*) AS transferred_total FROM vehicles
       WHERE workflow_status IN ('in_transit','received')${scopeW}`,
      scopeP
    ),
    // Drivers currently active
    query(
      `SELECT COUNT(*) AS active_drivers FROM driver_assignments WHERE status='active'${icdvId ? ' AND icdv_id=?' : ''}`,
      icdvId ? [icdvId] : []
    ),
    // Per-batch breakdown — batches that have at least 1 in_transit vehicle
    query(
      `SELECT
         b.batch_id,
         b.batch_number,
         b.vehicle_count,
         COUNT(v.vehicle_id)                                     AS in_transit_count,
         SUM(v.workflow_status = 'received')                     AS received_count,
         vs.name AS vessel_name
       FROM batches b
       LEFT JOIN vehicles v ON v.batch_id = b.batch_id
       LEFT JOIN vessels vs ON vs.vessel_id = b.vessel_id
       WHERE b.status IN ('open','full','closed','transferred')
         ${icdvId ? 'AND b.icdv_id=?' : ''}
       GROUP BY b.batch_id, b.batch_number, b.vehicle_count, vs.name
       HAVING in_transit_count > 0
       ORDER BY b.batch_id DESC`,
      icdvId ? [icdvId] : []
    ),
  ]);

  return {
    in_transit_count,
    transferred_today,
    transferred_total,
    active_drivers,
    by_batch: byBatch,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. RECEIVE
// ─────────────────────────────────────────────────────────────────────────────

const lookupForReceive = async (idCard, icdvId) => {
  // Driver lookup is global — any driver regardless of their home ICDV
  const [driver] = await query('SELECT * FROM drivers WHERE id_number=?', [idCard]);
  if (!driver)
    throw new ApiError(httpStatus.NOT_FOUND, `No driver found with ID card '${idCard}'`);

  // Assignment lookup is global — the assignment's icdv_id is the VEHICLE's ICDV
  // (not the driver's home ICDV), so we must not filter by driver.icdv_id
  const [assignment] = await query(
    `SELECT da.*,
       v.vehicle_id, v.chassis_number, v.brand, v.model, v.color, v.year,
       v.customer_name, v.workflow_status, v.current_location, v.batch_id,
       v.release_status, v.operational_status,
       m.manifest_number, m.manifest_id,
       vs.name AS vessel_name,
       t.transfer_id, t.transferred_at, t.transfer_notes
     FROM driver_assignments da
     JOIN vehicles v ON v.vehicle_id = da.vehicle_id
     LEFT JOIN manifests m ON m.manifest_id = v.manifest_id
     LEFT JOIN vessels vs ON vs.vessel_id = m.vessel_id
     LEFT JOIN transfers t ON t.transfer_id = da.transfer_id
     WHERE da.driver_id=? AND da.status='active'`,
    [driver.driver_id]
  );
  if (!assignment)
    throw new ApiError(httpStatus.NOT_FOUND, `Driver ${driver.full_name} has no active vehicle assignment`);
  if (assignment.workflow_status !== WORKFLOW_STATUSES.IN_TRANSIT)
    throw new ApiError(httpStatus.CONFLICT,
      `Vehicle ${assignment.chassis_number} cannot be received. ${statusDescription(assignment.workflow_status)}.`);

  return { driver, assignment };
};

const confirmReceive = async (driverId, vehicleId, notes, operatorId, icdvId) =>
  transaction(async (conn) => {
    const [vehicle] = await connQuery(conn,
      `SELECT v.vehicle_id, v.icdv_id, v.chassis_number, v.workflow_status,
              v.batch_id, v.current_location, v.manifest_id
       FROM vehicles v WHERE v.vehicle_id=? FOR UPDATE`,
      [vehicleId]
    );
    if (!vehicle) throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');
    if (icdvId !== null && vehicle.icdv_id !== icdvId)
      throw new ApiError(httpStatus.FORBIDDEN, 'Vehicle does not belong to your ICDV');
    assertTransition(vehicle.workflow_status, WORKFLOW_STATUSES.RECEIVED);

    // Resolve the effective icdv_id for all queries below
    const effectiveIcdvId = icdvId ?? vehicle.icdv_id;

    // Find assignment — global scope: assignment's icdv_id is the vehicle's ICDV
    // not the driver's home ICDV, so never filter by icdv_id on driver_assignments.
    let assignment;
    if (driverId !== null) {
      [assignment] = await connQuery(conn,
        "SELECT * FROM driver_assignments WHERE driver_id=? AND vehicle_id=? AND status='active' FOR UPDATE",
        [driverId, vehicleId]
      );
      if (!assignment)
        throw new ApiError(httpStatus.NOT_FOUND, 'No active driver assignment found');
    } else {
      // No driver — look for the active transfer for this vehicle directly
      [assignment] = await connQuery(conn,
        "SELECT * FROM driver_assignments WHERE vehicle_id=? AND status='active' FOR UPDATE",
        [vehicleId]
      );
      // No assignment is acceptable when vehicle was transferred without a driver
    }

    const driverIdCard = driverId
      ? (await connQuery(conn, 'SELECT id_number FROM drivers WHERE driver_id=?', [driverId]))[0]?.id_number ?? null
      : null;

    // Look up the transfer record — either from the assignment or directly
    let transferId = assignment?.transfer_id ?? null;
    if (!transferId) {
      const [tr] = await connQuery(conn,
        "SELECT transfer_id FROM transfers WHERE vehicle_id=? AND status='active' ORDER BY transfer_id DESC LIMIT 1",
        [vehicleId]
      );
      transferId = tr?.transfer_id ?? null;
    }

    const rl = await connQuery(conn,
      `INSERT INTO receiving_logs
         (icdv_id, vehicle_id, transfer_id, driver_id, driver_id_card, received_by, receive_notes)
       VALUES (?,?,?,?,?,?,?)`,
      [effectiveIcdvId, vehicleId, transferId, driverId, driverIdCard, operatorId, notes]
    );

    if (assignment) {
      await connQuery(conn,
        "UPDATE driver_assignments SET status='closed', closed_at=NOW() WHERE assignment_id=?",
        [assignment.assignment_id]
      );
    }
    if (transferId) {
      await connQuery(conn,
        "UPDATE transfers SET status='completed', completed_at=NOW() WHERE transfer_id=?",
        [transferId]
      );
    }

    await connQuery(conn,
      `UPDATE vehicles
       SET workflow_status    = ?,
           current_location   = ?,
           operational_status = 'delivered',
           release_status     = 'collected',
           updated_by         = ?,
           updated_at         = NOW()
       WHERE vehicle_id = ?`,
      [WORKFLOW_STATUSES.RECEIVED, WORKFLOW_TO_LOCATION.received, operatorId, vehicleId]
    );

    await syncManifestStatus(conn, vehicle.manifest_id);
    await logOperation(conn, {
      icdvId: effectiveIcdvId, vehicleId, chassisNumber: vehicle.chassis_number,
      operationType: 'received',
      fromStatus: vehicle.workflow_status, toStatus: WORKFLOW_STATUSES.RECEIVED,
      fromLocation: vehicle.current_location, toLocation: WORKFLOW_TO_LOCATION.received,
      batchId: vehicle.batch_id, transferId,
      notes, performedBy: operatorId,
    });

    return { receive_id: rl.insertId, vehicle_id: vehicleId };
  });

// ─────────────────────────────────────────────────────────────────────────────
// 5. CHASSIS SEARCH — full journey with all status fields
// ─────────────────────────────────────────────────────────────────────────────

const searchChassis = async (chassis, icdvId) => {
  const like        = chassis.length <= 6 ? `%${chassis}` : `%${chassis}%`;
  const scopeClause = icdvId ? 'AND v.icdv_id=?' : '';
  const params      = icdvId ? [like, icdvId] : [like];
  const vehicles = await query(
    `SELECT
       v.vehicle_id, v.icdv_id, v.chassis_number, v.brand, v.model,
       v.color, v.year, v.customer_name, v.destination,
       v.workflow_status, v.current_location,
       v.release_status, v.operational_status,
       v.batch_id, v.manifest_id,
       m.manifest_number, m.arrival_date AS manifest_date, m.status AS manifest_status,
       vs.name AS vessel_name, vs.vessel_id, vs.imo_number,
       ic.name AS icdv_name, ic.code AS icdv_code,
       b.batch_number, b.batch_date, b.status AS batch_status,
       b.document_status, b.gc_status, b.operational_status AS batch_operational_status,
       t.transfer_id, t.transferred_at, t.status AS transfer_status,
       dr.full_name AS driver_name, dr.phone AS driver_phone,
       dr.id_number AS driver_id_card,
       rl.received_at, rl.receive_id
     FROM vehicles v
     LEFT JOIN manifests m  ON m.manifest_id  = v.manifest_id
     LEFT JOIN vessels vs   ON vs.vessel_id   = m.vessel_id
     LEFT JOIN icdvs ic     ON ic.icdv_id     = v.icdv_id
     LEFT JOIN batches b    ON b.batch_id     = v.batch_id
     LEFT JOIN transfers t  ON t.vehicle_id   = v.vehicle_id AND t.status != 'cancelled'
     LEFT JOIN drivers dr   ON dr.driver_id   = t.driver_id
     LEFT JOIN receiving_logs rl ON rl.vehicle_id = v.vehicle_id
     WHERE v.chassis_number LIKE ? ${scopeClause}
     ORDER BY v.chassis_number ASC LIMIT 20`,
    params
  );

  for (const veh of vehicles) {
    veh.history = await query(
      `SELECT vo.*, u.full_name AS operator_name
       FROM vehicle_operations vo
       LEFT JOIN users u ON u.user_id = vo.performed_by
       WHERE vo.vehicle_id=? ORDER BY vo.performed_at ASC`,
      [veh.vehicle_id]
    );
  }

  return vehicles;
};

const getVehicleHistory = async (vehicleId, icdvId) => {
  const [vehicle] = await query(
    'SELECT vehicle_id, icdv_id, chassis_number FROM vehicles WHERE vehicle_id=?', [vehicleId]
  );
  if (!vehicle) throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');
  // icdvId is null for super_admin/system_admin — allow through; scoped users must match
  if (icdvId !== null && vehicle.icdv_id !== icdvId)
    throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');

  // Operations log — joined with driver info from transfers where available
  const ops = await query(
    `SELECT
       vo.*,
       u.full_name        AS operator_name,
       d.full_name        AS driver_name,
       d.license_number   AS driver_license,
       t.driver_id_card
     FROM vehicle_operations vo
     LEFT JOIN users     u ON u.user_id      = vo.performed_by
     LEFT JOIN transfers t ON t.transfer_id  = vo.transfer_id
     LEFT JOIN drivers   d ON d.driver_id    = t.driver_id
     WHERE vo.vehicle_id=?
     ORDER BY vo.performed_at DESC`,
    [vehicleId]
  );
  return ops;
};

// ─────────────────────────────────────────────────────────────────────────────
// LIVE TRANSFER MONITORING (migration 014)
// Returns all vehicles currently in_transit with timing + delay calculation.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getLiveTransfers(icdvId)
 *
 * Returns vehicles with workflow_status = 'in_transit', enriched with:
 *   - transferred_at (TPA gate-out time)
 *   - elapsed_minutes (NOW - transferred_at)
 *   - transit_config: normal_minutes, max_minutes (from transit_time_configs)
 *   - delay_status: 'on_time' | 'delayed' | 'warning' (approaching max)
 *     warning threshold: elapsed >= (normal_minutes + ((max - normal) * 0.7))
 */
const getLiveTransfers = async (icdvId = null) => {
  const scopeW = icdvId ? 'AND v.icdv_id = ?' : '';
  const params = icdvId ? [icdvId] : [];

  return query(
    `SELECT
       v.vehicle_id,
       v.chassis_number,
       v.brand,
       v.model,
       v.color,
       v.destination,
       v.delivery_location,
       v.batch_id,
       v.manifest_id,
       m.manifest_number,
       m.arrival_date    AS manifest_arrival_date,
       vs.name           AS vessel_name,
       ic.name           AS icdv_name,
       ic.code           AS icdv_code,
       d.full_name       AS driver_name,
       d.phone           AS driver_phone,
       d.id_number       AS driver_id_card,
       d.license_number  AS driver_license,
       d.photo           AS driver_photo,
       t.transfer_id,
       t.transferred_at,
       t.transfer_notes,
       TIMESTAMPDIFF(MINUTE, COALESCE(t.transferred_at, v.updated_at), NOW()) AS elapsed_minutes,
       COALESCE(ttc.normal_minutes, 30)               AS normal_minutes,
       COALESCE(ttc.max_minutes, 60)                  AS max_minutes,
       CASE
         WHEN TIMESTAMPDIFF(MINUTE, COALESCE(t.transferred_at, v.updated_at), NOW()) >=
              COALESCE(ttc.max_minutes, 60)
           THEN 'delayed'
         WHEN TIMESTAMPDIFF(MINUTE, COALESCE(t.transferred_at, v.updated_at), NOW()) >=
              (COALESCE(ttc.normal_minutes, 30) +
               ((COALESCE(ttc.max_minutes, 60) - COALESCE(ttc.normal_minutes, 30)) * 0.7))
           THEN 'warning'
         ELSE 'on_time'
       END AS delay_status
     FROM vehicles v
     -- vehicle.workflow_status = 'in_transit' is the primary truth.
     -- LEFT JOIN on transfers to handle edge cases where transfer record
     -- status is inconsistent with vehicle status (data anomaly).
     -- We join on the active transfer first; fall back to most recent any-status.
     LEFT JOIN transfers t ON t.vehicle_id = v.vehicle_id
                          AND t.status IN ('active', 'completed')
                          AND t.transfer_id = (
                            SELECT transfer_id FROM transfers tr2
                            WHERE tr2.vehicle_id = v.vehicle_id
                              AND tr2.status IN ('active', 'completed')
                            ORDER BY tr2.transfer_id DESC LIMIT 1
                          )
     LEFT JOIN drivers d        ON d.driver_id   = t.driver_id
     LEFT JOIN manifests m      ON m.manifest_id = v.manifest_id
     LEFT JOIN vessels vs       ON vs.vessel_id  = m.vessel_id
     LEFT JOIN icdvs ic         ON ic.icdv_id    = v.icdv_id
     LEFT JOIN transit_time_configs ttc ON ttc.icdv_id = v.icdv_id
     WHERE v.workflow_status = 'in_transit' ${scopeW}
     ORDER BY elapsed_minutes DESC`,
    params
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TRANSFER PERFORMANCE REPORT (migration 014)
// Completed transfers with full timeline: gate-out → received.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getTransferPerformance({ icdvId, manifest_id, date_from, date_to, page, limit })
 *
 * Returns paginated completed transfers with:
 *   - tpa_gate_out_time (transferred_at)
 *   - arrival_time (received_at)
 *   - transfer_duration_minutes
 *   - on_time status vs configured max_minutes
 */
const getTransferPerformance = async ({
  icdvId = null,
  manifest_id,
  date_from,
  date_to,
  page  = 1,
  limit = 25,
} = {}) => {
  const where   = [];
  const params  = [];

  if (icdvId)     { where.push('v.icdv_id = ?');                       params.push(icdvId); }
  if (manifest_id){ where.push('v.manifest_id = ?');                   params.push(manifest_id); }
  if (date_from)  { where.push('t.transferred_at >= ?');               params.push(date_from); }
  if (date_to)    { where.push('t.transferred_at <= ?');               params.push(date_to + ' 23:59:59'); }

  const baseWhere = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offset    = (page - 1) * limit;

  const [{ total }] = await query(
    `SELECT COUNT(*) AS total
     FROM transfers t
     JOIN receiving_logs rl ON rl.transfer_id = t.transfer_id
     JOIN vehicles v        ON v.vehicle_id   = t.vehicle_id
     ${baseWhere}`,
    params
  );

  const rows = await query(
    `SELECT
       v.vehicle_id,
       v.chassis_number,
       v.brand,
       v.model,
       v.destination,
       m.manifest_number,
       m.manifest_id,
       d.full_name        AS driver_name,
       t.transferred_at   AS tpa_gate_out_time,
       rl.received_at     AS arrival_time,
       TIMESTAMPDIFF(MINUTE, t.transferred_at, rl.received_at) AS transfer_duration_minutes,
       COALESCE(ttc.normal_minutes, 30)  AS normal_minutes,
       COALESCE(ttc.max_minutes,   60)   AS max_minutes,
       CASE
         WHEN TIMESTAMPDIFF(MINUTE, t.transferred_at, rl.received_at) >=
              COALESCE(ttc.max_minutes, 60)
           THEN 'delayed'
         ELSE 'on_time'
       END AS performance_status
     FROM transfers t
     JOIN receiving_logs rl ON rl.transfer_id = t.transfer_id
     JOIN vehicles v        ON v.vehicle_id   = t.vehicle_id
     JOIN drivers d         ON d.driver_id    = t.driver_id
     LEFT JOIN manifests m  ON m.manifest_id  = v.manifest_id
     LEFT JOIN transit_time_configs ttc
                            ON ttc.icdv_id    = v.icdv_id
     ${baseWhere}
     ORDER BY t.transferred_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const { paginate } = buildPagination(page, limit);
  return paginate(rows, total);
};

// ─────────────────────────────────────────────────────────────────────────────
// TRANSIT TIME CONFIG CRUD
// ─────────────────────────────────────────────────────────────────────────────

const getTransitConfigs = async (icdvId = null) => {
  const where  = icdvId ? 'WHERE ttc.icdv_id = ?' : '';
  const params = icdvId ? [icdvId] : [];
  return query(
    `SELECT ttc.*, ic.name AS icdv_name, ic.code AS icdv_code
     FROM transit_time_configs ttc
     LEFT JOIN icdvs ic ON ic.icdv_id = ttc.icdv_id
     ${where}
     ORDER BY ic.name`,
    params
  );
};

/**
 * upsertTransitConfig({ icdvId, normal_minutes, max_minutes, notes }, userId)
 * One row per ICDV — INSERT or UPDATE.
 */
const upsertTransitConfig = async ({ icdvId, normal_minutes, max_minutes, notes }, userId) => {
  if (!icdvId) throw new ApiError(400, 'icdv_id is required');
  if (max_minutes <= normal_minutes)
    throw new ApiError(422, 'max_minutes must be greater than normal_minutes');

  await query(
    `INSERT INTO transit_time_configs (icdv_id, normal_minutes, max_minutes, notes, updated_by)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       normal_minutes = VALUES(normal_minutes),
       max_minutes    = VALUES(max_minutes),
       notes          = VALUES(notes),
       updated_by     = VALUES(updated_by)`,
    [icdvId, normal_minutes, max_minutes, notes ?? null, userId]
  );

  const [row] = await query(
    `SELECT ttc.*, ic.name AS icdv_name, ic.code AS icdv_code
     FROM transit_time_configs ttc
     LEFT JOIN icdvs ic ON ic.icdv_id = ttc.icdv_id
     WHERE ttc.icdv_id = ?`,
    [icdvId]
  );
  return row;
};

const deleteTransitConfig = async (configId, icdvId = null) => {
  const where = icdvId ? 'WHERE config_id = ? AND icdv_id = ?' : 'WHERE config_id = ?';
  await query(`DELETE FROM transit_time_configs ${where}`, icdvId ? [configId, icdvId] : [configId]);
};

module.exports = {
  // Discharge
  lookupForDischarge, discharge,
  // Batch
  lookupForBatch, addToBatch, getBatch, getBatches,
  // Batch status (migration 008)
  updateBatchStatus, getBatchPrintData,
  // Transfer
  lookupForTransfer, lookupDriverByIdCard, confirmTransfer,
  // TPA stats (migration 008)
  getTpaStats,
  // Receive
  lookupForReceive, confirmReceive,
  // Search & history
  searchChassis, getVehicleHistory,
  // Utilities
  findByChassisLast4, generateBatchNumber,
  syncManifestStatus,
  // Live monitoring + performance report (migration 014)
  getLiveTransfers,
  getTransferPerformance,
  // Transit time config (migration 014)
  getTransitConfigs,
  upsertTransitConfig,
  deleteTransitConfig,
};
