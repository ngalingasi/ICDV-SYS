/**
 * deliverySheet.model.js
 *
 * Aggregates transfer records into a printable delivery sheet grouped by batch.
 * Each row = one driver in a batch, with all their assigned chassis numbers
 * spread into dynamic vehicle columns.
 *
 * Data source: transfers + driver_assignments + vehicles + drivers + batches
 */

const { query } = require('../config/database');
const ApiError  = require('../utils/ApiError');
const httpStatus = require('http-status');

/**
 * getDeliverySheetData(batchId, icdvId)
 *
 * Returns:
 * {
 *   batch:   { batch_id, batch_number, batch_date, vessel_name, icdv_name, vehicle_count }
 *   drivers: [
 *     {
 *       driver_id, id_number, full_name, phone,
 *       chassis_numbers: ['KCG1234', 'KCG5678', ...]  ← ordered by transferred_at
 *     }
 *   ]
 *   max_vehicles: 5   ← max chassis count across all drivers (sets column count)
 * }
 */
const getDeliverySheetData = async (batchId, icdvId = null) => {
  // ── 1. Load batch header ────────────────────────────────────────────────────
  const batchWhere  = icdvId ? 'WHERE b.batch_id=? AND b.icdv_id=?' : 'WHERE b.batch_id=?';
  const batchParams = icdvId ? [batchId, icdvId] : [batchId];

  const [batch] = await query(
    `SELECT b.batch_id, b.batch_number, b.batch_date, b.status,
            b.vehicle_count, b.max_vehicles,
            vs.name  AS vessel_name,
            ic.name  AS icdv_name,
            ic.code  AS icdv_code
     FROM batches b
     LEFT JOIN vessels vs ON vs.vessel_id = b.vessel_id
     LEFT JOIN icdvs   ic ON ic.icdv_id   = b.icdv_id
     ${batchWhere}`,
    batchParams
  );

  if (!batch) throw new ApiError(httpStatus.NOT_FOUND, 'Batch not found');

  // ── 2. Load all transfers for this batch, joining driver + vehicle ──────────
  const trWhere  = icdvId ? 'WHERE t.batch_id=? AND t.icdv_id=?' : 'WHERE t.batch_id=?';
  const trParams = icdvId ? [batchId, icdvId] : [batchId];

  const rows = await query(
    `SELECT
       d.driver_id,
       d.id_number,
       d.full_name      AS driver_name,
       d.phone          AS driver_phone,
       v.chassis_number,
       t.transferred_at
     FROM transfers t
     JOIN drivers  d ON d.driver_id  = t.driver_id
     JOIN vehicles v ON v.vehicle_id = t.vehicle_id
     ${trWhere}
       AND t.status != 'cancelled'
     ORDER BY d.id_number ASC, t.transferred_at ASC`,
    trParams
  );

  // ── 3. Group by driver, collecting chassis arrays ───────────────────────────
  const driverMap = new Map();

  for (const row of rows) {
    const key = row.driver_id;
    if (!driverMap.has(key)) {
      driverMap.set(key, {
        driver_id:       row.driver_id,
        id_number:       row.id_number,
        full_name:       row.driver_name,
        phone:           row.driver_phone,
        chassis_numbers: [],
      });
    }
    driverMap.get(key).chassis_numbers.push(row.chassis_number);
  }

  const drivers = Array.from(driverMap.values());

  // ── 4. Compute max_vehicles for dynamic column count ───────────────────────
  const maxVehicles = drivers.reduce((m, d) => Math.max(m, d.chassis_numbers.length), 0);

  return {
    batch,
    drivers,
    max_vehicles: maxVehicles,
  };
};

/**
 * getDeliverySheetsByVessel(vesselId, icdvId)
 *
 * Returns delivery sheet data for all batches belonging to a vessel,
 * grouped as an array of batch sections (same shape per section).
 */
const getDeliverySheetsByVessel = async (vesselId, icdvId = null) => {
  const bWhere  = icdvId
    ? 'WHERE b.vessel_id=? AND b.icdv_id=?'
    : 'WHERE b.vessel_id=?';
  const bParams = icdvId ? [vesselId, icdvId] : [vesselId];

  const batches = await query(
    `SELECT b.batch_id FROM batches b ${bWhere} ORDER BY b.batch_date ASC, b.batch_id ASC`,
    bParams
  );

  if (!batches.length) throw new ApiError(httpStatus.NOT_FOUND, 'No batches found for this vessel');

  const sections = await Promise.all(
    batches.map(b => getDeliverySheetData(b.batch_id, icdvId))
  );
  return sections;
};

module.exports = { getDeliverySheetData, getDeliverySheetsByVessel };
