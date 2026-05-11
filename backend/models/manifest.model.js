const httpStatus = require('http-status');
const { query, transaction } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');

// Auto-generate manifest number: ICDV-MAN-YYYY-NNNN (scoped per tenant)
const generateManifestNumber = async (icdvId = null) => {
  const year   = new Date().getFullYear();
  const prefix = `ICDV-MAN-${year}-`;
  // Scope the sequence to the tenant so numbers don't clash across ICDVs
  const whereIcdv = icdvId ? ' AND icdv_id=?' : '';
  const p = icdvId ? [`${prefix}%`, icdvId] : [`${prefix}%`];
  const [{ last }] = await query(
    `SELECT MAX(CAST(SUBSTRING_INDEX(manifest_number, '-', -1) AS UNSIGNED)) AS last
     FROM manifests WHERE manifest_number LIKE ?${whereIcdv}`,
    p
  );
  return `${prefix}${String((last || 0) + 1).padStart(4, '0')}`;
};

const createManifest = async (body, creatorId, icdvId) => {
  if (!icdvId) throw new ApiError(httpStatus.BAD_REQUEST, 'icdv_id is required');
  const { vessel_id, arrival_date, notes = null, status = 'pending' } = body;
  const manifest_number = await generateManifestNumber(icdvId);
  const r = await query(
    `INSERT INTO manifests (icdv_id, manifest_number, vessel_id, arrival_date, notes, status, created_by)
     VALUES (?,?,?,?,?,?,?)`,
    [icdvId, manifest_number, vessel_id, arrival_date, notes, status, creatorId]
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
    `SELECT COUNT(*) AS total FROM manifests m LEFT JOIN vessels v ON v.vessel_id=m.vessel_id WHERE ${where}`, params
  );
  const manifests = await query(
    `SELECT m.*,
       v.name AS vessel_name, v.imo_number, v.vessel_type,
       (SELECT COUNT(*) FROM vehicles vh WHERE vh.manifest_id=m.manifest_id) AS total_vehicles,
       (SELECT COUNT(*) FROM vehicles vh WHERE vh.manifest_id=m.manifest_id AND vh.release_status='released') AS released_vehicles,
       (SELECT COUNT(*) FROM vehicles vh WHERE vh.manifest_id=m.manifest_id AND vh.operational_status='delivered') AS delivered_vehicles,
       u.full_name AS created_by_name
     FROM manifests m
     LEFT JOIN vessels v ON v.vessel_id=m.vessel_id
     LEFT JOIN users u ON u.user_id=m.created_by
     WHERE ${where} ORDER BY m.created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );
  return paginate(manifests, total);
};

const getManifestById = async (id, icdvId = null) => {
  const [manifest] = await query(
    `SELECT m.*,
       v.name AS vessel_name, v.imo_number, v.vessel_type, v.country_of_origin,
       (SELECT COUNT(*) FROM vehicles vh WHERE vh.manifest_id=m.manifest_id) AS total_vehicles,
       (SELECT COUNT(*) FROM vehicles vh WHERE vh.manifest_id=m.manifest_id AND vh.release_status='released') AS released_vehicles,
       (SELECT COUNT(*) FROM vehicles vh WHERE vh.manifest_id=m.manifest_id AND vh.operational_status='delivered') AS delivered_vehicles,
       u.full_name AS created_by_name
     FROM manifests m
     LEFT JOIN vessels v ON v.vessel_id=m.vessel_id
     LEFT JOIN users u ON u.user_id=m.created_by
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
  const allowed = ['vessel_id','arrival_date','notes','status'];
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

// CSV import — scopes chassis uniqueness to the tenant
const importVehicles = async (manifestId, rows, creatorId, icdvId = null) => {
  await getManifestById(manifestId, icdvId);
  return transaction(async (conn) => {
    const results = { total: rows.length, imported: 0, failed: 0, duplicates: [], errors: [] };
    for (const row of rows) {
      const chassis = (row.chassis_no || '').trim();
      if (!chassis) {
        results.failed++;
        results.errors.push({ row: row._rowNum, error: 'Missing chassis number' });
        continue;
      }
      // Uniqueness scoped to tenant (not global)
      const whereScope = icdvId ? ' AND icdv_id=?' : '';
      const scopeP     = icdvId ? [chassis, icdvId] : [chassis];
      const [existing] = await conn.query(
        `SELECT vehicle_id FROM vehicles WHERE chassis_number=?${whereScope}`, scopeP
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
             (icdv_id, manifest_id, chassis_number, bill_of_lading_no, destination, delivery_location,
              release_status, operational_status, created_by)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [
            icdvId || 1,
            manifestId,
            chassis,
            (row.bill_of_lading_no  || '').trim() || null,
            (row.destination        || '').trim() || null,
            (row.delivery_location  || '').trim() || null,
            'unreleased', 'pending', creatorId,
          ]
        );
        results.imported++;
      } catch (err) {
        results.failed++;
        results.errors.push({ row: row._rowNum, chassis, error: err.message });
      }
    }
    await conn.query('UPDATE manifests SET updated_at=NOW() WHERE manifest_id=?', [manifestId]);
    return results;
  });
};

module.exports = {
  createManifest, getManifests, getManifestById,
  updateManifest, deleteManifest, importVehicles, generateManifestNumber,
};
