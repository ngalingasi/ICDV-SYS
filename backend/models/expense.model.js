/**
 * expense.model.js
 *
 * Handles:
 *   - Expense items catalog (CRUD) — managed in Lookups
 *   - Expenses (CRUD, no approval workflow) — one per manifest
 *   - Expense line items (each with its own shift_count multiplier)
 *   - Expense number generation (DDMMYYYY-NN, same convention as invoices)
 *
 * Entire module is super_admin only (gated by the manageExpenses right
 * at the route level) — there is no ICDV-side access at all.
 */

'use strict';

const httpStatus          = require('http-status');
const { query, transaction, connQuery } = require('../config/database');
const ApiError             = require('../utils/ApiError');
const { buildPagination }  = require('../utils/paginate');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const pad = (n, len = 2) => String(n).padStart(len, '0');

/**
 * Generate expense number: DDMMYYYY-NN (same convention as invoices)
 * NN is a per-day sequential counter.
 */
const generateExpenseNumber = async () => {
  const now = new Date();
  const prefix = `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}`;
  const like   = `${prefix}-%`;
  const [{ last }] = await query(
    `SELECT MAX(CAST(SUBSTRING_INDEX(expense_number, '-', -1) AS UNSIGNED)) AS last
     FROM expenses WHERE expense_number LIKE ?`,
    [like]
  );
  const seq = (last || 0) + 1;
  return `${prefix}-${pad(seq, 2)}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSE ITEMS CATALOG
// ─────────────────────────────────────────────────────────────────────────────

const createExpenseItem = async (body, createdBy) => {
  const { name, description = null, default_rate = 0, unit = 'unit', status = 'active' } = body;
  if (!name) throw new ApiError(httpStatus.BAD_REQUEST, 'Expense item name is required');

  const r = await query(
    `INSERT INTO expense_items (name, description, default_rate, unit, status, created_by)
     VALUES (?,?,?,?,?,?)`,
    [name, description, parseFloat(default_rate) || 0, unit, status, createdBy]
  );
  return getExpenseItemById(r.insertId);
};

const getExpenseItems = async ({ status } = {}) => {
  let sql = 'SELECT * FROM expense_items';
  const params = [];
  if (status) { sql += ' WHERE status=?'; params.push(status); }
  sql += ' ORDER BY name';
  return query(sql, params);
};

const getExpenseItemById = async (id) => {
  const [row] = await query('SELECT * FROM expense_items WHERE item_id=?', [id]);
  if (!row) throw new ApiError(httpStatus.NOT_FOUND, 'Expense item not found');
  return row;
};

const updateExpenseItem = async (id, body, updatedBy) => {
  await getExpenseItemById(id);
  const fields = []; const params = [];
  const allowed = ['name', 'description', 'default_rate', 'unit', 'status'];
  for (const k of allowed) {
    if (body[k] !== undefined) { fields.push(`${k}=?`); params.push(body[k]); }
  }
  if (!fields.length) return getExpenseItemById(id);
  fields.push('updated_by=?');
  params.push(updatedBy, id);
  await query(`UPDATE expense_items SET ${fields.join(',')} WHERE item_id=?`, params);
  return getExpenseItemById(id);
};

const deleteExpenseItem = async (id) => {
  await getExpenseItemById(id);
  // Soft-delete to preserve history on existing expenses
  await query(`UPDATE expense_items SET status='inactive' WHERE item_id=?`, [id]);
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPENSES
// ─────────────────────────────────────────────────────────────────────────────

const getExpenseById = async (id) => {
  const [exp] = await query(
    `SELECT e.*,
       m.manifest_number, m.arrival_date, m.status AS manifest_status,
       i.name AS icdv_name, i.code AS icdv_code,
       uc.full_name AS created_by_name,
       uu.full_name AS updated_by_name
     FROM expenses e
     JOIN manifests m ON m.manifest_id = e.manifest_id
     JOIN icdvs i      ON i.icdv_id    = e.icdv_id
     LEFT JOIN users uc ON uc.user_id  = e.created_by
     LEFT JOIN users uu ON uu.user_id  = e.updated_by
     WHERE e.expense_id=?`,
    [id]
  );
  if (!exp) throw new ApiError(httpStatus.NOT_FOUND, 'Expense not found');

  exp.line_items = await query(
    `SELECT el.*, ei.name AS catalog_item_name
     FROM expense_line_items el
     LEFT JOIN expense_items ei ON ei.item_id = el.item_id
     WHERE el.expense_id=?
     ORDER BY el.sort_order, el.line_id`,
    [id]
  );

  return exp;
};

const getExpenses = async ({ page, limit, icdv_id, manifest_id, date_from, date_to, search } = {}) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  let where = '1=1'; const params = [];
  if (icdv_id)     { where += ' AND e.icdv_id=?';     params.push(icdv_id); }
  if (manifest_id) { where += ' AND e.manifest_id=?'; params.push(manifest_id); }
  if (date_from)   { where += ' AND DATE(e.expense_date)>=?'; params.push(date_from); }
  if (date_to)     { where += ' AND DATE(e.expense_date)<=?'; params.push(date_to); }
  if (search)      {
    where += ' AND (e.expense_number LIKE ? OR m.manifest_number LIKE ? OR i.name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM expenses e
     JOIN manifests m ON m.manifest_id=e.manifest_id
     JOIN icdvs i      ON i.icdv_id=e.icdv_id
     WHERE ${where}`,
    params
  );

  const [sums] = await query(
    `SELECT COALESCE(SUM(e.total_amount), 0) AS grand_total
     FROM expenses e
     JOIN manifests m ON m.manifest_id=e.manifest_id
     JOIN icdvs i      ON i.icdv_id=e.icdv_id
     WHERE ${where}`,
    params
  );

  const rows = await query(
    `SELECT e.*, m.manifest_number, i.name AS icdv_name,
       uc.full_name AS created_by_name,
       (SELECT COUNT(*) FROM expense_line_items el WHERE el.expense_id=e.expense_id) AS line_count
     FROM expenses e
     JOIN manifests m ON m.manifest_id=e.manifest_id
     JOIN icdvs i      ON i.icdv_id=e.icdv_id
     LEFT JOIN users uc ON uc.user_id=e.created_by
     WHERE ${where}
     ORDER BY e.expense_date DESC, e.expense_id DESC
     LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );

  const result = paginate(rows, total);
  result.grand_total = Number(sums.grand_total);
  return result;
};

const createExpense = async (body, createdBy) => {
  const {
    manifest_id, expense_date, notes = null,
    line_items = [],   // array of { item_id?, description, shift_count?, unit, quantity, unit_price, sort_order? }
  } = body;

  if (!manifest_id)   throw new ApiError(httpStatus.BAD_REQUEST, 'manifest_id is required');
  if (!expense_date)  throw new ApiError(httpStatus.BAD_REQUEST, 'expense_date is required');
  if (!line_items.length) throw new ApiError(httpStatus.BAD_REQUEST, 'At least one line item is required');

  // Resolve the manifest's ICDV (denormalized onto the expense for fast scoping)
  const [manifest] = await query('SELECT manifest_id, icdv_id, status FROM manifests WHERE manifest_id=?', [manifest_id]);
  if (!manifest) throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid manifest_id');
  if (manifest.status === 'closed')
    throw new ApiError(httpStatus.CONFLICT, 'This manifest is closed — expenses can no longer be recorded against it');

  const expense_number = await generateExpenseNumber();

  const preparedLines = line_items.map((l, idx) => {
    const qty    = parseFloat(l.quantity)     || 0;
    const price  = parseFloat(l.unit_price)   || 0;
    // shift_count multiplies into the total — defaults to 1 (not required)
    // so flat/fixed line items (no shift concept) are unaffected.
    const shifts = l.shift_count !== undefined && l.shift_count !== null && l.shift_count !== ''
      ? parseFloat(l.shift_count) || 1
      : 1;
    return {
      item_id:      l.item_id      || null,
      description:  l.description  || '',
      shift_count:  shifts,
      unit:         l.unit         || 'unit',
      quantity:     qty,
      unit_price:   price,
      line_total:   parseFloat((qty * price * shifts).toFixed(2)),
      sort_order:   l.sort_order   ?? idx,
    };
  });

  const total_amount = parseFloat(preparedLines.reduce((s, l) => s + l.line_total, 0).toFixed(2));

  return transaction(async (conn) => {
    const r = await connQuery(conn,
      `INSERT INTO expenses (expense_number, manifest_id, icdv_id, expense_date, notes, total_amount, created_by)
       VALUES (?,?,?,?,?,?,?)`,
      [expense_number, manifest_id, manifest.icdv_id, expense_date, notes, total_amount, createdBy]
    );
    const expenseId = r.insertId;

    for (const line of preparedLines) {
      await connQuery(conn,
        `INSERT INTO expense_line_items
           (expense_id, item_id, description, shift_count, unit, quantity, unit_price, line_total, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [expenseId, line.item_id, line.description, line.shift_count,
         line.unit, line.quantity, line.unit_price, line.line_total, line.sort_order]
      );
    }

    return expenseId;
  }).then(expenseId => getExpenseById(expenseId));
};

