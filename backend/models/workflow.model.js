/**
 * workflow.model.js
 *
 * Implements the 5-step vehicle operational flow:
 *   1. Discharge   – vessel → holding ground
 *   2. Batch       – group discharged vehicles per vessel/day
 *   3. Transfer    – batch → TPA gate → ICDV yard (with driver)
 *   4. Receive     – confirm yard arrival, close driver assignment
 *   5. Search      – chassis lookup showing full journey
 *
 * Follows existing patterns: query(), transaction(), connQuery(),
 * buildPagination(), ApiError, catchAsync.
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
// INTERNAL HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Look up a vehicle by the last 4 digits of chassis number (tenant-scoped).
 * Returns array — caller must handle ambiguity.
 */
const findByChassisLast4 = async (last4, icdvId) => {
  return query(
    `SELECT v.vehicle_id, v.icdv_id, v.chassis_number, v.brand, v.model,
            v.color, v.year, v.customer_name, v.destination,
            v.workflow_status, v.current_location, v.batch_id,
            v.manifest_id,
            m.manifest_number, m.arrival_date AS manifest_arrival_date,
            vs.name AS vessel_name, vs.vessel_id,
            vs.imo_number
     FROM vehicles v
     LEFT JOIN manifests m ON m.manifest_id = v.manifest_id
     LEFT JOIN vessels vs ON vs.vessel_id = m.vessel_id
     WHERE v.chassis_number LIKE ? AND v.icdv_id = ?
     ORDER BY v.created_at DESC`,
    [`%${last4}`, icdvId]
  );
};

/** Resolve vehicle by chassis last-4, throw if not found or ambiguous */
const resolveVehicle = async (last4, icdvId) => {
  const matches = await findByChassisLast4(last4, icdvId);
  if (!matches.length) throw new ApiError(httpStatus.NOT_FOUND, `No vehicle found with chassis ending in '${last4}'`);
  if (matches.length > 1) throw new ApiError(httpStatus.CONFLICT, `Multiple vehicles match '${last4}'. Please enter more chassis digits.`);
  return matches[0];
};

