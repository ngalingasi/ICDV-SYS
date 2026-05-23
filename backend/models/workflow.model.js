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
      `Vehicle is ${currentStatus.toUpperCase()}. Cannot transition to ${nextStatus.toUpperCase()}. ` +
      `Allowed: ${allowed.length ? allowed.join(', ') : 'none'}.`
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
      `Vehicle ${vehicle.chassis_number} is already ${vehicle.workflow_status.toUpperCase()}. Only MANIFESTED vehicles can be discharged.`);
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

const BATCH_MAX = 20;

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
      `Vehicle ${vehicle.chassis_number} is ${vehicle.workflow_status.toUpperCase()}. Only DISCHARGED vehicles can be batched.`);
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

      if (newCount >= BATCH_MAX) {
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

const getBatches = async ({ page, limit, vessel_id, status, document_status, gc_status, operational_status, search } = {}, icdvId = null) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  let where = '1=1'; const params = [];
  if (icdvId !== null)        { where += ' AND b.icdv_id=?';             params.push(icdvId); }
  if (vessel_id)              { where += ' AND b.vessel_id=?';           params.push(vessel_id); }
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
      `Vehicle ${vehicle.chassis_number} is ${vehicle.workflow_status.toUpperCase()}. Only BATCHED vehicles can be transferred.`);
  return vehicle;
};

const lookupDriverByIdCard = async (idCard, icdvId) => {
  const _drvSql = icdvId ? 'SELECT * FROM drivers WHERE id_number=? AND icdv_id=?' : 'SELECT * FROM drivers WHERE id_number=?';
  const [driver] = await query(_drvSql, icdvId ? [idCard, icdvId] : [idCard]);
  if (!driver)
    throw new ApiError(httpStatus.NOT_FOUND, `No driver found with ID card '${idCard}'`);
  if (driver.status !== 'active')
    throw new ApiError(httpStatus.CONFLICT,
      `Driver ${driver.full_name} is ${driver.status.toUpperCase()}. Only active drivers can perform transfers.`);

  const [activeAssign] = await query(
    `SELECT da.assignment_id, v.chassis_number
     FROM driver_assignments da
     JOIN vehicles v ON v.vehicle_id = da.vehicle_id
     WHERE da.driver_id=? AND da.status='active' AND da.icdv_id=?`,
    [driver.driver_id, icdvId]
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

    // Lock driver — use the vehicle's resolved icdv_id for cross-tenant users
    // (icdvId may be null for system_admin/super_admin before resolution).
    // vehicle.icdv_id is always populated after the FOR UPDATE fetch above.
    const effectiveIcdvForDriver = icdvId ?? vehicle.icdv_id;
    const [active] = await connQuery(conn,
      "SELECT assignment_id FROM driver_assignments WHERE driver_id=? AND status='active' AND icdv_id=? FOR UPDATE",
      [driverId, effectiveIcdvForDriver]
    );
    if (active) throw new ApiError(httpStatus.CONFLICT, 'Driver already has an active assignment');

    // Create transfer record
    const tr = await connQuery(conn,
      `INSERT INTO transfers
         (icdv_id, vehicle_id, batch_id, driver_id, driver_id_card, transferred_by, transfer_notes, status)
       VALUES (?,?,?,?,?,?,?,'active')`,
      [effectiveIcdvForDriver, vehicleId, vehicle.batch_id, driverId, driverIdCard, operatorId, notes]
    );
    const transferId = tr.insertId;

    // Driver assignment
    await connQuery(conn,
      `INSERT INTO driver_assignments (icdv_id, driver_id, vehicle_id, transfer_id, assigned_by, status)
       VALUES (?,?,?,?,?,'active')`,
      [effectiveIcdvForDriver, driverId, vehicleId, transferId, operatorId]
    );

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
  const _dSql = icdvId ? 'SELECT * FROM drivers WHERE id_number=? AND icdv_id=?' : 'SELECT * FROM drivers WHERE id_number=?';
  const [driver] = await query(_dSql, icdvId ? [idCard, icdvId] : [idCard]);
  if (!driver)
    throw new ApiError(httpStatus.NOT_FOUND, `No driver found with ID card '${idCard}'`);
  const _rcvIcdvId = driver.icdv_id;

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
     WHERE da.driver_id=? AND da.status='active' AND da.icdv_id=?`,
    [driver.driver_id, _rcvIcdvId]
  );
  if (!assignment)
    throw new ApiError(httpStatus.NOT_FOUND, `Driver ${driver.full_name} has no active vehicle assignment`);
  if (assignment.workflow_status !== WORKFLOW_STATUSES.IN_TRANSIT)
    throw new ApiError(httpStatus.CONFLICT,
      `Vehicle ${assignment.chassis_number} is ${assignment.workflow_status.toUpperCase()}, not IN_TRANSIT`);

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

    const [assignment] = await connQuery(conn,
      "SELECT * FROM driver_assignments WHERE driver_id=? AND vehicle_id=? AND status='active' AND icdv_id=? FOR UPDATE",
      [driverId, vehicleId, icdvId]
    );
    if (!assignment)
      throw new ApiError(httpStatus.NOT_FOUND, 'No active driver assignment found');

    const [driver] = await connQuery(conn, 'SELECT id_number FROM drivers WHERE driver_id=?', [driverId]);

    const rl = await connQuery(conn,
      `INSERT INTO receiving_logs
         (icdv_id, vehicle_id, transfer_id, driver_id, driver_id_card, received_by, receive_notes)
       VALUES (?,?,?,?,?,?,?)`,
      [icdvId, vehicleId, assignment.transfer_id, driverId, driver.id_number, operatorId, notes]
    );

    await connQuery(conn,
      "UPDATE driver_assignments SET status='closed', closed_at=NOW() WHERE assignment_id=?",
      [assignment.assignment_id]
    );
    if (assignment.transfer_id) {
      await connQuery(conn,
        "UPDATE transfers SET status='completed', completed_at=NOW() WHERE transfer_id=?",
        [assignment.transfer_id]
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
      icdvId, vehicleId, chassisNumber: vehicle.chassis_number,
      operationType: 'received',
      fromStatus: vehicle.workflow_status, toStatus: WORKFLOW_STATUSES.RECEIVED,
      fromLocation: vehicle.current_location, toLocation: WORKFLOW_TO_LOCATION.received,
      batchId: vehicle.batch_id, transferId: assignment.transfer_id,
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
  if (!vehicle || vehicle.icdv_id !== icdvId)
    throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');
  return query(
    `SELECT vo.*, u.full_name AS operator_name
     FROM vehicle_operations vo
     LEFT JOIN users u ON u.user_id = vo.performed_by
     WHERE vo.vehicle_id=? ORDER BY vo.performed_at DESC`,
    [vehicleId]
  );
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
};
