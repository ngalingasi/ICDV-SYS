const httpStatus = require('http-status');
const { query } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');
const { OPERATION_STATUS_TRANSITIONS } = require('../config/statuses');

const createOperation = async (body, creatorId) => {
  const {
    vehicle_id, driver_id = null, operation_type,
    scheduled_date = null, notes = null, status = 'pending',
  } = body;

  const r = await query(
    `INSERT INTO operations (vehicle_id, driver_id, operation_type, scheduled_date, notes, status, created_by)
     VALUES (?,?,?,?,?,?,?)`,
    [vehicle_id, driver_id, operation_type, scheduled_date, notes, status, creatorId]
  );

  // Update vehicle operational status
  await query(
    "UPDATE vehicles SET operational_status='in_operation', updated_by=?, updated_at=NOW() WHERE vehicle_id=?",
    [creatorId, vehicle_id]
  );

  return getOperationById(r.insertId);
};

const getOperations = async ({ page, limit, vehicle_id, driver_id, status, operation_type, search, date_from, date_to }) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  let where = '1=1';
  const params = [];
  if (vehicle_id)     { where += ' AND op.vehicle_id=?';     params.push(vehicle_id); }
  if (driver_id)      { where += ' AND op.driver_id=?';      params.push(driver_id); }
  if (status)         { where += ' AND op.status=?';         params.push(status); }
  if (operation_type) { where += ' AND op.operation_type=?'; params.push(operation_type); }
  if (date_from)      { where += ' AND DATE(op.scheduled_date)>=?'; params.push(date_from); }
  if (date_to)        { where += ' AND DATE(op.scheduled_date)<=?'; params.push(date_to); }
  if (search) {
    where += ' AND (vh.chassis_number LIKE ? OR d.full_name LIKE ? OR op.operation_type LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM operations op
     LEFT JOIN vehicles vh ON vh.vehicle_id = op.vehicle_id
     LEFT JOIN drivers d ON d.driver_id = op.driver_id
     WHERE ${where}`, params
  );
  const operations = await query(
    `SELECT op.*,
       vh.chassis_number, vh.brand, vh.model, vh.color,
       m.manifest_number, v.name AS vessel_name,
       d.full_name AS driver_name, d.license_number,
       u.full_name AS created_by_name
     FROM operations op
     LEFT JOIN vehicles vh ON vh.vehicle_id = op.vehicle_id
     LEFT JOIN manifests m ON m.manifest_id = vh.manifest_id
     LEFT JOIN vessels v ON v.vessel_id = m.vessel_id
     LEFT JOIN drivers d ON d.driver_id = op.driver_id
     LEFT JOIN users u ON u.user_id = op.created_by
     WHERE ${where}
     ORDER BY op.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );
  return paginate(operations, total);
};

const getOperationById = async (id) => {
  const [op] = await query(
    `SELECT op.*,
       vh.chassis_number, vh.brand, vh.model, vh.color, vh.customer_name, vh.destination,
       m.manifest_number, v.name AS vessel_name,
       d.full_name AS driver_name, d.license_number, d.phone AS driver_phone,
       u.full_name AS created_by_name
     FROM operations op
     LEFT JOIN vehicles vh ON vh.vehicle_id = op.vehicle_id
     LEFT JOIN manifests m ON m.manifest_id = vh.manifest_id
     LEFT JOIN vessels v ON v.vessel_id = m.vessel_id
     LEFT JOIN drivers d ON d.driver_id = op.driver_id
     LEFT JOIN users u ON u.user_id = op.created_by
     WHERE op.operation_id=?`,
    [id]
  );
  if (!op) throw new ApiError(httpStatus.NOT_FOUND, 'Operation not found');
  return op;
};

const updateOperation = async (id, body, updaterId) => {
  await getOperationById(id);
  const fields = [];
  const params = [];
  const allowed = ['driver_id','operation_type','scheduled_date','completed_date','notes'];
  for (const key of allowed) {
    if (body[key] !== undefined) { fields.push(`${key}=?`); params.push(body[key]); }
  }
  if (!fields.length) return getOperationById(id);
  fields.push('updated_by=?', 'updated_at=NOW()');
  params.push(updaterId, id);
  await query(`UPDATE operations SET ${fields.join(',')} WHERE operation_id=?`, params);
  return getOperationById(id);
};

const updateOperationStatus = async (id, newStatus, userId, notes = null) => {
  const op = await getOperationById(id);
  const allowed = OPERATION_STATUS_TRANSITIONS[op.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new ApiError(httpStatus.BAD_REQUEST,
      `Cannot transition from '${op.status}' to '${newStatus}'`);
  }

  const extraFields = [];
  const extraParams = [];
  if (newStatus === 'completed') {
    extraFields.push('completed_date=NOW()');
  }
  if (notes) { extraFields.push('notes=?'); extraParams.push(notes); }

  const setClause = [`status=?`, ...extraFields, 'updated_by=?', 'updated_at=NOW()'].join(',');
  await query(
    `UPDATE operations SET ${setClause} WHERE operation_id=?`,
    [newStatus, ...extraParams, userId, id]
  );

  // Update vehicle operational_status when operation completes
  if (newStatus === 'completed') {
    await query(
      "UPDATE vehicles SET operational_status='ready', updated_by=?, updated_at=NOW() WHERE vehicle_id=?",
      [userId, op.vehicle_id]
    );
  }
  if (newStatus === 'cancelled') {
    // Revert vehicle if no other active ops
    const [{ cnt }] = await query(
      "SELECT COUNT(*) AS cnt FROM operations WHERE vehicle_id=? AND status='in_progress' AND operation_id!=?",
      [op.vehicle_id, id]
    );
    if (cnt === 0) {
      await query(
        "UPDATE vehicles SET operational_status='pending', updated_by=?, updated_at=NOW() WHERE vehicle_id=?",
        [userId, op.vehicle_id]
      );
    }
  }
  return getOperationById(id);
};

const deleteOperation = async (id) => {
  const op = await getOperationById(id);
  if (['in_progress','completed'].includes(op.status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot delete an in-progress or completed operation');
  }
  await query('DELETE FROM operations WHERE operation_id=?', [id]);
  return op;
};

module.exports = { createOperation, getOperations, getOperationById, updateOperation, updateOperationStatus, deleteOperation };
