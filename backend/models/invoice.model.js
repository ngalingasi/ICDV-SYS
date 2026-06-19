/**
 * invoice.model.js
 *
 * Handles:
 *   - Invoice items catalog (CRUD)
 *   - Invoices (CRUD + approve + cancel + pay)
 *   - Invoice line items
 *   - Invoice payments / evidence
 *   - Operator config (via system_settings)
 *   - Manifest "Close Operation"
 *   - Invoice number generation (DDMMYYYY-NN)
 */

'use strict';

const httpStatus         = require('http-status');
const { query, transaction, connQuery } = require('../config/database');
const ApiError           = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const pad = (n, len = 2) => String(n).padStart(len, '0');

/**
 * Generate invoice number: DDMMYYYY-NN
 * NN is a per-day sequential counter.
 */
const generateInvoiceNumber = async () => {
  const now = new Date();
  const prefix = `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}`;
  const like   = `${prefix}-%`;
  const [{ last }] = await query(
    `SELECT MAX(CAST(SUBSTRING_INDEX(invoice_number, '-', -1) AS UNSIGNED)) AS last
     FROM invoices WHERE invoice_number LIKE ?`,
    [like]
  );
  const seq = (last || 0) + 1;
  return `${prefix}-${pad(seq, 2)}`;
};

const recalcTotals = (lines, whtRate) => {
  const subtotal            = lines.reduce((s, l) => s + Number(l.line_total), 0);
  const withholding_tax_amount = parseFloat((subtotal * (whtRate / 100)).toFixed(2));
  const total_amount        = parseFloat((subtotal - withholding_tax_amount).toFixed(2));
  return { subtotal: parseFloat(subtotal.toFixed(2)), withholding_tax_amount, total_amount };
};

// ─────────────────────────────────────────────────────────────────────────────
// OPERATOR CONFIG  (via system_settings)
// ─────────────────────────────────────────────────────────────────────────────

const OPERATOR_KEYS = [
  'operator_name', 'operator_address', 'operator_phone', 'operator_email',
  'operator_tin',  'operator_vrn',
  'operator_bank_name', 'operator_bank_account', 'operator_bank_branch',
];

const getOperatorConfig = async () => {
  const rows = await query(
    `SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN (${OPERATOR_KEYS.map(() => '?').join(',')})`,
    OPERATOR_KEYS
  );
  const config = {};
  for (const k of OPERATOR_KEYS) config[k.replace('operator_', '')] = '';
  for (const r of rows) config[r.setting_key.replace('operator_', '')] = r.setting_value ?? '';
  return config;
};

const updateOperatorConfig = async (body, updatedBy) => {
  const allowed = OPERATOR_KEYS.map(k => k.replace('operator_', ''));
  for (const key of allowed) {
    if (body[key] !== undefined) {
      const settingKey = `operator_${key}`;
      await query(
        `INSERT INTO system_settings (setting_key, setting_value, updated_by, updated_at)
         VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value), updated_by=VALUES(updated_by), updated_at=NOW()`,
        [settingKey, String(body[key]), updatedBy]
      );
    }
  }
  return getOperatorConfig();
};

// ─────────────────────────────────────────────────────────────────────────────
// INVOICE ITEMS CATALOG
// ─────────────────────────────────────────────────────────────────────────────

const createInvoiceItem = async (body, createdBy) => {
  const { name, description = null, default_rate = 0, unit = 'vehicle', status = 'active' } = body;
  const r = await query(
    `INSERT INTO invoice_items (name, description, default_rate, unit, status, created_by)
     VALUES (?,?,?,?,?,?)`,
    [name, description, parseFloat(default_rate), unit, status, createdBy]
  );
  return getInvoiceItemById(r.insertId);
};

const getInvoiceItems = async ({ status } = {}) => {
  let sql = 'SELECT * FROM invoice_items';
  const params = [];
  if (status) { sql += ' WHERE status=?'; params.push(status); }
  sql += ' ORDER BY name';
  return query(sql, params);
};

const getInvoiceItemById = async (id) => {
  const [row] = await query('SELECT * FROM invoice_items WHERE item_id=?', [id]);
  if (!row) throw new ApiError(httpStatus.NOT_FOUND, 'Invoice item not found');
  return row;
};

const updateInvoiceItem = async (id, body, updatedBy) => {
  await getInvoiceItemById(id);
  const fields = []; const params = [];
  const allowed = ['name', 'description', 'default_rate', 'unit', 'status'];
  for (const k of allowed) {
    if (body[k] !== undefined) { fields.push(`${k}=?`); params.push(body[k]); }
  }
  if (!fields.length) return getInvoiceItemById(id);
  fields.push('updated_by=?');
  params.push(updatedBy, id);
  await query(`UPDATE invoice_items SET ${fields.join(',')} WHERE item_id=?`, params);
  return getInvoiceItemById(id);
};

