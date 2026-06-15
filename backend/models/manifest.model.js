const httpStatus = require('http-status');
const { query, transaction, connQuery } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');
const { getTransferRate } = require('./lookup.model');

/*const generateManifestNumber = async (icdvId = null) => {
  const year   = new Date().getFullYear();
  const prefix = `ICDV-MAN-${year}-`;
  const whereIcdv = icdvId ? ' AND icdv_id=?' : '';
  const p = icdvId ? [`${prefix}%`, icdvId] : [`${prefix}%`];
  const [{ last }] = await query(
    `SELECT MAX(CAST(SUBSTRING_INDEX(manifest_number, '-', -1) AS UNSIGNED)) AS last
     FROM manifests WHERE manifest_number LIKE ?${whereIcdv}`,
    p
  );
  return `${prefix}${String((last || 0) + 1).padStart(4, '0')}`;
};
*/

const generateManifestNumber = async (icdvId) => {
  const year = new Date().getFullYear();

  // Get the ICDV code
  const [icdv] = await query(`SELECT code FROM icdvs WHERE icdv_id=?`, [icdvId]);
  if (!icdv) throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid icdv_id');

  const prefix = `${icdv.code}-MAN-${year}-`;

  const [{ last }] = await query(
    `SELECT MAX(CAST(SUBSTRING_INDEX(manifest_number, '-', -1) AS UNSIGNED)) AS last
     FROM manifests WHERE manifest_number LIKE ? AND icdv_id=?`,
    [`${prefix}%`, icdvId]
  );

  return `${prefix}${String((last || 0) + 1).padStart(4, '0')}`;
};

const createManifest = async (body, creatorId, icdvId) => {
  if (!icdvId) throw new ApiError(httpStatus.BAD_REQUEST, 'icdv_id is required');
  const { vessel_id, arrival_date, notes = null, status = 'pending' } = body;
  const manifest_number = await generateManifestNumber(icdvId);
  // Seed transfer_rate: use body override if provided, otherwise pull global default
  const globalRate = await getTransferRate();
  const transfer_rate = body.transfer_rate !== undefined ? parseFloat(body.transfer_rate) : globalRate;
  const r = await query(
    `INSERT INTO manifests (icdv_id, manifest_number, vessel_id, arrival_date, notes, status, transfer_rate, created_by)
     VALUES (?,?,?,?,?,?,?,?)`,
    [icdvId, manifest_number, vessel_id, arrival_date, notes, status, transfer_rate, creatorId]
  );
  return getManifestById(r.insertId, icdvId);
};

const getManifests = async ({ page, limit, vessel_id, status, search }, icdvId = null) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  let where = '1=1'; const params = [];
  if (icdvId !== null) { where += ' AND m.icdv_id=?'; params.push(icdvId); }
  if (vessel_id) { where += ' AND m.vessel_id=?'; params.push(vessel_id); }
  if (status)    { where += ' AND m.status=?';    params.push(status); }
  if (search) {
    where += ' AND (m.manifest_number LIKE ? OR v.name LIKE ?)';
    const s = `%${search}%`; params.push(s, s);
  }

  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM manifests m
     LEFT JOIN vessels v ON v.vessel_id=m.vessel_id
     WHERE ${where}`, params
  );

  const manifests = await query(
    `SELECT m.*,
       v.name AS vessel_name, v.imo_number, v.vessel_type,
       -- Workflow step counts (from synced columns — fast, no subquery)
       COALESCE(m.manifested_count, 0) AS manifested_count,
       COALESCE(m.discharged_count, 0) AS discharged_count,
       COALESCE(m.batched_count,    0) AS batched_count,
       COALESCE(m.in_transit_count, 0) AS in_transit_count,
       COALESCE(m.received_count,   0) AS received_count,
       -- Total and legacy counts (live subqueries for accuracy)
       (SELECT COUNT(*) FROM vehicles vh WHERE vh.manifest_id=m.manifest_id) AS total_vehicles,
       (SELECT COUNT(*) FROM vehicles vh
        WHERE vh.manifest_id=m.manifest_id AND vh.release_status IN ('released','collected')) AS released_vehicles,
       (SELECT COUNT(*) FROM vehicles vh
        WHERE vh.manifest_id=m.manifest_id AND vh.workflow_status='received') AS delivered_vehicles,
       u.full_name AS created_by_name
     FROM manifests m
     LEFT JOIN vessels v ON v.vessel_id=m.vessel_id
     LEFT JOIN users u   ON u.user_id  =m.created_by
     WHERE ${where}
     ORDER BY m.created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );
  return paginate(manifests, total);
};

const getManifestById = async (id, icdvId = null) => {
  const [manifest] = await query(
    `SELECT m.*,
       v.name AS vessel_name, v.imo_number, v.vessel_type, v.country_of_origin,
       COALESCE(m.manifested_count, 0) AS manifested_count,
       COALESCE(m.discharged_count, 0) AS discharged_count,
       COALESCE(m.batched_count,    0) AS batched_count,
       COALESCE(m.in_transit_count, 0) AS in_transit_count,
       COALESCE(m.received_count,   0) AS received_count,
       (SELECT COUNT(*) FROM vehicles vh WHERE vh.manifest_id=m.manifest_id) AS total_vehicles,
       (SELECT COUNT(*) FROM vehicles vh
        WHERE vh.manifest_id=m.manifest_id AND vh.release_status IN ('released','collected')) AS released_vehicles,
       (SELECT COUNT(*) FROM vehicles vh
        WHERE vh.manifest_id=m.manifest_id AND vh.workflow_status='received') AS delivered_vehicles,
       u.full_name AS created_by_name
     FROM manifests m
     LEFT JOIN vessels v ON v.vessel_id=m.vessel_id
     LEFT JOIN users u   ON u.user_id  =m.created_by
     WHERE m.manifest_id=?`,
    [id]
  );
  if (!manifest) throw new ApiError(httpStatus.NOT_FOUND, 'Manifest not found');
  if (icdvId !== null && manifest.icdv_id !== icdvId)
    throw new ApiError(httpStatus.NOT_FOUND, 'Manifest not found');
  return manifest;
};

