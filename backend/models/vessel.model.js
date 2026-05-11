const httpStatus = require('http-status');
const { query } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');
const { VESSEL_STATUS_TRANSITIONS } = require('../config/statuses');

const createVessel = async (body, creatorId) => {
  const {
    name, imo_number = null, vessel_type = null,
    country_of_origin = null, notes = null, status = 'active',
  } = body;
  const r = await query(
    `INSERT INTO vessels (name, imo_number, vessel_type, country_of_origin, notes, status, created_by)
     VALUES (?,?,?,?,?,?,?)`,
    [name, imo_number, vessel_type, country_of_origin, notes, status, creatorId]
  );
  return getVesselById(r.insertId);
};

const getVessels = async ({ page, limit, status, search }) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  let where = '1=1';
  const params = [];
  if (status) { where += ' AND v.status=?'; params.push(status); }
  if (search) {
    where += ' AND (v.name LIKE ? OR v.imo_number LIKE ? OR v.vessel_type LIKE ? OR v.country_of_origin LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM vessels v WHERE ${where}`, params
  );
  const vessels = await query(
    `SELECT v.*,
       (SELECT COUNT(*) FROM manifests m WHERE m.vessel_id = v.vessel_id) AS manifest_count,
       (SELECT COUNT(*) FROM manifests m
        JOIN vehicles vh ON vh.manifest_id = m.manifest_id
        WHERE m.vessel_id = v.vessel_id) AS vehicle_count,
       u.full_name AS created_by_name
     FROM vessels v
     LEFT JOIN users u ON u.user_id = v.created_by
     WHERE ${where}
     ORDER BY v.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );
  return paginate(vessels, total);
};

const getVesselById = async (id) => {
  const [vessel] = await query(
    `SELECT v.*,
       (SELECT COUNT(*) FROM manifests m WHERE m.vessel_id = v.vessel_id) AS manifest_count,
       (SELECT COUNT(*) FROM manifests m
        JOIN vehicles vh ON vh.manifest_id = m.manifest_id
        WHERE m.vessel_id = v.vessel_id) AS vehicle_count,
       u.full_name AS created_by_name
     FROM vessels v
     LEFT JOIN users u ON u.user_id = v.created_by
     WHERE v.vessel_id=?`,
    [id]
  );
  if (!vessel) throw new ApiError(httpStatus.NOT_FOUND, 'Vessel not found');
  return vessel;
};

const updateVessel = async (id, body, updaterId) => {
  await getVesselById(id);
  const fields = [];
  const params = [];
  const allowed = ['name','imo_number','vessel_type','country_of_origin','notes','status'];
  for (const key of allowed) {
    if (body[key] !== undefined) { fields.push(`${key}=?`); params.push(body[key]); }
  }
  if (!fields.length) return getVesselById(id);
  fields.push('updated_by=?', 'updated_at=NOW()');
  params.push(updaterId, id);
  await query(`UPDATE vessels SET ${fields.join(',')} WHERE vessel_id=?`, params);
  return getVesselById(id);
};

const updateVesselStatus = async (id, newStatus, userId) => {
  const vessel = await getVesselById(id);
  const allowed = VESSEL_STATUS_TRANSITIONS[vessel.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new ApiError(httpStatus.BAD_REQUEST,
      `Cannot transition from '${vessel.status}' to '${newStatus}'`);
  }
  await query(`UPDATE vessels SET status=?, updated_by=?, updated_at=NOW() WHERE vessel_id=?`,
    [newStatus, userId, id]);
  return getVesselById(id);
};

const deleteVessel = async (id) => {
  const vessel = await getVesselById(id);
  const [{ cnt }] = await query('SELECT COUNT(*) AS cnt FROM manifests WHERE vessel_id=?', [id]);
  if (cnt > 0) throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot delete vessel with existing manifests');
  await query('DELETE FROM vessels WHERE vessel_id=?', [id]);
  return vessel;
};

module.exports = { createVessel, getVessels, getVesselById, updateVessel, updateVesselStatus, deleteVessel };