const deleteInvoiceItem = async (id) => {
  await getInvoiceItemById(id);
  // Soft-delete to preserve history on existing invoices
  await query(`UPDATE invoice_items SET status='inactive' WHERE item_id=?`, [id]);
};

// ─────────────────────────────────────────────────────────────────────────────
// MANIFEST VEHICLE COUNT HELPER
// ─────────────────────────────────────────────────────────────────────────────

const getManifestVehicleCount = async (manifestId) => {
  const [{ total }] = await query(
    'SELECT COUNT(*) AS total FROM vehicles WHERE manifest_id=?', [manifestId]);
  return Number(total);
};

// ─────────────────────────────────────────────────────────────────────────────
// INVOICES
// ─────────────────────────────────────────────────────────────────────────────

const getInvoiceById = async (id, icdvId = null) => {
  const where = icdvId ? 'inv.invoice_id=? AND inv.icdv_id=?' : 'inv.invoice_id=?';
  const params = icdvId ? [id, icdvId] : [id];
  const [inv] = await query(
    `SELECT inv.*,
       i.name AS icdv_name, i.address AS icdv_address, i.phone AS icdv_phone,
       i.email AS icdv_email, i.tin AS icdv_tin, i.vrn AS icdv_vrn,
       ua.full_name AS approved_by_name,
       uc.full_name AS created_by_name,
       up.full_name AS paid_by_name
     FROM invoices inv
     JOIN icdvs i ON i.icdv_id = inv.icdv_id
     LEFT JOIN users ua ON ua.user_id = inv.approved_by
     LEFT JOIN users uc ON uc.user_id = inv.created_by
     LEFT JOIN users up ON up.user_id = inv.paid_by
     WHERE ${where}`,
    params
  );
  if (!inv) throw new ApiError(httpStatus.NOT_FOUND, 'Invoice not found');

  // Line items
  inv.line_items = await query(
    `SELECT il.*,
       ii.name AS catalog_item_name,
       m.manifest_number, m.arrival_date
     FROM invoice_line_items il
     LEFT JOIN invoice_items ii ON ii.item_id = il.item_id
     LEFT JOIN manifests m      ON m.manifest_id = il.manifest_id
     WHERE il.invoice_id=?
     ORDER BY il.sort_order, il.line_id`,
    [id]
  );

  // Payment evidence
  inv.payments = await query(
    `SELECT ip.*, u.full_name AS paid_by_name
     FROM invoice_payments ip
     LEFT JOIN users u ON u.user_id = ip.paid_by
     WHERE ip.invoice_id=? ORDER BY ip.created_at DESC`,
    [id]
  );

  return inv;
};

