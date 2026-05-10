const httpStatus = require('http-status');
const { query, transaction } = require('../config/database');
const ApiError   = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');

// ── Number generation ─────────────────────────────────────────────────────────
const generateTransferNumber = async (conn) => {
  const year = new Date().getFullYear();
  const exec = conn ? (s, p) => conn.query(s, p).then(([r]) => r) : query;
  await exec(
    `INSERT INTO transfer_number_sequences (year, last_seq) VALUES (?, 1)
     ON DUPLICATE KEY UPDATE last_seq = last_seq + 1`, [year]
  );
  const [row] = await exec('SELECT last_seq FROM transfer_number_sequences WHERE year = ?', [year]);
  return `TRF-${year}-${String(row.last_seq).padStart(5, '0')}`;
};

// ── Base SELECT ───────────────────────────────────────────────────────────────
const BASE = `
  SELECT t.*,
         ss.store_name AS source_store_name,     sr.region_name AS source_region,
         ds.store_name AS destination_store_name, dr.region_name AS destination_region,
         u.full_name   AS created_by_name,
         lc.company_name AS logistics_company_name, lc.company_type AS logistics_company_type
  FROM stock_transfers t
  JOIN stores ss ON ss.store_id = t.source_store_id
  LEFT JOIN regions sr ON sr.region_id = ss.region_id
  JOIN stores ds ON ds.store_id = t.destination_store_id
  LEFT JOIN regions dr ON dr.region_id = ds.region_id
  LEFT JOIN users u ON u.user_id = t.created_by
  LEFT JOIN logistics_companies lc ON lc.logistics_company_id = t.logistics_company_id
  WHERE t.deleted_at IS NULL`;

// ── List ──────────────────────────────────────────────────────────────────────
const getTransfers = async ({ page, limit, search, status, source_store_id, destination_store_id }) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  const where = []; const params = [];
  if (search)               { where.push('(t.transfer_number LIKE ? OR ss.store_name LIKE ? OR ds.store_name LIKE ?)'); const q=`%${search}%`; params.push(q,q,q); }
  if (status)               { where.push('t.status = ?');               params.push(status); }
  if (source_store_id)      { where.push('t.source_store_id = ?');      params.push(parseInt(source_store_id, 10)); }
  if (destination_store_id) { where.push('t.destination_store_id = ?'); params.push(parseInt(destination_store_id, 10)); }
  const filter = where.length ? ' AND ' + where.join(' AND ') : '';
  const [countRow] = await query(`SELECT COUNT(*) AS total FROM stock_transfers t JOIN stores ss ON ss.store_id=t.source_store_id JOIN stores ds ON ds.store_id=t.destination_store_id WHERE t.deleted_at IS NULL${filter}`, params);
  const rows = await query(`${BASE}${filter} ORDER BY t.created_at DESC LIMIT ? OFFSET ?`, [...params, l, offset]);
  return { results: rows, ...paginate(countRow.total) };
};

