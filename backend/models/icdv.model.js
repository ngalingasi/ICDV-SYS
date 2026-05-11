const httpStatus = require('http-status');
const { query }  = require('../config/database');
const ApiError   = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');

const createIcdv = async (body, creatorId) => {
  const {
    name, code, address = null, phone = null, email = null,
    logo_path = null, country = 'Tanzania', city = null,
    is_active = 1, settings = null,
  } = body;

  if (!name) throw new ApiError(httpStatus.BAD_REQUEST, 'ICDV name is required');
  if (!code) throw new ApiError(httpStatus.BAD_REQUEST, 'ICDV code is required');

  const existing = await query('SELECT icdv_id FROM icdvs WHERE code = ?', [code.toUpperCase()]);
  if (existing.length) throw new ApiError(httpStatus.CONFLICT, 'ICDV code already exists');

  const r = await query(
    `INSERT INTO icdvs (name, code, address, phone, email, logo_path, country, city, is_active, settings, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [name, code.toUpperCase(), address, phone, email, logo_path, country, city, is_active,
     settings ? JSON.stringify(settings) : null, creatorId]
  );
  return getIcdvById(r.insertId);
};

const getIcdvs = async ({ page, limit, search, is_active } = {}) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  let where = '1=1';
  const params = [];

  if (is_active !== undefined && is_active !== '') {
    where += ' AND i.is_active = ?'; params.push(Number(is_active));
  }
  if (search) {
    where += ' AND (i.name LIKE ? OR i.code LIKE ? OR i.city LIKE ?)';
    const s = `%${search}%`; params.push(s, s, s);
  }

  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM icdvs i WHERE ${where}`, params);
  const rows = await query(
    `SELECT i.*,
       (SELECT COUNT(*) FROM users u       WHERE u.icdv_id       = i.icdv_id) AS user_count,
       (SELECT COUNT(*) FROM vessels v     WHERE v.icdv_id       = i.icdv_id) AS vessel_count,
       (SELECT COUNT(*) FROM vehicles vh   WHERE vh.icdv_id      = i.icdv_id) AS vehicle_count,
       (SELECT COUNT(*) FROM drivers d     WHERE d.icdv_id       = i.icdv_id) AS driver_count
     FROM icdvs i WHERE ${where} ORDER BY i.created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );
  return paginate(rows, total);
};

const getIcdvById = async (id) => {
  const [icdv] = await query(
    `SELECT i.*,
       (SELECT COUNT(*) FROM users u     WHERE u.icdv_id  = i.icdv_id) AS user_count,
       (SELECT COUNT(*) FROM vessels v   WHERE v.icdv_id  = i.icdv_id) AS vessel_count,
       (SELECT COUNT(*) FROM vehicles vh WHERE vh.icdv_id = i.icdv_id) AS vehicle_count,
       (SELECT COUNT(*) FROM drivers d   WHERE d.icdv_id  = i.icdv_id) AS driver_count
     FROM icdvs i WHERE i.icdv_id = ?`,
    [id]
  );
  if (!icdv) throw new ApiError(httpStatus.NOT_FOUND, 'ICDV not found');
  return icdv;
};

const updateIcdv = async (id, body) => {
  await getIcdvById(id);
  const allowed = ['name','code','address','phone','email','logo_path','country','city','is_active','settings'];
  const fields = []; const params = [];
  for (const key of allowed) {
    if (body[key] !== undefined) { fields.push(`${key}=?`); params.push(body[key]); }
  }
  if (!fields.length) return getIcdvById(id);

  if (body.code) {
    const dup = await query('SELECT icdv_id FROM icdvs WHERE code=? AND icdv_id!=?', [body.code.toUpperCase(), id]);
    if (dup.length) throw new ApiError(httpStatus.CONFLICT, 'ICDV code already taken');
  }

  fields.push('updated_at=NOW()');
  params.push(id);
  await query(`UPDATE icdvs SET ${fields.join(',')} WHERE icdv_id=?`, params);
  return getIcdvById(id);
};

const deleteIcdv = async (id) => {
  await getIcdvById(id);
  const [{ cnt }] = await query('SELECT COUNT(*) AS cnt FROM users WHERE icdv_id=?', [id]);
  if (cnt > 0) throw new ApiError(httpStatus.CONFLICT, 'Cannot delete ICDV with active users. Deactivate instead.');
  await query('DELETE FROM icdvs WHERE icdv_id=?', [id]);
};

const getPlatformStats = async () => {
  const [[totals], breakdown] = await Promise.all([
    query(`SELECT COUNT(*) AS total_icdvs, SUM(is_active=1) AS active_icdvs FROM icdvs`),
    query(`
      SELECT i.icdv_id, i.name, i.code,
        (SELECT COUNT(*) FROM vessels v   WHERE v.icdv_id  = i.icdv_id) AS vessel_count,
        (SELECT COUNT(*) FROM vehicles vh WHERE vh.icdv_id = i.icdv_id) AS vehicle_count,
        (SELECT COUNT(*) FROM users u     WHERE u.icdv_id  = i.icdv_id) AS user_count
      FROM icdvs i WHERE i.is_active=1 ORDER BY i.name
    `),
  ]);
  return { ...totals, breakdown };
};

module.exports = { createIcdv, getIcdvs, getIcdvById, updateIcdv, deleteIcdv, getPlatformStats };