const getInvoices = async ({ page, limit, icdv_id, status, date_from, date_to, search } = {}, scopeIcdvId = null) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  let where = '1=1'; const params = [];
  // Scope: ICDV users see only their invoices
  if (scopeIcdvId !== null) { where += ' AND inv.icdv_id=?'; params.push(scopeIcdvId); }
  else if (icdv_id)         { where += ' AND inv.icdv_id=?'; params.push(icdv_id); }
  if (status)    { where += ' AND inv.status=?';                    params.push(status); }
  if (date_from) { where += ' AND DATE(inv.issued_date)>=?';        params.push(date_from); }
  if (date_to)   { where += ' AND DATE(inv.issued_date)<=?';        params.push(date_to); }
  if (search)    {
    where += ' AND (inv.invoice_number LIKE ? OR i.name LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM invoices inv JOIN icdvs i ON i.icdv_id=inv.icdv_id WHERE ${where}`,
    params
  );

  const rows = await query(
    `SELECT inv.*, i.name AS icdv_name, i.tin AS icdv_tin, i.vrn AS icdv_vrn,
       ua.full_name AS approved_by_name, uc.full_name AS created_by_name,
       (SELECT COUNT(*) FROM invoice_line_items il WHERE il.invoice_id=inv.invoice_id) AS line_count
     FROM invoices inv
     JOIN icdvs i ON i.icdv_id=inv.icdv_id
     LEFT JOIN users ua ON ua.user_id=inv.approved_by
     LEFT JOIN users uc ON uc.user_id=inv.created_by
     WHERE ${where}
     ORDER BY inv.issued_date DESC, inv.invoice_id DESC
     LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );

  return paginate(rows, total);
};

const createInvoice = async (body, createdBy) => {
  const {
    icdv_id, issued_date, due_date = null,
    notes = null,
    withholding_tax_rate = 5,
    line_items = [],   // array of { item_id?, manifest_id?, description, unit, quantity, unit_price, sort_order? }
  } = body;

  if (!icdv_id)     throw new ApiError(httpStatus.BAD_REQUEST, 'icdv_id is required');
  if (!issued_date) throw new ApiError(httpStatus.BAD_REQUEST, 'issued_date is required');
  if (!line_items.length) throw new ApiError(httpStatus.BAD_REQUEST, 'At least one line item is required');

  const invoice_number = await generateInvoiceNumber();
  const whtRate = parseFloat(withholding_tax_rate) || 5;

  // Calculate line totals
  const preparedLines = line_items.map((l, idx) => {
    const qty   = parseFloat(l.quantity)   || 0;
    const price = parseFloat(l.unit_price) || 0;
    return {
      item_id:     l.item_id     || null,
      manifest_id: l.manifest_id || null,
      description: l.description || '',
      unit:        l.unit        || 'vehicle',
      quantity:    qty,
      unit_price:  price,
      line_total:  parseFloat((qty * price).toFixed(2)),
      sort_order:  l.sort_order  ?? idx,
    };
  });

  const { subtotal, withholding_tax_amount, total_amount } = recalcTotals(preparedLines, whtRate);

  return transaction(async (conn) => {
    const r = await connQuery(conn,
      `INSERT INTO invoices
         (invoice_number, icdv_id, issued_date, due_date, notes,
          withholding_tax_rate, subtotal, withholding_tax_amount, total_amount, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [invoice_number, icdv_id, issued_date, due_date, notes,
       whtRate, subtotal, withholding_tax_amount, total_amount, createdBy]
    );
    const invoiceId = r.insertId;

    for (const line of preparedLines) {
      await connQuery(conn,
        `INSERT INTO invoice_line_items
           (invoice_id, item_id, manifest_id, description, unit, quantity, unit_price, line_total, sort_order)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [invoiceId, line.item_id, line.manifest_id, line.description,
         line.unit, line.quantity, line.unit_price, line.line_total, line.sort_order]
      );
    }

    return getInvoiceById(invoiceId);
  });
};

const updateInvoice = async (id, body, updatedBy, icdvId = null) => {
  const inv = await getInvoiceById(id, icdvId);
  if (inv.status !== 'draft')
    throw new ApiError(httpStatus.CONFLICT, 'Only draft invoices can be edited');

  const whtRate = body.withholding_tax_rate !== undefined
    ? parseFloat(body.withholding_tax_rate)
    : parseFloat(inv.withholding_tax_rate);

  return transaction(async (conn) => {
    // Update header fields
    const hFields = []; const hParams = [];
    const hAllowed = ['due_date', 'notes', 'withholding_tax_rate'];
    for (const k of hAllowed) {
      if (body[k] !== undefined) { hFields.push(`${k}=?`); hParams.push(body[k]); }
    }

    // Replace line items if provided
    let lines = inv.line_items;
    if (body.line_items) {
      await connQuery(conn, 'DELETE FROM invoice_line_items WHERE invoice_id=?', [id]);
      lines = [];
      for (const [idx, l] of body.line_items.entries()) {
        const qty   = parseFloat(l.quantity)   || 0;
        const price = parseFloat(l.unit_price) || 0;
        const lineTotal = parseFloat((qty * price).toFixed(2));
        await connQuery(conn,
          `INSERT INTO invoice_line_items
             (invoice_id, item_id, manifest_id, description, unit, quantity, unit_price, line_total, sort_order)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          [id, l.item_id || null, l.manifest_id || null, l.description || '',
           l.unit || 'vehicle', qty, price, lineTotal, l.sort_order ?? idx]
        );
        lines.push({ line_total: lineTotal });
      }
    }

    const { subtotal, withholding_tax_amount, total_amount } = recalcTotals(lines, whtRate);
    hFields.push('subtotal=?', 'withholding_tax_amount=?', 'total_amount=?', 'updated_by=?');
    hParams.push(subtotal, withholding_tax_amount, total_amount, updatedBy, id);
    await connQuery(conn, `UPDATE invoices SET ${hFields.join(',')} WHERE invoice_id=?`, hParams);

    return getInvoiceById(id);
  });
};

const approveInvoice = async (id, approvedBy) => {
  const inv = await getInvoiceById(id);
  if (inv.status !== 'draft')
    throw new ApiError(httpStatus.CONFLICT, `Invoice is ${inv.status} — only draft invoices can be approved`);
  await query(
    `UPDATE invoices SET status='approved', approved_by=?, approved_at=NOW() WHERE invoice_id=?`,
    [approvedBy, id]
  );
  return getInvoiceById(id);
};