// ── Get single with items ─────────────────────────────────────────────────────
const getTransferById = async (id, conn = null) => {
  const exec = conn ? (s, p) => conn.query(s, p).then(([r]) => r) : query;
  const rows = await exec(`${BASE} AND t.transfer_id = ?`, [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Transfer not found');
  const t = rows[0];
  t.items = await exec(
    `SELECT ti.*, p.product_name, p.sku_barcode, p.unit_type,
            si.quantity AS current_stock
     FROM stock_transfer_items ti
     JOIN products p ON p.product_id = ti.product_id
     LEFT JOIN store_inventory si ON si.product_id = ti.product_id AND si.store_id = ?
     WHERE ti.transfer_id = ?`,
    [t.source_store_id, id]
  );
  return t;
};

// ── Create ────────────────────────────────────────────────────────────────────
const createTransfer = async (body, userId) => {
  return transaction(async (conn) => {
    const {
    source_store_id, destination_store_id, transfer_date, notes = null,
    requires_inspection = 1,
    requires_transit = 0, logistics_company_id = null,
    transit_method = null, transit_provider = null,
    tracking_number = null, expected_arrival_date = null,
    vehicle_information = null, driver_information = null, logistics_notes = null,
    items = [],
  } = body;
    if (source_store_id === destination_store_id) throw new ApiError(httpStatus.BAD_REQUEST, 'Source and destination stores must be different');
    if (!items.length) throw new ApiError(httpStatus.BAD_REQUEST, 'At least one item is required');

    // Validate source stock for each item BEFORE creating transfer
    for (const item of items) {
      const [si] = await conn.query(
        'SELECT quantity FROM store_inventory WHERE store_id = ? AND product_id = ?',
        [source_store_id, item.product_id]
      ).then(([rows]) => rows);
      const available = si ? Number(si.quantity) : 0;
      if (available <= 0) {
        const [pRow] = await conn.query('SELECT product_name FROM products WHERE product_id = ?', [item.product_id]).then(([r]) => r);
        throw new ApiError(httpStatus.BAD_REQUEST, `"${pRow?.product_name || 'Product'}" has no available stock in source store`);
      }
      if (parseFloat(item.quantity) > available) {
        const [pRow] = await conn.query('SELECT product_name FROM products WHERE product_id = ?', [item.product_id]).then(([r]) => r);
        throw new ApiError(httpStatus.BAD_REQUEST,
          `Transfer quantity (${item.quantity}) exceeds available stock (${available}) for "${pRow?.product_name || 'Product'}"`
        );
      }
    }

    const number = await generateTransferNumber(conn);
    const [result] = await conn.query(
      `INSERT INTO stock_transfers
         (transfer_number, source_store_id, destination_store_id, transfer_date, notes,
          requires_inspection, requires_transit, transit_method, transit_provider,
          tracking_number, expected_arrival_date, vehicle_information, driver_information,
          logistics_notes, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [number, source_store_id, destination_store_id, transfer_date, notes,
       requires_inspection ? 1 : 0, requires_transit ? 1 : 0,
       transit_method, transit_provider, tracking_number, expected_arrival_date,
       vehicle_information, driver_information, logistics_notes, userId]
    );
    const tid = result.insertId;
    for (const item of items) {
      await conn.query(
        'INSERT INTO stock_transfer_items (transfer_id, product_id, quantity, notes) VALUES (?,?,?,?)',
        [tid, item.product_id, parseFloat(item.quantity), item.notes || null]
      );
    }
    return getTransferById(tid, conn);
  });
};

// ── Update ────────────────────────────────────────────────────────────────────
const updateTransfer = async (id, body, userId) => {
  const t = await getTransferById(id);
  if (!['draft','approved'].includes(t.status)) throw new ApiError(httpStatus.BAD_REQUEST, `Cannot edit transfer with status "${t.status}"`);

  return transaction(async (conn) => {
    const allowed = ['source_store_id','destination_store_id','transfer_date','notes','requires_inspection','requires_transit','logistics_company_id','transit_method','transit_provider','tracking_number','expected_arrival_date','vehicle_information','driver_information','logistics_notes'];
    const fields  = Object.keys(body).filter(k => allowed.includes(k));
    if (fields.length) {
      const set = fields.map(f => `${f} = ?`).join(', ');
      await conn.query(`UPDATE stock_transfers SET ${set}, updated_by = ? WHERE transfer_id = ?`, [...fields.map(f => body[f]), userId, id]);
    }
    if (body.items !== undefined) {
      if (!body.items.length) throw new ApiError(httpStatus.BAD_REQUEST, 'At least one item is required');
      await conn.query('DELETE FROM stock_transfer_items WHERE transfer_id = ?', [id]);
      for (const item of body.items) {
        await conn.query('INSERT INTO stock_transfer_items (transfer_id, product_id, quantity, notes) VALUES (?,?,?,?)',
          [id, item.product_id, parseFloat(item.quantity), item.notes || null]);
      }
    }
    // note: conn.query returns [result, fields] but we don't use return value here
    return getTransferById(id, conn);
  });
};

// ── Approve ───────────────────────────────────────────────────────────────────
const approveTransfer = async (id, userId) => {
  const t = await getTransferById(id);
  if (t.status !== 'draft') throw new ApiError(httpStatus.BAD_REQUEST, 'Only draft transfers can be approved');
  await query("UPDATE stock_transfers SET status='approved', updated_by=? WHERE transfer_id=?", [userId, id]);
  return getTransferById(id);
};

// ── Dispatch — deduct stock from source ───────────────────────────────────────
const dispatchTransfer = async (id, userId) => {
  const t = await getTransferById(id);
  if (t.status !== 'approved') throw new ApiError(httpStatus.BAD_REQUEST, 'Only approved transfers can be dispatched');

  return transaction(async (conn) => {
    // Check sufficient stock for each item
    for (const item of t.items) {
      const [si] = await conn.query(
        'SELECT quantity FROM store_inventory WHERE store_id=? AND product_id=?',
        [t.source_store_id, item.product_id]
      ).then(([r]) => r);
      const avail = si ? Number(si.quantity) : 0;
      if (avail < Number(item.quantity)) {
        throw new ApiError(httpStatus.BAD_REQUEST,
          `Insufficient stock for "${item.product_name}": available ${avail}, required ${item.quantity}`
        );
      }
    }
    // Deduct from source
    for (const item of t.items) {
      await conn.query(
        'UPDATE store_inventory SET quantity = quantity - ? WHERE store_id=? AND product_id=?',
        [item.quantity, t.source_store_id, item.product_id]
      );
      await conn.query(
        `INSERT INTO stock_transactions (transaction_type, store_id, product_id, quantity, source_type, source_id, notes, created_by)
         VALUES ('STOCK_TRANSFER_OUT',?,?,?,'STOCK_TRANSFER',?,?,?)`,
        [t.source_store_id, item.product_id, item.quantity, id, `Dispatched — ${t.transfer_number}`, userId]
      );
    }
    await conn.query(
      "UPDATE stock_transfers SET status='dispatched', dispatched_at=NOW(), dispatched_by=?, updated_by=? WHERE transfer_id=?",
      [userId, userId, id]
    );
    return getTransferById(id);
  });
};

// ── Complete receiving — add to destination after inspection ──────────────────
const receiveTransfer = async (id, inspectionApprovalId, userId) => {
  const t = await getTransferById(id);
  if (!['dispatched','under_inspection','inspection_approved'].includes(t.status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Cannot receive transfer with status "${t.status}"`);
  }
  return transaction(async (conn) => {
    for (const item of t.items) {
      await conn.query(
        `INSERT INTO store_inventory (store_id, product_id, quantity)
         VALUES (?,?,?)
         ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
        [t.destination_store_id, item.product_id, item.quantity]
      );
      await conn.query(
        `INSERT INTO stock_transactions (transaction_type, store_id, product_id, quantity, source_type, source_id, notes, created_by)
         VALUES ('STOCK_TRANSFER_IN',?,?,?,'STOCK_TRANSFER',?,?,?)`,
        [t.destination_store_id, item.product_id, item.quantity, id, `Received — ${t.transfer_number}`, userId]
      );
    }
    await conn.query(
      "UPDATE stock_transfers SET status='received', received_at=NOW(), received_by=?, updated_by=? WHERE transfer_id=?",
      [userId, userId, id]
    );
    return getTransferById(id);
  });
};

const cancelTransfer = async (id, userId) => {
  const t = await getTransferById(id);
  if (['received','closed','cancelled'].includes(t.status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, `Cannot cancel a transfer with status "${t.status}"`);
  }
  // If dispatched, restore stock to source
  if (t.status === 'dispatched') {
    for (const item of t.items) {
      await query('UPDATE store_inventory SET quantity = quantity + ? WHERE store_id=? AND product_id=?', [item.quantity, t.source_store_id, item.product_id]);
      await query(`INSERT INTO stock_transactions (transaction_type, store_id, product_id, quantity, source_type, source_id, notes, created_by)
         VALUES ('ADJUSTMENT',?,?,?,'STOCK_TRANSFER',?,?,?)`,
        [t.source_store_id, item.product_id, item.quantity, id, `Cancelled — stock restored — ${t.transfer_number}`, userId]);
    }
  }
  await query("UPDATE stock_transfers SET status='cancelled', updated_by=? WHERE transfer_id=?", [userId, id]);
  return getTransferById(id);
};

const closeTransfer = async (id, userId) => {
  const t = await getTransferById(id);
  if (t.status !== 'received') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Only received transfers can be closed');
  }
  await query("UPDATE stock_transfers SET status='closed', updated_by=? WHERE transfer_id=?", [userId, id]);
  return getTransferById(id);
};

module.exports = { getTransfers, getTransferById, createTransfer, updateTransfer, approveTransfer, dispatchTransfer, receiveTransfer, closeTransfer, cancelTransfer };
