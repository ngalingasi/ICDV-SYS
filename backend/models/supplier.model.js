const httpStatus = require('http-status');
const { query }  = require('../config/database');
const ApiError   = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');

const BASE_SELECT = `
  SELECT s.*,
         r.region_name,
         u.full_name AS created_by_name
  FROM suppliers s
  LEFT JOIN regions r ON r.region_id = s.region_id
  LEFT JOIN users  u ON u.user_id    = s.created_by
  WHERE s.deleted_at IS NULL`;

const getSuppliers = async ({ page, limit, search, region_id, status }) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  const where = []; const params = [];

  if (search) {
    where.push('(s.company_name LIKE ? OR s.contact_person LIKE ? OR s.email LIKE ?)');
    const q = `%${search}%`; params.push(q, q, q);
  }
  if (region_id) { where.push('s.region_id = ?'); params.push(parseInt(region_id, 10)); }
  if (status)    { where.push('s.status = ?');    params.push(status); }

  const filter = where.length ? ' AND ' + where.join(' AND ') : '';
  const [countRow] = await query(
    `SELECT COUNT(*) AS total FROM suppliers s WHERE s.deleted_at IS NULL${filter}`, params
  );
  const rows = await query(
    `${BASE_SELECT}${filter} ORDER BY s.created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );
  return { results: rows, ...paginate(countRow.total) };
};

const getSupplierById = async (id) => {
  const rows = await query(`${BASE_SELECT} AND s.supplier_id = ?`, [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Supplier not found');
  return rows[0];
};

const createSupplier = async (body, userId) => {
  const {
    company_name, contact_person = null, email = null,
    phone_number = null, address = null, region_id = null,
    tax_number = null, country = null, currency = null, notes = null, status = 'active',
  } = body;

  if (email) {
    const [exist] = await query(
      'SELECT supplier_id FROM suppliers WHERE email = ? AND deleted_at IS NULL', [email]
    );
    if (exist) throw new ApiError(httpStatus.CONFLICT, 'Email already registered for another supplier');
  }

  const result = await query(
    `INSERT INTO suppliers
       (company_name, contact_person, email, phone_number, address,
        region_id, tax_number, country, currency, notes, status, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [company_name, contact_person, email, phone_number, address,
     region_id, tax_number, country, currency, notes, status, userId]
  );
  return getSupplierById(result.insertId);
};

const updateSupplier = async (id, body, userId) => {
  await getSupplierById(id);
  const allowed = ['company_name','contact_person','email','phone_number','address',
                   'region_id','tax_number','country','currency','notes','status'];
  const fields  = Object.keys(body).filter(k => allowed.includes(k));
  if (!fields.length) throw new ApiError(httpStatus.BAD_REQUEST, 'No valid fields to update');

  if (body.email) {
    const [exist] = await query(
      'SELECT supplier_id FROM suppliers WHERE email = ? AND deleted_at IS NULL AND supplier_id != ?',
      [body.email, id]
    );
    if (exist) throw new ApiError(httpStatus.CONFLICT, 'Email already in use by another supplier');
  }

  const set    = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => body[f]);
  await query(`UPDATE suppliers SET ${set}, updated_by = ? WHERE supplier_id = ?`,
    [...values, userId, id]);
  return getSupplierById(id);
};

const deleteSupplier = async (id, userId) => {
  await getSupplierById(id);
  await query(
    'UPDATE suppliers SET deleted_at = NOW(), updated_by = ? WHERE supplier_id = ?',
    [userId, id]
  );
};

module.exports = { getSuppliers, getSupplierById, createSupplier, updateSupplier, deleteSupplier };
