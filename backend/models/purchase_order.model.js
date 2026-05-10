const httpStatus = require('http-status');
const { query, transaction } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');

// ── Order number generation ───────────────────────────────────────────────────
const generateOrderNumber = async (conn) => {
  const year = new Date().getFullYear();
  const exec = conn
    ? (sql, p) => conn.query(sql, p).then(([r]) => r)
    : query;

  // Upsert sequence row and increment atomically
  await exec(
    `INSERT INTO po_number_sequences (year, last_seq) VALUES (?, 1)
     ON DUPLICATE KEY UPDATE last_seq = last_seq + 1`,
    [year]
  );
  const [row] = await exec(
    'SELECT last_seq FROM po_number_sequences WHERE year = ?',
    [year]
  );
  const seq = String(row.last_seq).padStart(5, '0');
  return `ORD-${year}-${seq}`;
};

// ── Recalculate & update order totals ─────────────────────────────────────────
const recalcTotals = async (orderId, conn = null) => {
  const exec = conn
    ? (sql, p) => conn.query(sql, p).then(([r]) => r)
    : query;

  const [totals] = await exec(
    `SELECT
       COALESCE(SUM(total_price_foreign), 0) AS subtotal_foreign,
       COALESCE(SUM(total_price_foreign), 0) AS total_amount_foreign,
       COALESCE(SUM(base_price_tzs), 0)      AS total_amount_tzs
     FROM purchase_order_items
     WHERE purchase_order_id = ?`,
    [orderId]
  );
  await exec(
    `UPDATE purchase_orders
     SET subtotal_foreign     = ?,
         total_amount_foreign = ?,
         total_amount_tzs     = ?
     WHERE purchase_order_id = ?`,
    [totals.subtotal_foreign, totals.total_amount_foreign, totals.total_amount_tzs, orderId]
  );
};

// ── Base SELECT ───────────────────────────────────────────────────────────────
const BASE_SELECT = `
  SELECT po.*,
         s.company_name AS supplier_name,
         s.country      AS supplier_country,
         s.currency     AS supplier_currency,
         p.name         AS project_name,
         u.full_name    AS created_by_name
  FROM purchase_orders po
  JOIN suppliers s ON s.supplier_id = po.supplier_id
  LEFT JOIN projects p ON p.project_id = po.project_id
  LEFT JOIN users   u ON u.user_id    = po.created_by
  WHERE po.deleted_at IS NULL`;

// ── List ──────────────────────────────────────────────────────────────────────
const getPurchaseOrders = async ({ page, limit, search, status, supplier_id, project_id }) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  const where = []; const params = [];

  if (search) {
    where.push('(po.order_number LIKE ? OR s.company_name LIKE ?)');
    const q = `%${search}%`; params.push(q, q);
  }
  if (status)      { where.push('po.status = ?');      params.push(status); }
  if (supplier_id) { where.push('po.supplier_id = ?'); params.push(parseInt(supplier_id, 10)); }
  if (project_id)  { where.push('po.project_id = ?');  params.push(parseInt(project_id, 10)); }

  const filter = where.length ? ' AND ' + where.join(' AND ') : '';
  const [countRow] = await query(
    `SELECT COUNT(*) AS total
     FROM purchase_orders po
     JOIN suppliers s ON s.supplier_id = po.supplier_id
     WHERE po.deleted_at IS NULL${filter}`,
    params
  );
  const rows = await query(
    `${BASE_SELECT}${filter} ORDER BY po.created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );
  return { results: rows, ...paginate(countRow.total) };
};

// ── Get single ────────────────────────────────────────────────────────────────
const getPurchaseOrderById = async (id, conn = null) => {
  const exec = conn
    ? (sql, p) => conn.query(sql, p).then(([r]) => r)
    : query;

  const rows = await exec(`${BASE_SELECT} AND po.purchase_order_id = ?`, [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Purchase order not found');
  const po = rows[0];

  po.items = await exec(
    `SELECT poi.*,
            pr.product_name, pr.sku_barcode, pr.brand
     FROM purchase_order_items poi
     JOIN products pr ON pr.product_id = poi.product_id
     WHERE poi.purchase_order_id = ?
     ORDER BY poi.item_id`,
    [id]
  );
  return po;
};

// ── Create ────────────────────────────────────────────────────────────────────
const createPurchaseOrder = async (body, userId) => {
  return transaction(async (conn) => {
    const {
      supplier_id, project_id = null,
      currency_code = 'TZS', exchange_rate = 1,
      order_date, expected_delivery_date = null,
      notes = null, status = 'draft',
      items = [],
    } = body;

    const orderNumber = await generateOrderNumber(conn);

    const [result] = await conn.query(
      `INSERT INTO purchase_orders
         (order_number, supplier_id, project_id, currency_code, exchange_rate,
          order_date, expected_delivery_date, notes, status, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [orderNumber, supplier_id, project_id, currency_code, parseFloat(exchange_rate),
       order_date, expected_delivery_date, notes, status, userId]
    );
    const orderId = result.insertId;

    // Insert items
    for (const item of items) {
      const qty   = parseFloat(item.quantity);
      const price = parseFloat(item.unit_price);
      const totalForeign = Math.round(qty * price * 100) / 100;
      const totalTzs     = Math.round(totalForeign * parseFloat(exchange_rate) * 100) / 100;

      await conn.query(
        `INSERT INTO purchase_order_items
           (purchase_order_id, product_id, description, unit_type,
            quantity, unit_price, total_price_foreign, base_price_tzs)
         VALUES (?,?,?,?,?,?,?,?)`,
        [orderId, item.product_id, item.description || null, item.unit_type || null,
         qty, price, totalForeign, totalTzs]
      );
    }

    await recalcTotals(orderId, conn);
    return getPurchaseOrderById(orderId, conn);
  });
};

