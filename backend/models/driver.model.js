const httpStatus = require('http-status');
const { query }  = require('../config/database');
const ApiError   = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');

// ─────────────────────────────────────────────────────────────────────────────
// CREATE
// icdvId may be null for super_admin/system_admin — driver is then global
// ─────────────────────────────────────────────────────────────────────────────
const createDriver = async (body, creatorId, photoPath = null, icdvId) => {
  const {
    full_name, license_number, phone = null,
    email = null, id_number = null, status = 'active', notes = null,
  } = body;

  // Uniqueness: if creating under an icdv, check per-icdv; otherwise check globally
  const dupSql    = icdvId
    ? 'SELECT driver_id FROM drivers WHERE license_number=? AND icdv_id=?'
    : 'SELECT driver_id FROM drivers WHERE license_number=? AND icdv_id IS NULL';
  const dupParams = icdvId ? [license_number, icdvId] : [license_number];
  const existing  = await query(dupSql, dupParams);
  if (existing.length) throw new ApiError(httpStatus.CONFLICT, 'License number already registered');

  const r = await query(
    `INSERT INTO drivers (icdv_id, full_name, license_number, phone, email, id_number, photo, status, notes, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [icdvId ?? null, full_name, license_number, phone, email, id_number, photoPath, status, notes, creatorId]
  );
  return getDriverById(r.insertId, null); // fetch without icdv scope — just created
};

// ─────────────────────────────────────────────────────────────────────────────
// LIST
// icdvId=null → return all (super_admin/system_admin)
// icdvId set  → return drivers for that icdv + global (icdv_id IS NULL) drivers
// ─────────────────────────────────────────────────────────────────────────────
const getDrivers = async ({ page, limit, status, search }, icdvId = null) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  let where = '1=1'; const params = [];

  if (icdvId !== null) {
    // Show this ICDV's drivers plus unassigned (global) drivers
    where += ' AND (d.icdv_id=? OR d.icdv_id IS NULL)';
    params.push(icdvId);
  }
  if (status) { where += ' AND d.status=?'; params.push(status); }
  if (search) {
    where += ' AND (d.full_name LIKE ? OR d.license_number LIKE ? OR d.id_number LIKE ? OR d.phone LIKE ?)';
    const s = `%${search}%`; params.push(s, s, s, s);
  }

  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM drivers d WHERE ${where}`, params);
  const drivers = await query(
    `SELECT d.*,
       ic.name AS icdv_name,
       (SELECT COUNT(*) FROM transfers t WHERE t.driver_id = d.driver_id AND t.status != 'cancelled') AS total_transfers,
       (SELECT COUNT(*) FROM driver_assignments da WHERE da.driver_id = d.driver_id AND da.status = 'active') AS active_assignments,
       u.full_name AS created_by_name
     FROM drivers d
     LEFT JOIN icdvs ic ON ic.icdv_id = d.icdv_id
     LEFT JOIN users u  ON u.user_id  = d.created_by
     WHERE ${where} ORDER BY d.full_name ASC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );
  return paginate(drivers, total);
};

// ─────────────────────────────────────────────────────────────────────────────
// GET SINGLE — includes transfer history
// ─────────────────────────────────────────────────────────────────────────────
const getDriverById = async (id, icdvId = null) => {
  const [driver] = await query(
    `SELECT d.*,
       ic.name AS icdv_name,
       (SELECT COUNT(*) FROM transfers t WHERE t.driver_id = d.driver_id AND t.status != 'cancelled') AS total_transfers,
       (SELECT COUNT(*) FROM driver_assignments da WHERE da.driver_id = d.driver_id AND da.status = 'active') AS active_assignments,
       u.full_name AS created_by_name
     FROM drivers d
     LEFT JOIN icdvs ic ON ic.icdv_id = d.icdv_id
     LEFT JOIN users u  ON u.user_id  = d.created_by
     WHERE d.driver_id=?`,
    [id]
  );
  if (!driver) throw new ApiError(httpStatus.NOT_FOUND, 'Driver not found');
  // Scope check: allow if icdvId matches OR driver is global (icdv_id IS NULL)
  if (icdvId !== null && driver.icdv_id !== null && driver.icdv_id !== icdvId)
    throw new ApiError(httpStatus.NOT_FOUND, 'Driver not found');

  // Transfer history (most recent 50)
  driver.transfer_history = await query(
    `SELECT
       t.transfer_id, t.transferred_at, t.status AS transfer_status,
       v.chassis_number, v.brand, v.model,
       b.batch_number,
       vs.name AS vessel_name,
       ic2.name AS icdv_name,
       rl.received_at
     FROM transfers t
     JOIN vehicles v  ON v.vehicle_id  = t.vehicle_id
     LEFT JOIN batches  b   ON b.batch_id   = t.batch_id
     LEFT JOIN manifests m  ON m.manifest_id = v.manifest_id
     LEFT JOIN vessels  vs  ON vs.vessel_id  = m.vessel_id
     LEFT JOIN icdvs    ic2 ON ic2.icdv_id   = t.icdv_id
     LEFT JOIN receiving_logs rl ON rl.transfer_id = t.transfer_id
     WHERE t.driver_id=? AND t.status != 'cancelled'
     ORDER BY t.transferred_at DESC
     LIMIT 50`,
    [id]
  );

  return driver;
};

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────
const updateDriver = async (id, body, updaterId, photoPath = null, icdvId = null) => {
  await getDriverById(id, icdvId);
  const fields = []; const params = [];
  const allowed = ['full_name','license_number','phone','email','id_number','status','notes'];
  for (const key of allowed) {
    if (body[key] !== undefined) { fields.push(`${key}=?`); params.push(body[key]); }
  }
  if (photoPath !== null) { fields.push('photo=?'); params.push(photoPath); }
  if (!fields.length) return getDriverById(id, icdvId);
  fields.push('updated_by=?', 'updated_at=NOW()');
  params.push(updaterId, id);
  await query(`UPDATE drivers SET ${fields.join(',')} WHERE driver_id=?`, params);
  return getDriverById(id, icdvId);
};

// ─────────────────────────────────────────────────────────────────────────────
// RELEASE FROM ICDV — set icdv_id = NULL so driver becomes globally available
// Blocked if driver has an active vehicle assignment
// ─────────────────────────────────────────────────────────────────────────────
const releaseDriverFromIcdv = async (id, updaterId, icdvId = null) => {
  const driver = await getDriverById(id, icdvId);

  // Block if actively assigned to a vehicle
  const [{ active }] = await query(
    "SELECT COUNT(*) AS active FROM driver_assignments WHERE driver_id=? AND status='active'",
    [id]
  );
  if (active > 0)
    throw new ApiError(
      httpStatus.CONFLICT,
      `Cannot release driver ${driver.full_name} — they are currently assigned to an active vehicle transfer. Complete that operation first.`
    );

  await query(
    'UPDATE drivers SET icdv_id=NULL, updated_by=?, updated_at=NOW() WHERE driver_id=?',
    [updaterId, id]
  );
  return getDriverById(id, null);
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// Blocked if active operations OR active assignment
// ─────────────────────────────────────────────────────────────────────────────
const deleteDriver = async (id, icdvId = null) => {
  const driver = await getDriverById(id, icdvId);

  const [{ activeAssign }] = await query(
    "SELECT COUNT(*) AS activeAssign FROM driver_assignments WHERE driver_id=? AND status='active'",
    [id]
  );
  if (activeAssign > 0)
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot delete driver with an active vehicle assignment');

  const [{ activeOps }] = await query(
    "SELECT COUNT(*) AS activeOps FROM operations WHERE driver_id=? AND status='in_progress'",
    [id]
  );
  if (activeOps > 0)
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot delete driver with active operations');

  await query('DELETE FROM drivers WHERE driver_id=?', [id]);
  return driver;
};

module.exports = { createDriver, getDrivers, getDriverById, updateDriver, releaseDriverFromIcdv, deleteDriver };
