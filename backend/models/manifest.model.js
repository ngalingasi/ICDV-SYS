const httpStatus = require('http-status');
const { query, transaction } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');

const createManifest = async (body, creatorId) => {
  const {
    manifest_number, vessel_id, arrival_date, notes = null, status = 'pending',
  } = body;

  // Check manifest number uniqueness
  const existing = await query(
    'SELECT manifest_id FROM manifests WHERE manifest_number=?', [manifest_number]
  );
  if (existing.length) throw new ApiError(httpStatus.CONFLICT, 'Manifest number already exists');

  const [r] = await query(
    `INSERT INTO manifests (manifest_number, vessel_id, arrival_date, notes, status, created_by)
     VALUES (?,?,?,?,?,?)`,
    [manifest_number, vessel_id, arrival_date, notes, status, creatorId]
  );
  return getManifestById(r.insertId);
};

const getManifests = async ({ page, limit, vessel_id, status, search }) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  let where = '1=1';
  const params = [];
  if (vessel_id) { where += ' AND m.vessel_id=?'; params.push(vessel_id); }
  if (status)    { where += ' AND m.status=?';    params.push(status); }
  if (search) {
    where += ' AND (m.manifest_number LIKE ? OR v.name LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s);
  }
  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM manifests m
     LEFT JOIN vessels v ON v.vessel_id = m.vessel_id
     WHERE ${where}`, params
  );
  const manifests = await query(
    `SELECT m.*,
       v.name AS vessel_name,
       v.arrival_date AS vessel_arrival_date,
       (SELECT COUNT(*) FROM vehicles vh WHERE vh.manifest_id = m.manifest_id) AS total_vehicles,
       (SELECT COUNT(*) FROM vehicles vh WHERE vh.manifest_id = m.manifest_id AND vh.release_status='released') AS released_vehicles,
       (SELECT COUNT(*) FROM vehicles vh WHERE vh.manifest_id = m.manifest_id AND vh.operational_status='delivered') AS delivered_vehicles,
       u.full_name AS created_by_name
     FROM manifests m
     LEFT JOIN vessels v ON v.vessel_id = m.vessel_id
     LEFT JOIN users u ON u.user_id = m.created_by
     WHERE ${where}
     ORDER BY m.arrival_date DESC, m.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );
  return paginate(manifests, total);
};

const getManifestById = async (id) => {
  const [manifest] = await query(
    `SELECT m.*,
       v.name AS vessel_name, v.imo_number, v.shipping_line,
       (SELECT COUNT(*) FROM vehicles vh WHERE vh.manifest_id = m.manifest_id) AS total_vehicles,
       (SELECT COUNT(*) FROM vehicles vh WHERE vh.manifest_id = m.manifest_id AND vh.release_status='released') AS released_vehicles,
       (SELECT COUNT(*) FROM vehicles vh WHERE vh.manifest_id = m.manifest_id AND vh.operational_status='delivered') AS delivered_vehicles,
       u.full_name AS created_by_name
     FROM manifests m
     LEFT JOIN vessels v ON v.vessel_id = m.vessel_id
     LEFT JOIN users u ON u.user_id = m.created_by
     WHERE m.manifest_id=?`,
    [id]
  );
  if (!manifest) throw new ApiError(httpStatus.NOT_FOUND, 'Manifest not found');
  return manifest;
};

const updateManifest = async (id, body, updaterId) => {
  await getManifestById(id);
  const fields = [];
  const params = [];
  const allowed = ['manifest_number','vessel_id','arrival_date','notes','status'];
  for (const key of allowed) {
    if (body[key] !== undefined) { fields.push(`${key}=?`); params.push(body[key]); }
  }
  if (!fields.length) return getManifestById(id);
  fields.push('updated_by=?', 'updated_at=NOW()');
  params.push(updaterId, id);
  await query(`UPDATE manifests SET ${fields.join(',')} WHERE manifest_id=?`, params);
  return getManifestById(id);
};

const deleteManifest = async (id) => {
  const manifest = await getManifestById(id);
  const [{ cnt }] = await query(
    'SELECT COUNT(*) AS cnt FROM vehicles WHERE manifest_id=?', [id]
  );
  if (cnt > 0) throw new ApiError(httpStatus.BAD_REQUEST,
    'Cannot delete manifest with existing vehicles');
  await query('DELETE FROM manifests WHERE manifest_id=?', [id]);
  return manifest;
};

// Bulk import vehicles into a manifest
const importVehicles = async (manifestId, vehicles, creatorId) => {
  await getManifestById(manifestId);
  return transaction(async (conn) => {
    const results = { created: 0, skipped: 0, errors: [] };
    for (const v of vehicles) {
      try {
        const existing = await conn.query(
          'SELECT vehicle_id FROM vehicles WHERE chassis_number=?', [v.chassis_number]
        );
        if (existing[0].length > 0) {
          results.skipped++;
          results.errors.push(`${v.chassis_number}: already exists`);
          continue;
        }
        await conn.query(
          `INSERT INTO vehicles (manifest_id, chassis_number, engine_number, brand, model,
            year, color, customer_name, destination, release_status, operational_status, created_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          [manifestId, v.chassis_number, v.engine_number || null, v.brand || null,
           v.model || null, v.year || null, v.color || null, v.customer_name || null,
           v.destination || null, 'unreleased', 'pending', creatorId]
        );
        results.created++;
      } catch (err) {
        results.errors.push(`${v.chassis_number}: ${err.message}`);
      }
    }
    // Update manifest total vehicle count
    await conn.query(
      'UPDATE manifests SET updated_at=NOW() WHERE manifest_id=?', [manifestId]
    );
    return results;
  });
};

module.exports = { createManifest, getManifests, getManifestById, updateManifest, deleteManifest, importVehicles };
