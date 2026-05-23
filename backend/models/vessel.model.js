// Live DB vessels schema:
//   vessel_id, icdv_id, name, imo_number, notes,
//   status ENUM('active','inactive','decommissioned','expected','arrived','processing','completed','departed'),
//   created_by, updated_by, created_at, updated_at,
//   vessel_type, country_of_origin,                  ← already in live DB
//   flag, shipping_line, arrival_date, departure_date, berth_number, port_of_origin  ← added by migration 009

const httpStatus = require('http-status');
const { query }  = require('../config/database');
const ApiError   = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');

const VESSEL_STATUSES = [
  'active', 'inactive', 'decommissioned',
  'expected', 'arrived', 'processing', 'completed', 'departed',
];

// ── Create ────────────────────────────────────────────────────────────────────
const createVessel = async (body, creatorId, icdvId) => {
  const {
    name,
    imo_number        = null,
    vessel_type       = null,
    country_of_origin = null,
    flag              = null,
    shipping_line     = null,
    arrival_date      = null,
    departure_date    = null,
    berth_number      = null,
    port_of_origin    = null,
    notes             = null,
    status            = 'expected',
  } = body;

  if (!name) throw new ApiError(httpStatus.BAD_REQUEST, 'Vessel name is required');
  if (!VESSEL_STATUSES.includes(status))
    throw new ApiError(httpStatus.BAD_REQUEST, `Invalid status. Allowed: ${VESSEL_STATUSES.join(', ')}`);

  const effectiveIcdvId = icdvId ?? (body.icdv_id ? Number(body.icdv_id) : null);
  if (!effectiveIcdvId)
    throw new ApiError(httpStatus.BAD_REQUEST, 'icdv_id is required. Select an ICDV to create this vessel under.');

  const r = await query(
    `INSERT INTO vessels
       (icdv_id, name, imo_number, vessel_type, country_of_origin,
        flag, shipping_line, arrival_date, departure_date,
        berth_number, port_of_origin, notes, status, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      effectiveIcdvId, name, imo_number, vessel_type, country_of_origin,
      flag, shipping_line, arrival_date, departure_date,
      berth_number, port_of_origin, notes, status, creatorId,
    ]
  );
  return getVesselById(r.insertId, effectiveIcdvId);
};

// ── List ──────────────────────────────────────────────────────────────────────
const getVessels = async ({ page, limit, status, search } = {}, icdvId = null) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  let where = '1=1'; const params = [];

  if (icdvId !== null) { where += ' AND v.icdv_id=?'; params.push(icdvId); }
  if (status)          { where += ' AND v.status=?';  params.push(status); }
  if (search) {
    where += ` AND (v.name LIKE ? OR v.imo_number LIKE ? OR v.vessel_type LIKE ?
               OR v.country_of_origin LIKE ? OR v.flag LIKE ?
               OR v.shipping_line LIKE ? OR v.port_of_origin LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s, s, s, s);
  }

  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM vessels v WHERE ${where}`,
    params
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
     WHERE ${where} ORDER BY v.created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );
  return paginate(vessels, total);
};

// ── Get by ID ─────────────────────────────────────────────────────────────────
const getVesselById = async (id, icdvId = null) => {
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
  if (icdvId !== null && vessel.icdv_id !== icdvId)
    throw new ApiError(httpStatus.NOT_FOUND, 'Vessel not found');
  return vessel;
};

// ── Update ────────────────────────────────────────────────────────────────────
const updateVessel = async (id, body, updaterId, icdvId = null) => {
  await getVesselById(id, icdvId);

  const fields = []; const params = [];
  const allowed = [
    'name', 'imo_number', 'vessel_type', 'country_of_origin',
    'flag', 'shipping_line', 'arrival_date', 'departure_date',
    'berth_number', 'port_of_origin', 'notes', 'status',
  ];

  for (const key of allowed) {
    if (body[key] !== undefined) {
      if (key === 'status' && !VESSEL_STATUSES.includes(body[key]))
        throw new ApiError(httpStatus.BAD_REQUEST, `Invalid status. Allowed: ${VESSEL_STATUSES.join(', ')}`);
      fields.push(`${key}=?`);
      params.push(body[key]);
    }
  }

  if (!fields.length) return getVesselById(id, icdvId);

  fields.push('updated_by=?', 'updated_at=NOW()');
  params.push(updaterId, id);
  await query(`UPDATE vessels SET ${fields.join(',')} WHERE vessel_id=?`, params);
  return getVesselById(id, icdvId);
};

// ── Update status only ────────────────────────────────────────────────────────
const updateVesselStatus = async (id, newStatus, userId, icdvId = null) => {
  await getVesselById(id, icdvId);
  if (!VESSEL_STATUSES.includes(newStatus))
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Invalid status '${newStatus}'. Allowed: ${VESSEL_STATUSES.join(', ')}`
    );
  await query(
    `UPDATE vessels SET status=?, updated_by=?, updated_at=NOW() WHERE vessel_id=?`,
    [newStatus, userId, id]
  );
  return getVesselById(id, icdvId);
};

// ── Delete ────────────────────────────────────────────────────────────────────
const deleteVessel = async (id, icdvId = null) => {
  const vessel = await getVesselById(id, icdvId);
  const [{ cnt }] = await query(
    'SELECT COUNT(*) AS cnt FROM manifests WHERE vessel_id=?', [id]
  );
  if (cnt > 0)
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot delete vessel with existing manifests');
  await query('DELETE FROM vessels WHERE vessel_id=?', [id]);
  return vessel;
};

module.exports = {
  createVessel, getVessels, getVesselById,
  updateVessel, updateVesselStatus, deleteVessel,
};
