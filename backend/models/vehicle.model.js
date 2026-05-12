const httpStatus = require('http-status');
const { query } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');

// Full column set including all workflow + status fields
const SELECT_COLS = `
  v.*,
  m.manifest_number, m.arrival_date AS manifest_arrival_date, m.status AS manifest_status,
  vs.name AS vessel_name, vs.vessel_id AS vessel_vessel_id,
  u.full_name AS created_by_name`;

const FROM_JOINS = `
  FROM vehicles v
  LEFT JOIN manifests m ON m.manifest_id = v.manifest_id
  LEFT JOIN vessels vs  ON vs.vessel_id  = m.vessel_id
  LEFT JOIN users u     ON u.user_id     = v.created_by`;

const createVehicle = async (body, creatorId, icdvId) => {
  const {
    manifest_id, chassis_number, engine_number = null,
    brand = null, model = null, year = null, color = null,
    customer_name = null, destination = null, delivery_location = null,
    bill_of_lading_no = null, notes = null,
    release_status     = 'unreleased',
    operational_status = 'pending',
    workflow_status    = 'manifested',
    current_location   = 'vessel',
  } = body;
  if (!icdvId) throw new ApiError(httpStatus.BAD_REQUEST, 'icdv_id is required');

  const r = await query(
    `INSERT INTO vehicles
       (icdv_id, manifest_id, chassis_number, engine_number, brand, model, year, color,
        customer_name, destination, delivery_location, bill_of_lading_no,
        release_status, operational_status, workflow_status, current_location,
        notes, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [icdvId, manifest_id, chassis_number, engine_number, brand, model, year, color,
     customer_name, destination, delivery_location, bill_of_lading_no,
     release_status, operational_status, workflow_status, current_location,
     notes, creatorId]
  );
  return getVehicleById(r.insertId, icdvId);
};

const getVehicles = async (
  { page, limit, manifest_id, release_status, operational_status, workflow_status, search },
  icdvId = null
) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  let where = '1=1'; const params = [];
  if (icdvId !== null)    { where += ' AND v.icdv_id=?';            params.push(icdvId); }
  if (manifest_id)        { where += ' AND v.manifest_id=?';         params.push(manifest_id); }
  if (release_status)     { where += ' AND v.release_status=?';      params.push(release_status); }
  if (operational_status) { where += ' AND v.operational_status=?';  params.push(operational_status); }
  if (workflow_status)    { where += ' AND v.workflow_status=?';      params.push(workflow_status); }
  if (search) {
    where += ` AND (v.chassis_number LIKE ? OR v.brand LIKE ? OR v.model LIKE ?
                    OR v.customer_name LIKE ? OR v.bill_of_lading_no LIKE ?)`;
    const s = `%${search}%`; params.push(s, s, s, s, s);
  }
  const [{ total }] = await query(
    `SELECT COUNT(*) AS total ${FROM_JOINS} WHERE ${where}`, params
  );
  const vehicles = await query(
    `SELECT ${SELECT_COLS} ${FROM_JOINS} WHERE ${where} ORDER BY v.created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );
  return paginate(vehicles, total);
};

const getVehicleById = async (id, icdvId = null) => {
  const [vehicle] = await query(
    `SELECT ${SELECT_COLS} ${FROM_JOINS} WHERE v.vehicle_id=?`, [id]
  );
  if (!vehicle) throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');
  if (icdvId !== null && vehicle.icdv_id !== icdvId)
    throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');
  return vehicle;
};

const getVehicleByChassis = async (chassisNumber, icdvId = null) => {
  let sql = `SELECT ${SELECT_COLS} ${FROM_JOINS} WHERE v.chassis_number=?`;
  const params = [chassisNumber];
  if (icdvId !== null) { sql += ' AND v.icdv_id=?'; params.push(icdvId); }
  const [vehicle] = await query(sql, params);
  return vehicle || null;
};

const getVehicleOperations = async (vehicleId, icdvId = null) => {
  await getVehicleById(vehicleId, icdvId);
  // Pull from vehicle_operations (workflow audit log) first, then old operations table
  const wfOps = await query(
    `SELECT 'workflow' AS source, vo.op_id AS id, vo.operation_type,
            vo.from_status, vo.to_status, vo.from_location, vo.to_location,
            vo.notes, vo.performed_at AS created_at, u.full_name AS operator_name
     FROM vehicle_operations vo
     LEFT JOIN users u ON u.user_id = vo.performed_by
     WHERE vo.vehicle_id=? ORDER BY vo.performed_at DESC`,
    [vehicleId]
  );
  return wfOps;
};

const updateVehicle = async (id, body, updaterId, icdvId = null) => {
  await getVehicleById(id, icdvId);
  const fields = []; const params = [];
  const allowed = [
    'manifest_id', 'chassis_number', 'engine_number', 'brand', 'model', 'year',
    'color', 'customer_name', 'destination', 'delivery_location', 'bill_of_lading_no',
    'release_status', 'operational_status', 'notes',
    // Allow direct workflow status update only from admin corrections — workflow model
    // handles normal transitions; this allows manual correction
    'workflow_status', 'current_location',
  ];
  for (const key of allowed) {
    if (body[key] !== undefined) { fields.push(`${key}=?`); params.push(body[key]); }
  }
  if (!fields.length) return getVehicleById(id, icdvId);
  fields.push('updated_by=?', 'updated_at=NOW()');
  params.push(updaterId, id);
  await query(`UPDATE vehicles SET ${fields.join(',')} WHERE vehicle_id=?`, params);
  return getVehicleById(id, icdvId);
};

const deleteVehicle = async (id, icdvId = null) => {
  const vehicle = await getVehicleById(id, icdvId);
  await query('DELETE FROM vehicles WHERE vehicle_id=?', [id]);
  return vehicle;
};

module.exports = {
  createVehicle, getVehicles, getVehicleById,
  getVehicleByChassis, getVehicleOperations, updateVehicle, deleteVehicle,
};