const cancelInvoice = async (id, cancelledBy, reason = null) => {
  const inv = await getInvoiceById(id);
  if (inv.status === 'paid')
    throw new ApiError(httpStatus.CONFLICT, 'Paid invoices cannot be cancelled');
  await query(
    `UPDATE invoices SET status='cancelled', cancelled_by=?, cancelled_at=NOW(), cancellation_reason=? WHERE invoice_id=?`,
    [cancelledBy, reason, id]
  );
  return getInvoiceById(id);
};

// ─────────────────────────────────────────────────────────────────────────────
// BILLING — Mark as Paid + Evidence Upload
// ─────────────────────────────────────────────────────────────────────────────

const markAsPaid = async (id, paidBy, icdvId = null) => {
  const inv = await getInvoiceById(id, icdvId);
  if (inv.status !== 'approved')
    throw new ApiError(httpStatus.CONFLICT, 'Only approved invoices can be marked as paid');
  await query(
    `UPDATE invoices SET status='paid', paid_by=?, paid_at=NOW() WHERE invoice_id=?`,
    [paidBy, id]
  );
  return getInvoiceById(id);
};

const addPaymentEvidence = async (invoiceId, { filePath, fileName, notes = null }, uploadedBy, icdvId = null) => {
  const inv = await getInvoiceById(invoiceId, icdvId);
  if (!['approved', 'paid'].includes(inv.status))
    throw new ApiError(httpStatus.CONFLICT, 'Evidence can only be attached to approved or paid invoices');
  const r = await query(
    `INSERT INTO invoice_payments (invoice_id, paid_by, evidence_path, evidence_name, notes)
     VALUES (?,?,?,?,?)`,
    [invoiceId, uploadedBy, filePath, fileName, notes]
  );
  const [row] = await query('SELECT * FROM invoice_payments WHERE payment_id=?', [r.insertId]);
  return row;
};

// ─────────────────────────────────────────────────────────────────────────────
// MANIFEST CLOSE OPERATION
// ─────────────────────────────────────────────────────────────────────────────

const BLOCKING_STATUSES = ['in_transit', 'batched', 'discharged'];

const closeManifestOperation = async (manifestId, closedBy) => {
  // Load manifest
  const [manifest] = await query('SELECT * FROM manifests WHERE manifest_id=?', [manifestId]);
  if (!manifest) throw new ApiError(httpStatus.NOT_FOUND, 'Manifest not found');
  if (manifest.status === 'closed')
    throw new ApiError(httpStatus.CONFLICT, 'Manifest is already closed');
  if (manifest.status === 'cancelled')
    throw new ApiError(httpStatus.CONFLICT, 'Cancelled manifests cannot be closed');

  // Check for blocking vehicles — in_transit / batched / discharged block closing
  const placeholders = BLOCKING_STATUSES.map(() => '?').join(',');
  const [{ blocking }] = await query(
    `SELECT COUNT(*) AS blocking FROM vehicles
     WHERE manifest_id=? AND workflow_status IN (${placeholders})`,
    [manifestId, ...BLOCKING_STATUSES]
  );

  if (Number(blocking) > 0) {
    throw new ApiError(
      httpStatus.CONFLICT,
      `Cannot close: ${blocking} vehicle(s) are still in active workflow ` +
      `(in_transit / batched / discharged). Complete or return these vehicles first.`
    );
  }

  await query(
    `UPDATE manifests SET status='closed', closed_by=?, closed_at=NOW() WHERE manifest_id=?`,
    [closedBy, manifestId]
  );

  const [updated] = await query('SELECT * FROM manifests WHERE manifest_id=?', [manifestId]);
  return updated;
};

// ─────────────────────────────────────────────────────────────────────────────
// PDF DATA — everything needed to render an invoice PDF
// ─────────────────────────────────────────────────────────────────────────────

const getInvoicePrintData = async (id, icdvId = null) => {
  const [inv, operator] = await Promise.all([
    getInvoiceById(id, icdvId),
    getOperatorConfig(),
  ]);
  return { invoice: inv, operator };
};

// ─────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Operator config
  getOperatorConfig, updateOperatorConfig,
  // Invoice items catalog
  createInvoiceItem, getInvoiceItems, getInvoiceItemById, updateInvoiceItem, deleteInvoiceItem,
  // Invoices
  generateInvoiceNumber,
  createInvoice, getInvoices, getInvoiceById, updateInvoice,
  approveInvoice, cancelInvoice,
  // Billing
  markAsPaid, addPaymentEvidence,
  // Manifest
  closeManifestOperation,
  getManifestVehicleCount,
  // PDF
  getInvoicePrintData,
};
