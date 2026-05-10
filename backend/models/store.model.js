const httpStatus = require('http-status');
const { query }  = require('../config/database');
const ApiError   = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');

const BASE_SELECT = `
  SELECT s.*,
         r.region_name,
         u.full_name AS created_by_name
  FROM stores s
  LEFT JOIN regions r ON r.region_id = s.region_id
  LEFT JOIN users  u ON u.user_id    = s.created_by
  WHERE s.deleted_at IS NULL`;

const getStores = async ({ page, limit, search, region_id, status }) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  const where = []; const params = [];

  if (search) {
    where.push('(s.store_name LIKE ? OR s.manager_name LIKE ? OR s.address LIKE ?)');
    const q = `%${search}%`; params.push(q, q, q);
  }
  if (region_id) { where.push('s.region_id = ?'); params.push(parseInt(region_id, 10)); }
  if (status)    { where.push('s.status = ?');    params.push(status); }

  const filter = where.length ? ' AND ' + where.join(' AND ') : '';
  const [countRow] = await query(
    `SELECT COUNT(*) AS total FROM stores s WHERE s.deleted_at IS NULL${filter}`, params
  );
  const rows = await query(
    `${BASE_SELECT}${filter} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );
  return { results: rows, ...paginate(countRow.total) };
};

const getStoreById = async (id) => {
  const rows = await query(`${BASE_SELECT} AND s.store_id = ?`, [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Store not found');
  return rows[0];
};

const createStore = async (body, userId) => {
  const {
    store_name, region_id, address = null,
    latitude = null, longitude = null, contact_number = null,
    manager_name = null, capacity = null, notes = null, status = 'active',
  } = body;

  // Verify region exists
  const [region] = await query('SELECT region_id FROM regions WHERE region_id = ?', [region_id]);
  if (!region) throw new ApiError(httpStatus.BAD_REQUEST, 'Region does not exist');

  const result = await query(
    `INSERT INTO stores
       (store_name, region_id, address, latitude, longitude,
        contact_number, manager_name, capacity, notes, status, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [store_name, region_id, address, latitude, longitude,
     contact_number, manager_name, capacity, notes, status, userId]
  );
  return getStoreById(result.insertId);
};

const updateStore = async (id, body, userId) => {
  await getStoreById(id);
  const allowed = ['store_name','region_id','address','latitude','longitude',
                   'contact_number','manager_name','capacity','notes','status'];
  const fields  = Object.keys(body).filter(k => allowed.includes(k));
  if (!fields.length) throw new ApiError(httpStatus.BAD_REQUEST, 'No valid fields to update');

  if (body.region_id) {
    const [region] = await query('SELECT region_id FROM regions WHERE region_id = ?', [body.region_id]);
    if (!region) throw new ApiError(httpStatus.BAD_REQUEST, 'Region does not exist');
  }

  const set    = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => body[f]);
  await query(`UPDATE stores SET ${set}, updated_by = ? WHERE store_id = ?`,
    [...values, userId, id]);
  return getStoreById(id);
};

const deleteStore = async (id, userId) => {
  await getStoreById(id);
  await query(
    'UPDATE stores SET deleted_at = NOW(), updated_by = ? WHERE store_id = ?',
    [userId, id]
  );
};

module.exports = { getStores, getStoreById, createStore, updateStore, deleteStore };
