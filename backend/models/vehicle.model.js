const httpStatus = require('http-status');
const { query } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');

const createVehicle = async (body, creatorId) => {
  const {
    manifest_id, chassis_number, engine_number = null,
    brand = null, model = null, year = null, color = null,
    customer_name = null, destination = null,
    release_status = 'unreleased', operational_status = 'pending', notes = null,
  } = body;

  const existing = await query(
    'SELECT vehicle_id FROM vehicles WHERE chassis_number=?', [chassis_number]
  );
  if (existing.length) throw new ApiError(httpStatus.CONFLICT, 'Chassis number already exists');

  const [r] = await query(
    `INSERT INTO vehicles (manifest_id, chassis_number, engine_number, brand, model,
      year, color, customer_name, destination, release_status, operational_status, notes, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [manifest_id, chassis_number, engine_number, brand, model,
     year, color, customer_name, destination, release_status, operational_status, notes, creatorId]
  );
  return getVehicleById(r.insertId);
};

const getVehicles = async ({ page, limit, manifest_id, vessel_id, release_status, operational_status, search, brand }) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  let where = '1=1';
  const params = [];
  if (manifest_id)        { where += ' AND vh.manifest_id=?';         params.push(manifest_id); }
  if (vessel_id)          { where += ' AND m.vessel_id=?';            params.push(vessel_id); }
  if (release_status)     { where += ' AND vh.release_status=?';      params.push(release_status); }
  if (operational_status) { where += ' AND vh.operational_status=?';  params.push(operational_status); }
  if (brand)              { where += ' AND vh.brand=?';               params.push(brand); }
  if (search) {
    where += ` AND (vh.chassis_number LIKE ? OR vh.engine_number LIKE ?
      OR vh.customer_name LIKE ? OR vh.brand LIKE ? OR vh.model LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s, s);
  }
  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM vehicles vh
     LEFT JOIN manifests m ON m.manifest_id = vh.manifest_id
     WHERE ${where}`, params
  );
  const vehicles = await query(
    `SELECT vh.*,
       m.manifest_number, m.arrival_date AS manifest_arrival_date,
       v.name AS vessel_name, v.vessel_id,
       u.full_name AS created_by_name
     FROM vehicles vh
     LEFT JOIN manifests m ON m.manifest_id = vh.manifest_id
     LEFT JOIN vessels v ON v.vessel_id = m.vessel_id
     LEFT JOIN users u ON u.user_id = vh.created_by
     WHERE ${where}
     ORDER BY vh.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );
  return paginate(vehicles, total);
};

const getVehicleById = async (id) => {
  const [vehicle] = await query(
    `SELECT vh.*,
       m.manifest_number, m.arrival_date AS manifest_arrival_date,
       v.name AS vessel_name, v.vessel_id, v.shipping_line,
       u.full_name AS created_by_name
     FROM vehicles vh
     LEFT JOIN manifests m ON m.manifest_id = vh.manifest_id
     LEFT JOIN vessels v ON v.vessel_id = m.vessel_id
     LEFT JOIN users u ON u.user_id = vh.created_by
     WHERE vh.vehicle_id=?`,
    [id]
  );
  if (!vehicle) throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');
  return vehicle;
};

const getVehicleByChassis = async (chassisNumber) => {
  const [vehicle] = await query(
    `SELECT vh.*,
       m.manifest_number, m.arrival_date,
       v.name AS vessel_name, v.vessel_id
     FROM vehicles vh
     LEFT JOIN manifests m ON m.manifest_id = vh.manifest_id
     LEFT JOIN vessels v ON v.vessel_id = m.vessel_id
     WHERE vh.chassis_number=?`,
    [chassisNumber]
  );
  if (!vehicle) throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');
  return vehicle;
};

const updateVehicle = async (id, body, updaterId) => {
  await getVehicleById(id);
  const fields = [];
  const params = [];
  const allowed = ['manifest_id','engine_number','brand','model','year','color',
    'customer_name','destination','release_status','operational_status','notes'];
  for (const key of allowed) {
    if (body[key] !== undefined) { fields.push(`${key}=?`); params.push(body[key]); }
  }
  if (!fields.length) return getVehicleById(id);
  fields.push('updated_by=?', 'updated_at=NOW()');
  params.push(updaterId, id);
  await query(`UPDATE vehicles SET ${fields.join(',')} WHERE vehicle_id=?`, params);
  return getVehicleById(id);
};

const deleteVehicle = async (id) => {
  const vehicle = await getVehicleById(id);
  // Check no active operations
  const ops = await query(
    "SELECT COUNT(*) AS cnt FROM operations WHERE vehicle_id=? AND status NOT IN ('completed','cancelled')", [id]
  );
  if (ops[0].cnt > 0) throw new ApiError(httpStatus.BAD_REQUEST,
    'Cannot delete vehicle with active operations');
  await query('DELETE FROM vehicles WHERE vehicle_id=?', [id]);
  return vehicle;
};

const getVehicleOperations = async (id) => {
  return query(
    `SELECT op.*,
       d.full_name AS driver_name, d.license_number,
       u.full_name AS created_by_name
     FROM operations op
     LEFT JOIN drivers d ON d.driver_id = op.driver_id
     LEFT JOIN users u ON u.user_id = op.created_by
     WHERE op.vehicle_id=?
     ORDER BY op.created_at DESC`,
    [id]
  );
};

module.exports = { createVehicle, getVehicles, getVehicleById, getVehicleByChassis, updateVehicle, deleteVehicle, getVehicleOperations };
