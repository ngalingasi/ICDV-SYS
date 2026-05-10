const httpStatus = require('http-status');
const { query }  = require('../config/database');
const ApiError   = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');

const BASE_SELECT = `
  SELECT p.*,
         c.name AS category_name,
         u.full_name AS created_by_name
  FROM products p
  LEFT JOIN product_categories c ON c.category_id = p.category_id
  LEFT JOIN users              u ON u.user_id      = p.created_by
  WHERE p.deleted_at IS NULL`;

const getProducts = async ({ page, limit, search, product_type, category_id, status }) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  const where = []; const params = [];

  if (search) {
    where.push('(p.product_name LIKE ? OR p.sku_barcode LIKE ? OR p.brand LIKE ?)');
    const q = `%${search}%`; params.push(q, q, q);
  }
  if (product_type) { where.push('p.product_type = ?'); params.push(product_type); }
  if (category_id)  { where.push('p.category_id = ?');  params.push(parseInt(category_id, 10)); }
  if (status)       { where.push('p.status = ?');       params.push(status); }

  const filter = where.length ? ' AND ' + where.join(' AND ') : '';
  const [countRow] = await query(
    `SELECT COUNT(*) AS total FROM products p WHERE p.deleted_at IS NULL${filter}`, params
  );
  const rows = await query(
    `${BASE_SELECT}${filter} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );
  return { results: rows, ...paginate(countRow.total) };
};

const getProductById = async (id) => {
  const rows = await query(`${BASE_SELECT} AND p.product_id = ?`, [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Product not found');
  return rows[0];
};

const getCategories = async (product_type) => {
  const where = product_type
    ? `WHERE product_type = '${product_type}' OR product_type = 'both'`
    : '';
  return query(`SELECT * FROM product_categories ${where} ORDER BY name`, []);
};

const createProduct = async (body, userId) => {
  const {
    sku_barcode = null, product_name, product_type,
    category_id = null, brand = null, unit_type = null,
    description = null, status = 'active',
  } = body;

  if (sku_barcode) {
    const [exist] = await query(
      'SELECT product_id FROM products WHERE sku_barcode = ? AND deleted_at IS NULL', [sku_barcode]
    );
    if (exist) throw new ApiError(httpStatus.CONFLICT, 'SKU/Barcode already exists');
  }

  const result = await query(
    `INSERT INTO products
       (sku_barcode, product_name, product_type, category_id, brand, unit_type,
        description, status, created_by)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [sku_barcode, product_name, product_type, category_id, brand, unit_type,
     description, status, userId]
  );
  return getProductById(result.insertId);
};

const updateProduct = async (id, body, userId) => {
  await getProductById(id);
  const allowed = ['sku_barcode','product_name','product_type','category_id','brand',
                   'unit_type','description','status'];
  const fields  = Object.keys(body).filter(k => allowed.includes(k));
  if (!fields.length) throw new ApiError(httpStatus.BAD_REQUEST, 'No valid fields to update');

  if (body.sku_barcode) {
    const [exist] = await query(
      'SELECT product_id FROM products WHERE sku_barcode = ? AND deleted_at IS NULL AND product_id != ?',
      [body.sku_barcode, id]
    );
    if (exist) throw new ApiError(httpStatus.CONFLICT, 'SKU/Barcode already in use');
  }

  const set    = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => body[f]);
  await query(`UPDATE products SET ${set}, updated_by = ? WHERE product_id = ?`,
    [...values, userId, id]);
  return getProductById(id);
};

const deleteProduct = async (id, userId) => {
  await getProductById(id);
  await query(
    'UPDATE products SET deleted_at = NOW(), updated_by = ? WHERE product_id = ?',
    [userId, id]
  );
};

module.exports = { getProducts, getProductById, getCategories, createProduct, updateProduct, deleteProduct };