const updateExpense = async (id, body, updatedBy) => {
  const existing = await getExpenseById(id); // existence check, also gives us the current manifest's status

  const { manifest_id, expense_date, notes, line_items } = body;

  if (existing.manifest_status === 'closed' && manifest_id === undefined)
    throw new ApiError(httpStatus.CONFLICT, 'This manifest is closed — its expenses can no longer be edited');

  return transaction(async (conn) => {
    // If manifest_id is changing, re-resolve icdv_id too
    let icdvIdUpdate = null;
    if (manifest_id !== undefined) {
      const [manifest] = await connQuery(conn, 'SELECT manifest_id, icdv_id, status FROM manifests WHERE manifest_id=?', [manifest_id]);
      if (!manifest) throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid manifest_id');
      if (manifest.status === 'closed')
        throw new ApiError(httpStatus.CONFLICT, 'That manifest is closed — expenses can no longer be recorded against it');
      icdvIdUpdate = manifest.icdv_id;
    }

    let preparedLines = null;
    let total_amount  = null;
    if (Array.isArray(line_items)) {
      if (!line_items.length) throw new ApiError(httpStatus.BAD_REQUEST, 'At least one line item is required');
      preparedLines = line_items.map((l, idx) => {
        const qty    = parseFloat(l.quantity)   || 0;
        const price  = parseFloat(l.unit_price) || 0;
        const shifts = l.shift_count !== undefined && l.shift_count !== null && l.shift_count !== ''
          ? parseFloat(l.shift_count) || 1
          : 1;
        return {
          item_id:      l.item_id      || null,
          description:  l.description  || '',
          shift_count:  shifts,
          unit:         l.unit         || 'unit',
          quantity:     qty,
          unit_price:   price,
          line_total:   parseFloat((qty * price * shifts).toFixed(2)),
          sort_order:   l.sort_order   ?? idx,
        };
      });
      total_amount = parseFloat(preparedLines.reduce((s, l) => s + l.line_total, 0).toFixed(2));
    }

    const fields = []; const params = [];
    if (manifest_id !== undefined)  { fields.push('manifest_id=?'); params.push(manifest_id); }
    if (icdvIdUpdate !== null)      { fields.push('icdv_id=?');     params.push(icdvIdUpdate); }
    if (expense_date !== undefined) { fields.push('expense_date=?'); params.push(expense_date); }
    if (notes !== undefined)        { fields.push('notes=?');       params.push(notes); }
    if (total_amount !== null)      { fields.push('total_amount=?'); params.push(total_amount); }
    if (fields.length) {
      fields.push('updated_by=?');
      params.push(updatedBy, id);
      await connQuery(conn, `UPDATE expenses SET ${fields.join(',')} WHERE expense_id=?`, params);
    }

    if (preparedLines) {
      await connQuery(conn, 'DELETE FROM expense_line_items WHERE expense_id=?', [id]);
      for (const line of preparedLines) {
        await connQuery(conn,
          `INSERT INTO expense_line_items
             (expense_id, item_id, description, shift_count, unit, quantity, unit_price, line_total, sort_order)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [id, line.item_id, line.description, line.shift_count,
           line.unit, line.quantity, line.unit_price, line.line_total, line.sort_order]
        );
      }
    }

    return id;
  }).then(expenseId => getExpenseById(expenseId));
};

const deleteExpense = async (id) => {
  const existing = await getExpenseById(id); // existence check
  if (existing.manifest_status === 'closed')
    throw new ApiError(httpStatus.CONFLICT, 'This manifest is closed — its expenses can no longer be deleted');
  await query('DELETE FROM expenses WHERE expense_id=?', [id]); // line items cascade via FK
};

module.exports = {
  // Catalog
  createExpenseItem, getExpenseItems, getExpenseItemById, updateExpenseItem, deleteExpenseItem,
  // Expenses
  generateExpenseNumber,
  createExpense, getExpenses, getExpenseById, updateExpense, deleteExpense,
};
