const httpStatus = require('http-status');
const { query } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');

const createDriver = async (body, creatorId, photoPath = null) => {
  const {
    full_name, license_number, phone = null,
    email = null, id_number = null, status = 'active', notes = null,
  } = body;
  const existing = await query(
    'SELECT driver_id FROM drivers WHERE license_number=?', [license_number]
  );
  if (existing.length) throw new ApiError(httpStatus.CONFLICT, 'License number already registered');

  const r = await query(
    `INSERT INTO drivers (full_name, license_number, phone, email, id_number, photo, status, notes, created_by)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [full_name, license_number, phone, email, id_number, photoPath, status, notes, creatorId]
  );
  return getDriverById(r.insertId);
};

const getDrivers = async ({ page, limit, status, search }) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  let where = '1=1';
  const params = [];
  if (status) { where += ' AND d.status=?'; params.push(status); }
  if (search) {
    where += ' AND (d.full_name LIKE ? OR d.license_number LIKE ? OR d.id_number LIKE ? OR d.phone LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM drivers d WHERE ${where}`, params
  );
  const drivers = await query(
    `SELECT d.*,
       (SELECT COUNT(*) FROM operations op WHERE op.driver_id = d.driver_id) AS total_operations,
       u.full_name AS created_by_name
     FROM drivers d
     LEFT JOIN users u ON u.user_id = d.created_by
     WHERE ${where}
     ORDER BY d.full_name ASC
     LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );
  return paginate(drivers, total);
};

const getDriverById = async (id) => {
  const [driver] = await query(
    `SELECT d.*,
       (SELECT COUNT(*) FROM operations op WHERE op.driver_id = d.driver_id) AS total_operations,
       u.full_name AS created_by_name
     FROM drivers d
     LEFT JOIN users u ON u.user_id = d.created_by
     WHERE d.driver_id=?`,
    [id]
  );
  if (!driver) throw new ApiError(httpStatus.NOT_FOUND, 'Driver not found');
  return driver;
};

const updateDriver = async (id, body, updaterId, photoPath = null) => {
  await getDriverById(id);
  const fields = [];
  const params = [];
  const allowed = ['full_name','license_number','phone','email','id_number','status','notes'];
  for (const key of allowed) {
    if (body[key] !== undefined) { fields.push(`${key}=?`); params.push(body[key]); }
  }
  if (photoPath !== null) { fields.push('photo=?'); params.push(photoPath); }
  if (!fields.length) return getDriverById(id);
  fields.push('updated_by=?', 'updated_at=NOW()');
  params.push(updaterId, id);
  await query(`UPDATE drivers SET ${fields.join(',')} WHERE driver_id=?`, params);
  return getDriverById(id);
};

const deleteDriver = async (id) => {
  const driver = await getDriverById(id);
  const [{ cnt }] = await query(
    "SELECT COUNT(*) AS cnt FROM operations WHERE driver_id=? AND status='in_progress'", [id]
  );
  if (cnt > 0) throw new ApiError(httpStatus.BAD_REQUEST,
    'Cannot delete driver with active operations');
  await query('DELETE FROM drivers WHERE driver_id=?', [id]);
  return driver;
};

module.exports = { createDriver, getDrivers, getDriverById, updateDriver, deleteDriver };