/** Write an audit log entry (inside or outside transaction) */
const logOperation = async (connOrNull, {
  icdvId, vehicleId, chassisNumber, operationType,
  fromStatus = null, toStatus = null,
  fromLocation = null, toLocation = null,
  batchId = null, transferId = null,
  notes = null, performedBy,
}) => {
  const sql = `
    INSERT INTO vehicle_operations
      (icdv_id, vehicle_id, chassis_number, operation_type,
       from_status, to_status, from_location, to_location,
       batch_id, transfer_id, notes, performed_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;
  const params = [
    icdvId, vehicleId, chassisNumber, operationType,
    fromStatus, toStatus, fromLocation, toLocation,
    batchId, transferId, notes, performedBy,
  ];
  if (connOrNull) return connQuery(connOrNull, sql, params);
  return query(sql, params);
};

/** Validate workflow transition */
const assertTransition = (currentStatus, nextStatus) => {
  const allowed = WORKFLOW_STATUS_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new ApiError(
      httpStatus.CONFLICT,
      `Vehicle is ${currentStatus.toUpperCase()}. Cannot transition to ${nextStatus.toUpperCase()}. ` +
      `Allowed next states: ${allowed.length ? allowed.join(', ') : 'none'}.`
    );
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. DISCHARGE
// ─────────────────────────────────────────────────────────────────────────────

/** Step 1a — look up vehicle for operator confirmation */
const lookupForDischarge = async (last4, icdvId) => {
  const vehicle = await resolveVehicle(last4, icdvId);
  if (vehicle.workflow_status !== WORKFLOW_STATUSES.MANIFESTED) {
    throw new ApiError(
      httpStatus.CONFLICT,
      `Vehicle ${vehicle.chassis_number} is already ${vehicle.workflow_status.toUpperCase()}. ` +
      `Only MANIFESTED vehicles can be discharged.`
    );
  }
  return vehicle;
};

/** Step 1b — confirm and execute discharge */
const discharge = async (vehicleId, notes, operatorId, icdvId) => {
  return transaction(async (conn) => {
    // Re-fetch inside transaction and lock the row
    const [vehicle] = await connQuery(conn,
      'SELECT vehicle_id, icdv_id, chassis_number, workflow_status, current_location FROM vehicles WHERE vehicle_id=? FOR UPDATE',
      [vehicleId]
    );
    if (!vehicle) throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');
    if (vehicle.icdv_id !== icdvId) throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');

    assertTransition(vehicle.workflow_status, WORKFLOW_STATUSES.DISCHARGED);

    await connQuery(conn,
      `UPDATE vehicles
       SET workflow_status=?, current_location=?, updated_by=?, updated_at=NOW()
       WHERE vehicle_id=?`,
      [WORKFLOW_STATUSES.DISCHARGED, WORKFLOW_TO_LOCATION.discharged, operatorId, vehicleId]
    );

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
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. BATCH PROCESS
// ─────────────────────────────────────────────────────────────────────────────

const BATCH_MAX = 20;

/** Generate batch number: VESSELCODE-YYYYMMDD-NN */
const generateBatchNumber = async (vesselId, batchDate, icdvId, conn = null) => {
  const dateStr = batchDate.replace(/-/g, '');
  // Get vessel code (use imo_number or first 10 chars of name)
  const [vessel] = await (conn ? connQuery(conn, 'SELECT name, imo_number FROM vessels WHERE vessel_id=?', [vesselId])
                                : query('SELECT name, imo_number FROM vessels WHERE vessel_id=?', [vesselId]));
  const code = (vessel?.imo_number || vessel?.name || 'VES')
    .toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

  const prefix = `${code}-${dateStr}-`;
  const fn = conn ? connQuery : (sql, p) => query(sql, p);
  const rows = await fn(conn,
    `SELECT MAX(CAST(SUBSTRING_INDEX(batch_number, '-', -1) AS UNSIGNED)) AS last
     FROM batches WHERE batch_number LIKE ? AND icdv_id=?`,
    [`${code}-${dateStr}-%`, icdvId]
  );
  const last = rows[0]?.last || 0;
  return `${prefix}${String(last + 1).padStart(2, '0')}`;
};

/** Step 2a — look up vehicle for batching confirmation */
const lookupForBatch = async (last4, icdvId) => {
  const vehicle = await resolveVehicle(last4, icdvId);
  const allowed = [WORKFLOW_STATUSES.MANIFESTED, WORKFLOW_STATUSES.DISCHARGED];
  if (!allowed.includes(vehicle.workflow_status)) {
    throw new ApiError(
      httpStatus.CONFLICT,
      `Vehicle ${vehicle.chassis_number} is ${vehicle.workflow_status.toUpperCase()}. ` +
      `Only DISCHARGED (or MANIFESTED) vehicles can be batched.`
    );
  }
  // Check not already batched
  if (vehicle.batch_id) {
    throw new ApiError(httpStatus.CONFLICT, `Vehicle ${vehicle.chassis_number} is already in a batch.`);
  }
  return vehicle;
};

/** Step 2b — assign vehicle to batch (or create new batch) */
const addToBatch = async (vehicleId, notes, operatorId, icdvId) => {
  return transaction(async (conn) => {
    const [vehicle] = await connQuery(conn,
      `SELECT v.vehicle_id, v.icdv_id, v.chassis_number, v.workflow_status,
              v.batch_id, v.manifest_id,
              m.vessel_id
       FROM vehicles v
       LEFT JOIN manifests m ON m.manifest_id = v.manifest_id
       WHERE v.vehicle_id=? FOR UPDATE`,
      [vehicleId]
    );
    if (!vehicle) throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');
    if (vehicle.icdv_id !== icdvId) throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');
    if (vehicle.batch_id) throw new ApiError(httpStatus.CONFLICT, 'Vehicle is already in a batch');

    const today = new Date().toISOString().slice(0, 10);
    const vesselId = vehicle.vessel_id;

    // Find an open batch for today + vessel with space
    const [openBatch] = await connQuery(conn,
      `SELECT batch_id, vehicle_count, batch_number
       FROM batches
       WHERE icdv_id=? AND vessel_id=? AND batch_date=? AND status='open' AND vehicle_count < ?
       ORDER BY batch_id ASC LIMIT 1 FOR UPDATE`,
      [icdvId, vesselId, today, BATCH_MAX]
    );

    let batchId;
    let batchNumber;
    if (openBatch) {
      batchId = openBatch.batch_id;
      batchNumber = openBatch.batch_number;
      await connQuery(conn,
        'UPDATE batches SET vehicle_count = vehicle_count + 1, updated_at=NOW() WHERE batch_id=?',
        [batchId]
      );
    } else {
      // Create new batch
      batchNumber = await generateBatchNumber(vesselId, today, icdvId, conn);
      const r = await connQuery(conn,
        `INSERT INTO batches (icdv_id, batch_number, vessel_id, manifest_id, batch_date, vehicle_count, status, created_by)
         VALUES (?,?,?,?,?,1,'open',?)`,
        [icdvId, batchNumber, vesselId, vehicle.manifest_id, today, operatorId]
      );
      batchId = r.insertId;
    }

    // Update vehicle
    await connQuery(conn,
      `UPDATE vehicles
       SET workflow_status=?, batch_id=?, updated_by=?, updated_at=NOW()
       WHERE vehicle_id=?`,
      [WORKFLOW_STATUSES.BATCHED, batchId, operatorId, vehicleId]
    );

    await logOperation(conn, {
      icdvId, vehicleId, chassisNumber: vehicle.chassis_number,
      operationType: 'batched',
      fromStatus: vehicle.workflow_status, toStatus: WORKFLOW_STATUSES.BATCHED,
      batchId, notes, performedBy: operatorId,
    });

    return { vehicle_id: vehicleId, batch_id: batchId, batch_number: batchNumber };
  });
};

/** Get batch details */
const getBatch = async (batchId, icdvId) => {
  const [batch] = await query(
    `SELECT b.*, vs.name AS vessel_name, vs.imo_number
     FROM batches b LEFT JOIN vessels vs ON vs.vessel_id = b.vessel_id
     WHERE b.batch_id=? AND b.icdv_id=?`,
    [batchId, icdvId]
  );
  if (!batch) throw new ApiError(httpStatus.NOT_FOUND, 'Batch not found');
  batch.vehicles = await query(
    `SELECT v.vehicle_id, v.chassis_number, v.brand, v.model, v.color,
            v.workflow_status, v.current_location, v.customer_name
     FROM vehicles v WHERE v.batch_id=? AND v.icdv_id=?`,
    [batchId, icdvId]
  );
  return batch;
};

/** List batches (paginated) */
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
// 3. TRANSFER (TPA Gate)
// ─────────────────────────────────────────────────────────────────────────────

/** Step 3a — look up vehicle for transfer */
const lookupForTransfer = async (last4, icdvId) => {
  const vehicle = await resolveVehicle(last4, icdvId);
  if (vehicle.workflow_status !== WORKFLOW_STATUSES.BATCHED) {
    throw new ApiError(
      httpStatus.CONFLICT,
      `Vehicle ${vehicle.chassis_number} is ${vehicle.workflow_status.toUpperCase()}. Only BATCHED vehicles can be transferred.`
    );
  }
  return vehicle;
};

/** Step 3b — look up driver by internal ID card */
const lookupDriverByIdCard = async (idCard, icdvId) => {
  const [driver] = await query(
    'SELECT * FROM drivers WHERE id_number=? AND icdv_id=?',
    [idCard, icdvId]
  );
  if (!driver) throw new ApiError(httpStatus.NOT_FOUND, `No driver found with ID card '${idCard}'`);
  if (driver.status !== 'active') {
    throw new ApiError(httpStatus.CONFLICT, `Driver ${driver.full_name} is ${driver.status.toUpperCase()}. Only active drivers can perform transfers.`);
  }
  // Check driver has no active assignment
  const [activeAssign] = await query(
    `SELECT da.assignment_id, v.chassis_number
     FROM driver_assignments da
     JOIN vehicles v ON v.vehicle_id = da.vehicle_id
     WHERE da.driver_id=? AND da.status='active' AND da.icdv_id=?`,
    [driver.driver_id, icdvId]
  );
  if (activeAssign) {
    throw new ApiError(
      httpStatus.CONFLICT,
      `Driver ${driver.full_name} is already assigned to vehicle ${activeAssign.chassis_number}. ` +
      `Complete that transfer before assigning a new vehicle.`
    );
  }
  return driver;
};

/** Step 3c — confirm transfer */
const confirmTransfer = async (vehicleId, driverId, driverIdCard, notes, operatorId, icdvId) => {
  return transaction(async (conn) => {
    const [vehicle] = await connQuery(conn,
      `SELECT v.vehicle_id, v.icdv_id, v.chassis_number, v.workflow_status, v.batch_id, v.current_location
       FROM vehicles v WHERE v.vehicle_id=? FOR UPDATE`,
      [vehicleId]
    );
    if (!vehicle || vehicle.icdv_id !== icdvId) throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');
    assertTransition(vehicle.workflow_status, WORKFLOW_STATUSES.IN_TRANSIT);

    // Double-check driver still available
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

    // Create driver assignment
    await connQuery(conn,
      `INSERT INTO driver_assignments (icdv_id, driver_id, vehicle_id, transfer_id, assigned_by, status)
       VALUES (?,?,?,?,?,'active')`,
      [icdvId, driverId, vehicleId, transferId, operatorId]
    );

    // Update vehicle
    await connQuery(conn,
      `UPDATE vehicles SET workflow_status=?, current_location=?, updated_by=?, updated_at=NOW() WHERE vehicle_id=?`,
      [WORKFLOW_STATUSES.IN_TRANSIT, WORKFLOW_TO_LOCATION.in_transit, operatorId, vehicleId]
    );

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
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. RECEIVE (Yard)
// ─────────────────────────────────────────────────────────────────────────────

/** Step 4a — look up driver + active assignment by ID card */
const lookupForReceive = async (idCard, icdvId) => {
  const [driver] = await query(
    'SELECT * FROM drivers WHERE id_number=? AND icdv_id=?',
    [idCard, icdvId]
  );
  if (!driver) throw new ApiError(httpStatus.NOT_FOUND, `No driver found with ID card '${idCard}'`);

  const [assignment] = await query(
    `SELECT da.*,
       v.vehicle_id, v.chassis_number, v.brand, v.model, v.color, v.year,
       v.customer_name, v.workflow_status, v.current_location, v.batch_id,
       m.manifest_number, vs.name AS vessel_name,
       t.transfer_id, t.transferred_at, t.transfer_notes
     FROM driver_assignments da
     JOIN vehicles v ON v.vehicle_id = da.vehicle_id
     LEFT JOIN manifests m ON m.manifest_id = v.manifest_id
     LEFT JOIN vessels vs ON vs.vessel_id = m.vessel_id
     LEFT JOIN transfers t ON t.transfer_id = da.transfer_id
     WHERE da.driver_id=? AND da.status='active' AND da.icdv_id=?`,
    [driver.driver_id, icdvId]
  );

  if (!assignment) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      `Driver ${driver.full_name} has no active vehicle assignment`
    );
  }

  if (assignment.workflow_status !== WORKFLOW_STATUSES.IN_TRANSIT) {
    throw new ApiError(
      httpStatus.CONFLICT,
      `Vehicle ${assignment.chassis_number} is ${assignment.workflow_status.toUpperCase()}, not IN_TRANSIT`
    );
  }

  return { driver, assignment };
};

/** Step 4b — confirm receipt at yard */
const confirmReceive = async (driverId, vehicleId, notes, operatorId, icdvId) => {
  return transaction(async (conn) => {
    const [vehicle] = await connQuery(conn,
      'SELECT vehicle_id, icdv_id, chassis_number, workflow_status, batch_id, current_location FROM vehicles WHERE vehicle_id=? FOR UPDATE',
      [vehicleId]
    );
    if (!vehicle || vehicle.icdv_id !== icdvId) throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');
    assertTransition(vehicle.workflow_status, WORKFLOW_STATUSES.RECEIVED);

    // Get active assignment
    const [assignment] = await connQuery(conn,
      "SELECT * FROM driver_assignments WHERE driver_id=? AND vehicle_id=? AND status='active' AND icdv_id=? FOR UPDATE",
      [driverId, vehicleId, icdvId]
    );
    if (!assignment) throw new ApiError(httpStatus.NOT_FOUND, 'No active driver assignment found');

    // Get driver id_card for log
    const [driver] = await connQuery(conn, 'SELECT id_number FROM drivers WHERE driver_id=?', [driverId]);

    // Create receiving log
    const rl = await connQuery(conn,
      `INSERT INTO receiving_logs
         (icdv_id, vehicle_id, transfer_id, driver_id, driver_id_card, received_by, receive_notes)
       VALUES (?,?,?,?,?,?,?)`,
      [icdvId, vehicleId, assignment.transfer_id, driverId, driver.id_number, operatorId, notes]
    );

    // Close driver assignment
    await connQuery(conn,
      "UPDATE driver_assignments SET status='closed', closed_at=NOW() WHERE assignment_id=?",
      [assignment.assignment_id]
    );

    // Close transfer
    if (assignment.transfer_id) {
      await connQuery(conn,
        "UPDATE transfers SET status='completed', completed_at=NOW() WHERE transfer_id=?",
        [assignment.transfer_id]
      );
    }

    // Update vehicle
    await connQuery(conn,
      `UPDATE vehicles SET workflow_status=?, current_location=?, updated_by=?, updated_at=NOW() WHERE vehicle_id=?`,
      [WORKFLOW_STATUSES.RECEIVED, WORKFLOW_TO_LOCATION.received, operatorId, vehicleId]
    );

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
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. CHASSIS SEARCH — full journey
// ─────────────────────────────────────────────────────────────────────────────
const searchChassis = async (chassis, icdvId) => {
  // Full or partial chassis
  const like = chassis.length <= 6 ? `%${chassis}` : `%${chassis}%`;
  const vehicles = await query(
    `SELECT
       v.vehicle_id, v.icdv_id, v.chassis_number, v.brand, v.model,
       v.color, v.year, v.customer_name, v.destination,
       v.workflow_status, v.current_location, v.batch_id,
       v.manifest_id,
       m.manifest_number, m.arrival_date AS manifest_date,
       vs.name AS vessel_name, vs.vessel_id, vs.imo_number,
       b.batch_number, b.batch_date, b.status AS batch_status,
       t.transfer_id, t.transferred_at, t.status AS transfer_status,
       dr.full_name AS driver_name,
       rl.received_at, rl.receive_id
     FROM vehicles v
     LEFT JOIN manifests m ON m.manifest_id = v.manifest_id
     LEFT JOIN vessels vs ON vs.vessel_id = m.vessel_id
     LEFT JOIN batches b ON b.batch_id = v.batch_id
     LEFT JOIN transfers t ON t.vehicle_id = v.vehicle_id AND t.status != 'cancelled'
     LEFT JOIN drivers dr ON dr.driver_id = t.driver_id
     LEFT JOIN receiving_logs rl ON rl.vehicle_id = v.vehicle_id
     WHERE v.chassis_number LIKE ? AND v.icdv_id=?
     ORDER BY v.chassis_number ASC LIMIT 20`,
    [like, icdvId]
  );

  // Attach operation history to each result
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

/** Vehicle operation history */
const getVehicleHistory = async (vehicleId, icdvId) => {
  const [vehicle] = await query(
    'SELECT vehicle_id, icdv_id, chassis_number FROM vehicles WHERE vehicle_id=?', [vehicleId]
  );
  if (!vehicle || vehicle.icdv_id !== icdvId) throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');
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
  // Transfer
  lookupForTransfer, lookupDriverByIdCard, confirmTransfer,
  // Receive
  lookupForReceive, confirmReceive,
  // Search
  searchChassis, getVehicleHistory,
  // Internal exports for testing
  findByChassisLast4, generateBatchNumber,
};
