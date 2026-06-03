/**
 * deliverySheet.model.js
 *
 * Generates printable delivery sheet data at two levels:
 *
 *   1. BATCH level    — single batch, one driver/chassis table
 *   2. MANIFEST level — all batches under a manifest, grouped by batch
 *   3. VESSEL level   — all batches for a vessel (legacy, kept for compat)
 *
 * Data source: transfers → drivers + vehicles, grouped via batches → manifest
 */

const { query } = require('../config/database');
const ApiError   = require('../utils/ApiError');
const httpStatus = require('http-status');
const { getTransferRate } = require('./lookup.model');

/**
 * Resolve the effective transfer rate for a manifest.
 * Uses the manifest's own rate if > 0, otherwise falls back to the global default.
 */
const resolveTransferRate = async (manifestRate) => {
  const r = parseFloat(String(manifestRate ?? 0));
  if (r > 0) return r;
  return getTransferRate(); // pulls from system_settings
};

// ─── Shared helper ────────────────────────────────────────────────────────────

/**
 * buildDriverRows(batchId, icdvId)
 *
 * For one batch, returns all drivers and their assigned chassis numbers.
 * Results are ordered by driver id_number then transferred_at so column
 * positions are deterministic across prints.
 */
const buildDriverRows = async (batchId, icdvId) => {
  const where  = icdvId
    ? "WHERE t.batch_id=? AND t.icdv_id=? AND t.status != 'cancelled'"
    : "WHERE t.batch_id=?             AND t.status != 'cancelled'";
  const params = icdvId ? [batchId, icdvId] : [batchId];

  const rows = await query(
    `SELECT
       d.driver_id,
       d.id_number,
       d.license_number,
       d.full_name      AS driver_name,
       d.phone          AS driver_phone,
       v.chassis_number,
       t.transferred_at
     FROM transfers t
     JOIN drivers  d ON d.driver_id  = t.driver_id
     JOIN vehicles v ON v.vehicle_id = t.vehicle_id
     ${where}
     ORDER BY d.id_number ASC, t.transferred_at ASC`,
    params
  );

  const driverMap = new Map();
  for (const row of rows) {
    if (!driverMap.has(row.driver_id)) {
      driverMap.set(row.driver_id, {
        driver_id:       row.driver_id,
        id_number:       row.id_number,
        license_number:  row.license_number,
        full_name:       row.driver_name,
        phone:           row.driver_phone,
        chassis_numbers: [],
      });
    }
    driverMap.get(row.driver_id).chassis_numbers.push(row.chassis_number);
  }

  const drivers      = Array.from(driverMap.values());
  const max_vehicles = drivers.reduce((m, d) => Math.max(m, d.chassis_numbers.length), 0);
  return { drivers, max_vehicles };
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. BATCH-LEVEL delivery sheet
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getDeliverySheetData(batchId, icdvId)
 *
 * Returns:
 * {
 *   batch:        { batch_id, batch_number, batch_date, status, vehicle_count,
 *                   vessel_name, icdv_name, icdv_code }
 *   drivers:      DriverRow[]
 *   max_vehicles: number
 * }
 */
const getDeliverySheetData = async (batchId, icdvId = null) => {
  const bWhere  = icdvId ? 'WHERE b.batch_id=? AND b.icdv_id=?' : 'WHERE b.batch_id=?';
  const bParams = icdvId ? [batchId, icdvId] : [batchId];

  const [batch] = await query(
    `SELECT b.batch_id, b.batch_number, b.batch_date, b.status,
            b.vehicle_count, b.max_vehicles,
            vs.name  AS vessel_name,
            ic.name  AS icdv_name,
            ic.code  AS icdv_code,
            m.transfer_rate
     FROM batches b
     LEFT JOIN vessels   vs ON vs.vessel_id   = b.vessel_id
     LEFT JOIN icdvs     ic ON ic.icdv_id     = b.icdv_id
     LEFT JOIN manifests m  ON m.manifest_id  = b.manifest_id
     ${bWhere}`,
    bParams
  );
  if (!batch) throw new ApiError(httpStatus.NOT_FOUND, 'Batch not found');

  const { drivers, max_vehicles } = await buildDriverRows(batchId, icdvId);
  batch.transfer_rate = await resolveTransferRate(batch.transfer_rate);
  return { batch, drivers, max_vehicles };
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. MANIFEST-LEVEL delivery sheet  ← PRIMARY NEW FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getManifestDeliverySheet(manifestId, icdvId)
 *
 * Returns the manifest header + one batch section per batch (in creation order).
 *
 * Shape:
 * {
 *   manifest: {
 *     manifest_id, manifest_number, arrival_date, status,
 *     vessel_name, icdv_name, icdv_code,
 *     total_vehicles, total_batches
 *   }
 *   batches: [
 *     {
 *       batch_id, batch_number, batch_date, status, vehicle_count,
 *       drivers: DriverRow[],
 *       max_vehicles: number
 *     }
 *   ]
 * }
 */
const getManifestDeliverySheet = async (manifestId, icdvId = null) => {
  // ── 1. Manifest header ─────────────────────────────────────────────────────
  const mWhere  = icdvId ? 'WHERE m.manifest_id=? AND m.icdv_id=?' : 'WHERE m.manifest_id=?';
  const mParams = icdvId ? [manifestId, icdvId] : [manifestId];

  const [manifest] = await query(
    `SELECT
       m.manifest_id, m.manifest_number, m.arrival_date, m.status,
       m.transfer_rate,
       (m.manifested_count + m.discharged_count + m.batched_count
        + m.in_transit_count + m.received_count) AS total_vehicles,
       vs.name AS vessel_name,
       ic.name AS icdv_name,
       ic.code AS icdv_code
     FROM manifests m
     LEFT JOIN vessels vs ON vs.vessel_id = m.vessel_id
     LEFT JOIN icdvs   ic ON ic.icdv_id   = m.icdv_id
     ${mWhere}`,
    mParams
  );
  if (!manifest) throw new ApiError(httpStatus.NOT_FOUND, 'Manifest not found');

  // ── 2. All batches belonging to this manifest ──────────────────────────────
  const bWhere  = icdvId
    ? 'WHERE b.manifest_id=? AND b.icdv_id=?'
    : 'WHERE b.manifest_id=?';
  const bParams = icdvId ? [manifestId, icdvId] : [manifestId];

  const batchRows = await query(
    `SELECT b.batch_id, b.batch_number, b.batch_date, b.status, b.vehicle_count
     FROM batches b
     ${bWhere}
     ORDER BY b.batch_id ASC`,
    bParams
  );

  if (!batchRows.length) {
    // Return manifest header with empty batches — no 404; sheet can still be rendered
    return {
      manifest: { ...manifest, total_batches: 0 },
      batches:  [],
    };
  }

  // ── 3. Load driver rows for every batch in parallel ───────────────────────
  const batchSections = await Promise.all(
    batchRows.map(async (b) => {
      const { drivers, max_vehicles } = await buildDriverRows(b.batch_id, icdvId);
      return {
        batch_id:      b.batch_id,
        batch_number:  b.batch_number,
        batch_date:    b.batch_date,
        status:        b.status,
        vehicle_count: b.vehicle_count,
        drivers,
        max_vehicles,
      };
    })
  );

  return {
    manifest: { ...manifest, total_batches: batchRows.length, transfer_rate: await resolveTransferRate(manifest.transfer_rate) },
    batches:  batchSections,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. VESSEL-LEVEL (legacy — kept for backward compat)
// ─────────────────────────────────────────────────────────────────────────────

const getDeliverySheetsByVessel = async (vesselId, icdvId = null) => {
  const bWhere  = icdvId ? 'WHERE b.vessel_id=? AND b.icdv_id=?' : 'WHERE b.vessel_id=?';
  const bParams = icdvId ? [vesselId, icdvId] : [vesselId];

  const batches = await query(
    `SELECT b.batch_id FROM batches b ${bWhere} ORDER BY b.batch_id ASC`,
    bParams
  );
  if (!batches.length) throw new ApiError(httpStatus.NOT_FOUND, 'No batches found for this vessel');

  return Promise.all(batches.map(b => getDeliverySheetData(b.batch_id, icdvId)));
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. COMBINED MANIFEST delivery sheet — all batches merged into one view
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getCombinedDeliverySheet(manifestId, icdvId)
 *
 * Merges all batch driver rows for a manifest into a single flat list.
 * Each unique driver appears once, with ALL their chassis numbers across
 * all batches concatenated.
 *
 * Shape:
 * {
 *   manifest: { manifest_id, manifest_number, arrival_date, status,
 *               vessel_name, icdv_name, icdv_code,
 *               total_vehicles, total_batches }
 *   drivers:       DriverRow[]  ← merged across batches
 *   total_vehicles: number      ← sum of all chassis across all drivers
 *   chassis_list:   string      ← all chassis comma-separated
 * }
 */
const getCombinedDeliverySheet = async (manifestId, icdvId = null) => {
  // ── 1. Manifest header ─────────────────────────────────────────────────────
  const mWhere  = icdvId ? 'WHERE m.manifest_id=? AND m.icdv_id=?' : 'WHERE m.manifest_id=?';
  const mParams = icdvId ? [manifestId, icdvId] : [manifestId];

  const [manifest] = await query(
    `SELECT
       m.manifest_id, m.manifest_number, m.arrival_date, m.status,
       m.transfer_rate,
       (m.manifested_count + m.discharged_count + m.batched_count
        + m.in_transit_count + m.received_count) AS total_vehicles,
       vs.name AS vessel_name,
       ic.name AS icdv_name,
       ic.code AS icdv_code
     FROM manifests m
     LEFT JOIN vessels vs ON vs.vessel_id = m.vessel_id
     LEFT JOIN icdvs   ic ON ic.icdv_id   = m.icdv_id
     ${mWhere}`,
    mParams
  );
  if (!manifest) throw new ApiError(httpStatus.NOT_FOUND, 'Manifest not found');

  // ── 2. All batches for this manifest ───────────────────────────────────────
  const bWhere  = icdvId ? 'WHERE b.manifest_id=? AND b.icdv_id=?' : 'WHERE b.manifest_id=?';
  const bParams = icdvId ? [manifestId, icdvId] : [manifestId];

  const batchRows = await query(
    `SELECT b.batch_id FROM batches b ${bWhere} ORDER BY b.batch_id ASC`,
    bParams
  );

  const totalBatches = batchRows.length;

  if (!totalBatches) {
    return {
      manifest: { ...manifest, total_batches: 0 },
      drivers: [],
      total_vehicles: 0,
      chassis_list: '',
    };
  }

  // ── 3. Merge driver rows across all batches ────────────────────────────────
  // Re-query across all batches at once for efficiency
  const batchIds = batchRows.map(b => b.batch_id);
  const placeholders = batchIds.map(() => '?').join(',');
  const scopeClause  = icdvId ? ' AND t.icdv_id=?' : '';
  const scopeParams  = icdvId ? [...batchIds, icdvId] : batchIds;

  const rows = await query(
    `SELECT
       d.driver_id,
       d.id_number,
       d.license_number,
       d.full_name      AS driver_name,
       d.phone          AS driver_phone,
       v.chassis_number,
       t.transferred_at
     FROM transfers t
     JOIN drivers  d ON d.driver_id  = t.driver_id
     JOIN vehicles v ON v.vehicle_id = t.vehicle_id
     WHERE t.batch_id IN (${placeholders})
       AND t.status != 'cancelled'${scopeClause}
     ORDER BY d.id_number ASC, t.transferred_at ASC`,
    scopeParams
  );

  // Merge by driver_id
  const driverMap = new Map();
  for (const row of rows) {
    if (!driverMap.has(row.driver_id)) {
      driverMap.set(row.driver_id, {
        driver_id:       row.driver_id,
        id_number:       row.id_number,
        license_number:  row.license_number,
        full_name:       row.driver_name,
        phone:           row.driver_phone,
        chassis_numbers: [],
      });
    }
    driverMap.get(row.driver_id).chassis_numbers.push(row.chassis_number);
  }

  const drivers = Array.from(driverMap.values());

  // Build flat comma-separated chassis list across all drivers
  const allChassis = drivers.flatMap(d => d.chassis_numbers);
  const totalVehicles = allChassis.length;
  const chassisList = allChassis.join(', ');

  return {
    manifest: { ...manifest, total_batches: totalBatches, transfer_rate: await resolveTransferRate(manifest.transfer_rate) },
    drivers,
    total_vehicles: totalVehicles,
    chassis_list: chassisList,
  };
};

module.exports = {
  getDeliverySheetData,         // single batch
  getManifestDeliverySheet,     // full manifest per-batch (existing)
  getCombinedDeliverySheet,     // full manifest combined (new)
  getDeliverySheetsByVessel,    // vessel-level (legacy)
};