// ── Update ────────────────────────────────────────────────────────────────────
const updatePurchaseOrder = async (id, body, userId) => {
  const po = await getPurchaseOrderById(id);
  if (po.status === 'cancelled') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cancelled orders cannot be edited');
  }

  const allowed = ['supplier_id','project_id','currency_code','exchange_rate',
                   'order_date','expected_delivery_date','notes','status'];
  const fields  = Object.keys(body).filter(k => allowed.includes(k));

  if (fields.length) {
    const set    = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => body[f]);
    await query(
      `UPDATE purchase_orders SET ${set}, updated_by = ? WHERE purchase_order_id = ?`,
      [...values, userId, id]
    );
  }

  // Replace items if provided
  if (body.items !== undefined) {
    const rate = parseFloat(body.exchange_rate ?? po.exchange_rate);
    await query('DELETE FROM purchase_order_items WHERE purchase_order_id = ?', [id]);
    for (const item of body.items) {
      const qty          = parseFloat(item.quantity);
      const price        = parseFloat(item.unit_price);
      const totalForeign = Math.round(qty * price * 100) / 100;
      const totalTzs     = Math.round(totalForeign * rate * 100) / 100;

      await query(
        `INSERT INTO purchase_order_items
           (purchase_order_id, product_id, description, unit_type,
            quantity, unit_price, total_price_foreign, base_price_tzs)
         VALUES (?,?,?,?,?,?,?,?)`,
        [id, item.product_id, item.description || null, item.unit_type || null,
         qty, price, totalForeign, totalTzs]
      );
    }
    await recalcTotals(id);
  }

  return getPurchaseOrderById(id);
};

// ── Cancel ────────────────────────────────────────────────────────────────────
const cancelPurchaseOrder = async (id, userId) => {
  const po = await getPurchaseOrderById(id);
  if (po.status === 'cancelled') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Order is already cancelled');
  }
  if (['completed','ordered'].includes(po.status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Cannot cancel an order with status "${po.status}"`);
  }
  await query(
    'UPDATE purchase_orders SET status = ?, updated_by = ? WHERE purchase_order_id = ?',
    ['cancelled', userId, id]
  );
  return getPurchaseOrderById(id);
};

// ── Soft delete ───────────────────────────────────────────────────────────────
const deletePurchaseOrder = async (id, userId) => {
  await getPurchaseOrderById(id);
  await query(
    'UPDATE purchase_orders SET deleted_at = NOW(), deleted_by = ?, updated_by = ? WHERE purchase_order_id = ?',
    [userId, userId, id]
  );
};

module.exports = {
  getPurchaseOrders, getPurchaseOrderById,
  createPurchaseOrder, updatePurchaseOrder,
  cancelPurchaseOrder, deletePurchaseOrder,
};
