/**
 * workflow.model.js  — STATUS SYNC FIXED
 *
 * Every operation now atomically updates:
 *   vehicles.workflow_status        — the 5-step state (single source of truth)
 *   vehicles.current_location       — physical location
 *   vehicles.operational_status     — kept in sync so old queries still work
 *   vehicles.release_status         — set to 'released' at transfer, 'collected' at receive
 *   manifests.*_count               — running totals per step (manifested/discharged/batched/in_transit/received)
 *   manifests.status                — auto-advances: pending→active→completed
 *   vehicle_operations              — full audit log entry
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
} = require('../config/statuses');

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
  // Re-count all workflow states for this manifest
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

  // Auto-advance manifest.status:
  //   pending   → active     (first vehicle leaves manifested state)
  //   active    → completed  (all vehicles received)
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

    // 1. Update vehicle — all statuses atomically
    await applyVehicleStatus(conn, vehicleId, WORKFLOW_STATUSES.DISCHARGED, operatorId);

    // 2. Sync manifest counts + status
    await syncManifestStatus(conn, vehicle.manifest_id);

    // 3. Audit log
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

const generateBatchNumber = async (vesselId, batchDate, icdvId, conn = null) => {
  const dateStr = batchDate.replace(/-/g, '');
  const [vessel] = await (conn
    ? connQuery(conn, 'SELECT name, imo_number FROM vessels WHERE vessel_id=?', [vesselId])
    : query('SELECT name, imo_number FROM vessels WHERE vessel_id=?', [vesselId]));
  const code = (vessel?.imo_number || vessel?.name || 'VES')
    .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  const rows = await (conn
    ? connQuery(conn,
        `SELECT MAX(CAST(SUBSTRING_INDEX(batch_number, '-', -1) AS UNSIGNED)) AS last
         FROM batches WHERE batch_number LIKE ? AND icdv_id=?`,
        [`${code}-${dateStr}-%`, icdvId])
    : query(
        `SELECT MAX(CAST(SUBSTRING_INDEX(batch_number, '-', -1) AS UNSIGNED)) AS last
         FROM batches WHERE batch_number LIKE ? AND icdv_id=?`,
        [`${code}-${dateStr}-%`, icdvId]));
  const last = rows[0]?.last || 0;
  return `${code}-${dateStr}-${String(last + 1).padStart(2, '0')}`;
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

    const today = new Date().toISOString().slice(0, 10);
    const vesselId = vehicle.vessel_id;

    // Find open batch with space or create new
    const [openBatch] = await connQuery(conn,
      `SELECT batch_id, vehicle_count, batch_number FROM batches
       WHERE icdv_id=? AND vessel_id=? AND batch_date=? AND status='open' AND vehicle_count < ?
       ORDER BY batch_id ASC LIMIT 1 FOR UPDATE`,
      [icdvId, vesselId, today, BATCH_MAX]
    );

    let batchId, batchNumber;
    if (openBatch) {
      batchId = openBatch.batch_id;
      batchNumber = openBatch.batch_number;
      await connQuery(conn,
        'UPDATE batches SET vehicle_count = vehicle_count + 1, updated_at=NOW() WHERE batch_id=?',
        [batchId]
      );
    } else {
      batchNumber = await generateBatchNumber(vesselId, today, icdvId, conn);
      const r = await connQuery(conn,
        `INSERT INTO batches (icdv_id, batch_number, vessel_id, manifest_id, batch_date, vehicle_count, status, created_by)
         VALUES (?,?,?,?,?,1,'open',?)`,
        [icdvId, batchNumber, vesselId, vehicle.manifest_id, today, operatorId]
      );
      batchId = r.insertId;
    }

    // 1. Update vehicle — set batch_id + all statuses
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

    // 2. Sync manifest
    await syncManifestStatus(conn, vehicle.manifest_id);

    // 3. Audit log
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
            ic.name AS icdv_name, ic.code AS icdv_code
     FROM batches b
     LEFT JOIN vessels vs ON vs.vessel_id = b.vessel_id
     LEFT JOIN icdvs ic   ON ic.icdv_id   = b.icdv_id
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

const getBatches = async ({ page, limit, vessel_id, status, search } = {}, icdvId = null) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  let where = '1=1'; const params = [];
  if (icdvId !== null) { where += ' AND b.icdv_id=?'; params.push(icdvId); }
  if (vessel_id)       { where += ' AND b.vessel_id=?'; params.push(vessel_id); }
  if (status)          { where += ' AND b.status=?'; params.push(status); }
  if (search)          { where += ' AND b.batch_number LIKE ?'; params.push(`%${search}%`); }

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

const confirmTransfer = async (vehicleId, driverId, driverIdCard, notes, operatorId, icdvId) =>
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

    // Lock driver
    const [active] = await connQuery(conn,
      "SELECT assignment_id FROM driver_assignments WHERE driver_id=? AND status='active' AND icdv_id=? FOR UPDATE",
      [driverId, icdvId]
    );
    if (active) throw new ApiError(httpStatus.CONFLICT, 'Driver already has an active assignment');

    // Create transfer record
    const tr = await connQuery(conn,
      `INSERT INTO transfers
         (icdv_id, vehicle_id, batch_id, driver_id, driver_id_card, transferred_by, transfer_notes, status)
       VALUES (?,?,?,?,?,?,?,'active')`,
      [icdvId, vehicleId, vehicle.batch_id, driverId, driverIdCard, operatorId, notes]
    );
    const transferId = tr.insertId;

    // Driver assignment
    await connQuery(conn,
      `INSERT INTO driver_assignments (icdv_id, driver_id, vehicle_id, transfer_id, assigned_by, status)
       VALUES (?,?,?,?,?,'active')`,
      [icdvId, driverId, vehicleId, transferId, operatorId]
    );

    // 1. Update vehicle — all statuses atomically (release_status → 'released' here)
    await applyVehicleStatus(conn, vehicleId, WORKFLOW_STATUSES.IN_TRANSIT, operatorId);

    // 2. Sync manifest
    await syncManifestStatus(conn, vehicle.manifest_id);

    // 3. Audit log
    await logOperation(conn, {
      icdvId, vehicleId, chassisNumber: vehicle.chassis_number,
      operationType: 'transferred',
      fromStatus: vehicle.workflow_status, toStatus: WORKFLOW_STATUSES.IN_TRANSIT,
      fromLocation: vehicle.current_location, toLocation: WORKFLOW_TO_LOCATION.in_transit,
      batchId: vehicle.batch_id, transferId,
      notes, performedBy: operatorId,
    });

    return { transfer_id: transferId, vehicle_id: vehicleId, driver_id: driverId };
  });

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

    // Receiving log
    const rl = await connQuery(conn,
      `INSERT INTO receiving_logs
         (icdv_id, vehicle_id, transfer_id, driver_id, driver_id_card, received_by, receive_notes)
       VALUES (?,?,?,?,?,?,?)`,
      [icdvId, vehicleId, assignment.transfer_id, driverId, driver.id_number, operatorId, notes]
    );

    // Close assignment + transfer
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

    // 1. Update vehicle — all statuses atomically
    //    release_status → 'collected', operational_status → 'delivered'
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

    // 2. Sync manifest
    await syncManifestStatus(conn, vehicle.manifest_id);

    // 3. Audit log
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
  lookupForDischarge, discharge,
  lookupForBatch, addToBatch, getBatch, getBatches,
  lookupForTransfer, lookupDriverByIdCard, confirmTransfer,
  lookupForReceive, confirmReceive,
  searchChassis, getVehicleHistory,
  findByChassisLast4, generateBatchNumber,
  // Expose sync helper for manifest CSV import use
  syncManifestStatus,
};