const updateManifest = async (id, body, updaterId, icdvId = null) => {
  await getManifestById(id, icdvId);
  const fields = []; const params = [];
  const allowed = ['vessel_id', 'arrival_date', 'notes', 'status', 'transfer_rate'];
  for (const key of allowed) {
    if (body[key] !== undefined) { fields.push(`${key}=?`); params.push(body[key]); }
  }
  if (!fields.length) return getManifestById(id, icdvId);
  fields.push('updated_by=?', 'updated_at=NOW()');
  params.push(updaterId, id);
  await query(`UPDATE manifests SET ${fields.join(',')} WHERE manifest_id=?`, params);
  return getManifestById(id, icdvId);
};

const deleteManifest = async (id, icdvId = null) => {
  const manifest = await getManifestById(id, icdvId);
  const [{ cnt }] = await query('SELECT COUNT(*) AS cnt FROM vehicles WHERE manifest_id=?', [id]);
  if (cnt > 0) throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot delete manifest with existing vehicles');
  await query('DELETE FROM manifests WHERE manifest_id=?', [id]);
  return manifest;
};

/**
 * CSV import — now sets workflow_status='manifested' and current_location='vessel'
 * so every imported vehicle starts the workflow correctly.
 */
const importVehicles = async (manifestId, rows, creatorId, icdvId = null) => {
  // Always fetch the manifest first — this validates ownership (throws 404/403 on mismatch)
  // and gives us the authoritative icdv_id regardless of what the caller passed.
  const manifest = await getManifestById(manifestId, icdvId);
  // Use the manifest's own icdv_id as the ground truth for every INSERT below.
  // This eliminates the `icdvId || 1` fallback that pinned vehicles to ICDV #1
  // when req.icdvId was null (e.g. super_admin without an explicit icdv_id param).
  const effectiveIcdvId = manifest.icdv_id;

  return transaction(async (conn) => {
    const results = { total: rows.length, imported: 0, failed: 0, duplicates: [], errors: [] };

    for (const row of rows) {
      const chassis = (row.chassis_no || '').trim();
      if (!chassis) {
        results.failed++;
        results.errors.push({ row: row._rowNum, error: 'Missing chassis number' });
        continue;
      }

      // Scope duplicate check to this ICDV using the manifest's authoritative icdv_id
      const [existing] = await conn.query(
        `SELECT vehicle_id FROM vehicles WHERE chassis_number=? AND icdv_id=?`,
        [chassis, effectiveIcdvId]
      );

      if (existing.length > 0) {
        results.failed++;
        results.duplicates.push(chassis);
        results.errors.push({ row: row._rowNum, chassis, error: 'Chassis number already exists' });
        continue;
      }

      try {
        await conn.query(
          `INSERT INTO vehicles
             (icdv_id, manifest_id, chassis_number, bill_of_lading_no,
              destination, delivery_location,
              vessel_visit, marks_and_numbers,
              manifest_driver_license, manifest_driver_name, manifest_driver_contact,
              quantity, weight_kg, volume_cbm,
              reference_no, self_driven, truck_no, transport_company,
              declaration_no, trip_no, terminal_gate_no,
              release_status, operational_status,
              workflow_status, current_location,
              created_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'unreleased','pending', 'manifested','vessel', ?)`,
          [
            effectiveIcdvId,
            manifestId,
            chassis,
            (row.bill_of_lading_no          || '').trim() || null,
            (row.destination                || '').trim() || null,
            (row.delivery_location          || '').trim() || null,
            (row.vessel_visit               || '').trim() || null,
            (row.marks_and_numbers          || '').trim() || null,
            (row.manifest_driver_license    || '').trim() || null,
            (row.manifest_driver_name       || '').trim() || null,
            (row.manifest_driver_contact    || '').trim() || null,
            row.quantity     ? (parseFloat(row.quantity)  || null) : null,
            row.weight_kg    ? (parseFloat(row.weight_kg) || null) : null,
            row.volume_cbm   ? (parseFloat(row.volume_cbm)|| null) : null,
            (row.reference_no               || '').trim() || null,
            (row.self_driven                || '').trim() || null,
            (row.truck_no                   || '').trim() || null,
            (row.transport_company          || '').trim() || null,
            (row.declaration_no             || '').trim() || null,
            (row.trip_no                    || '').trim() || null,
            (row.terminal_gate_no           || '').trim() || null,
            creatorId,
          ]
        );
        results.imported++;
      } catch (err) {
        results.failed++;
        results.errors.push({ row: row._rowNum, chassis, error: err.message });
      }
    }

    // Re-sync manifest counts after bulk import
    await conn.query(
      `UPDATE manifests
       SET manifested_count = (SELECT COUNT(*) FROM vehicles v WHERE v.manifest_id=? AND v.workflow_status='manifested'),
           status           = CASE WHEN status='cancelled' THEN 'cancelled' ELSE 'active' END,
           updated_at       = NOW()
       WHERE manifest_id=?`,
      [manifestId, manifestId]
    );

    return results;
  });
};

module.exports = {
  createManifest, getManifests, getManifestById,
  updateManifest, deleteManifest, importVehicles, generateManifestNumber,
};
