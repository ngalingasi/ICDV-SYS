const httpStatus = require('http-status');
const { query, transaction } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');

// ── Number generation ─────────────────────────────────────────────────────────
const generateLogisticsNumber = async (conn = null) => {
  const year = new Date().getFullYear();
  const exec = conn ? (s, p) => conn.query(s, p).then(([r]) => r) : query;
  await exec(
    `INSERT INTO logistics_number_sequences (year, last_seq) VALUES (?, 1)
     ON DUPLICATE KEY UPDATE last_seq = last_seq + 1`, [year]
  );
  const [row] = await exec('SELECT last_seq FROM logistics_number_sequences WHERE year = ?', [year]);
  return `LOG-${year}-${String(row.last_seq).padStart(5, '0')}`;
};

// ══════════════════════════════════════════════════════════════════════════════
// LOGISTICS COMPANIES
// ══════════════════════════════════════════════════════════════════════════════

const getCompanies = async ({ page, limit, search, status, company_type }) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  const where = []; const params = [];
  if (search)       { where.push('(lc.company_name LIKE ? OR lc.contact_person LIKE ? OR lc.city LIKE ?)'); const q = `%${search}%`; params.push(q, q, q); }
  if (status)       { where.push('lc.status = ?');       params.push(status); }
  if (company_type) { where.push('lc.company_type = ?'); params.push(company_type); }
  const filter = where.length ? ' WHERE ' + where.join(' AND ') : '';

  const [countRow] = await query(`SELECT COUNT(*) AS total FROM logistics_companies lc${filter}`, params);
  const rows = await query(
    `SELECT lc.*, u.full_name AS created_by_name,
            (SELECT COUNT(*) FROM logistics_transactions lt WHERE lt.logistics_company_id = lc.logistics_company_id) AS shipment_count
     FROM logistics_companies lc
     LEFT JOIN users u ON u.user_id = lc.created_by
     ${filter} ORDER BY lc.created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );
  return { results: rows, ...paginate(countRow.total) };
};

const getCompanyById = async (id) => {
  const rows = await query(
    `SELECT lc.*, u.full_name AS created_by_name FROM logistics_companies lc
     LEFT JOIN users u ON u.user_id = lc.created_by
     WHERE lc.logistics_company_id = ?`, [id]
  );
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Logistics company not found');
  return rows[0];
};

const createCompany = async (body, userId) => {
  const { company_name, company_type, contact_person = null, phone_number = null,
          email = null, address = null, city = null, country = null,
          website = null, tracking_url = null, notes = null, status = 'active' } = body;

  const [exist] = await query('SELECT logistics_company_id FROM logistics_companies WHERE company_name = ?', [company_name]);
  if (exist) throw new ApiError(httpStatus.CONFLICT, 'Company name already exists');

  const result = await query(
    `INSERT INTO logistics_companies
       (company_name, company_type, contact_person, phone_number, email, address,
        city, country, website, tracking_url, notes, status, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [company_name, company_type, contact_person, phone_number, email, address,
     city, country, website, tracking_url, notes, status, userId]
  );
  return getCompanyById(result.insertId);
};

const updateCompany = async (id, body, userId) => {
  await getCompanyById(id);
  const allowed = ['company_name','company_type','contact_person','phone_number','email',
                   'address','city','country','website','tracking_url','notes','status'];
  const fields = Object.keys(body).filter(k => allowed.includes(k));
  if (!fields.length) throw new ApiError(httpStatus.BAD_REQUEST, 'No valid fields to update');
  const set = fields.map(f => `${f} = ?`).join(', ');
  await query(`UPDATE logistics_companies SET ${set}, updated_by = ? WHERE logistics_company_id = ?`,
    [...fields.map(f => body[f]), userId, id]);
  return getCompanyById(id);
};

const deleteCompany = async (id) => {
  await getCompanyById(id);
  const [inUse] = await query('SELECT logistics_transaction_id FROM logistics_transactions WHERE logistics_company_id = ? LIMIT 1', [id]);
  if (inUse) throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot delete company with existing shipments');
  await query('DELETE FROM logistics_companies WHERE logistics_company_id = ?', [id]);
};

// ══════════════════════════════════════════════════════════════════════════════
// LOGISTICS TRANSACTIONS
// ══════════════════════════════════════════════════════════════════════════════

const TXN_BASE = `
  SELECT lt.*,
         lc.company_name AS logistics_company_name, lc.company_type, lc.tracking_url,
         tf.transfer_number,
         u.full_name AS created_by_name
  FROM logistics_transactions lt
  JOIN logistics_companies lc ON lc.logistics_company_id = lt.logistics_company_id
  LEFT JOIN stock_transfers tf ON tf.transfer_id = lt.stock_transfer_id
  LEFT JOIN users u ON u.user_id = lt.created_by`;

const getTransactions = async ({ page, limit, search, status, source_type, logistics_company_id, stock_transfer_id }) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  const where = []; const params = [];
  if (search)               { where.push('(lt.logistics_number LIKE ? OR lt.tracking_number LIKE ? OR lc.company_name LIKE ?)'); const q = `%${search}%`; params.push(q, q, q); }
  if (status)               { where.push('lt.status = ?');               params.push(status); }
  if (source_type)          { where.push('lt.source_type = ?');          params.push(source_type); }
  if (logistics_company_id) { where.push('lt.logistics_company_id = ?'); params.push(parseInt(logistics_company_id, 10)); }
  if (stock_transfer_id)    { where.push('lt.stock_transfer_id = ?');    params.push(parseInt(stock_transfer_id, 10)); }
  const filter = where.length ? ' WHERE ' + where.join(' AND ') : '';

  const [countRow] = await query(`SELECT COUNT(*) AS total FROM logistics_transactions lt JOIN logistics_companies lc ON lc.logistics_company_id = lt.logistics_company_id${filter}`, params);
  const rows = await query(`${TXN_BASE}${filter} ORDER BY lt.created_at DESC LIMIT ? OFFSET ?`, [...params, l, offset]);
  return { results: rows, ...paginate(countRow.total) };
};

const getTransactionById = async (id) => {
  const rows = await query(`${TXN_BASE} WHERE lt.logistics_transaction_id = ?`, [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Logistics transaction not found');
  const txn = rows[0];
  txn.events = await query(
    `SELECT le.*, u.full_name AS created_by_name FROM logistics_events le
     JOIN users u ON u.user_id = le.created_by
     WHERE le.logistics_transaction_id = ? ORDER BY le.event_time ASC`, [id]
  );
  return txn;
};

const createTransaction = async (body, userId) => {
  const {
    source_type = 'TRANSFER', stock_transfer_id = null, logistics_company_id,
    tracking_number = null, external_reference_number = null, shipment_description = null,
    pickup_location, delivery_location, pickup_date = null, dispatch_date = null,
    expected_delivery_date = null, transit_notes = null,
    vehicle_information = null, driver_information = null, status = 'draft',
    shipment_cost = null, currency_code = 'TZS', exchange_rate = 1,
    payment_status = 'pending', payment_reference = null, expense_notes = null,
  } = body;

  await getCompanyById(logistics_company_id); // validate company exists

  const logisticsNumber = await generateLogisticsNumber();
  const baseCostTzs = shipment_cost ? parseFloat(shipment_cost) * parseFloat(exchange_rate) : null;

  const result = await query(
    `INSERT INTO logistics_transactions
       (logistics_number, source_type, stock_transfer_id, logistics_company_id,
        tracking_number, external_reference_number, shipment_description,
        pickup_location, delivery_location, pickup_date, dispatch_date,
        expected_delivery_date, transit_notes, vehicle_information, driver_information,
        shipment_cost, currency_code, exchange_rate, base_cost_tzs,
        payment_status, payment_reference, expense_notes,
        status, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [logisticsNumber, source_type, stock_transfer_id || null, logistics_company_id,
     tracking_number, external_reference_number, shipment_description,
     pickup_location, delivery_location, pickup_date, dispatch_date,
     expected_delivery_date, transit_notes, vehicle_information, driver_information,
     shipment_cost || null, currency_code, exchange_rate,
     baseCostTzs,
     payment_status, payment_reference || null, expense_notes || null,
     status, userId]
  );

  // Log creation event
  await query(
    'INSERT INTO logistics_events (logistics_transaction_id, event_type, event_description, created_by) VALUES (?,?,?,?)',
    [result.insertId, 'created', `Shipment ${logisticsNumber} created`, userId]
  );

  return getTransactionById(result.insertId);
};

const updateTransaction = async (id, body, userId) => {
  const txn = await getTransactionById(id);
  if (txn.status === 'delivered') throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot edit a delivered shipment');
  if (txn.status === 'cancelled') throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot edit a cancelled shipment');

  const allowed = ['source_type','stock_transfer_id','logistics_company_id','tracking_number',
                   'external_reference_number','shipment_description','pickup_location','delivery_location',
                   'pickup_date','dispatch_date','expected_delivery_date','transit_notes',
                   'vehicle_information','driver_information',
                   'shipment_cost','currency_code','exchange_rate','base_cost_tzs',
                   'payment_status','payment_reference','expense_notes'];
  const fields = Object.keys(body).filter(k => allowed.includes(k));
  if (fields.length) {
    const set = fields.map(f => `${f} = ?`).join(', ');
    await query(`UPDATE logistics_transactions SET ${set}, updated_by = ? WHERE logistics_transaction_id = ?`,
      [...fields.map(f => body[f]), userId, id]);
  }
  return getTransactionById(id);
};

// ── Status transitions ────────────────────────────────────────────────────────
const addEvent = (id, type, description, location, userId) =>
  query('INSERT INTO logistics_events (logistics_transaction_id, event_type, event_description, event_location, created_by) VALUES (?,?,?,?,?)',
    [id, type, description, location || null, userId]);

const STATUS_FLOW = ['draft','pending_pickup','picked_up','in_transit','delayed','arrived','delivered'];

const validateTransition = (current, next) => {
  if (current === 'cancelled') throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot update a cancelled shipment');
  if (current === 'delivered') throw new ApiError(httpStatus.BAD_REQUEST, 'Shipment already delivered');
};

const schedulePickup = async (id, body, userId) => {
  const txn = await getTransactionById(id);
  validateTransition(txn.status, 'pending_pickup');
  await query("UPDATE logistics_transactions SET status='pending_pickup', pickup_date=?, updated_by=? WHERE logistics_transaction_id=?",
    [body.pickup_date || null, userId, id]);
  await addEvent(id, 'pickup_scheduled', body.notes || 'Pickup scheduled', body.location, userId);
  return getTransactionById(id);
};

const markPickedUp = async (id, body, userId) => {
  const txn = await getTransactionById(id);
  validateTransition(txn.status, 'picked_up');
  await query("UPDATE logistics_transactions SET status='picked_up', dispatch_date=CURDATE(), updated_by=? WHERE logistics_transaction_id=?", [userId, id]);
  await addEvent(id, 'picked_up', body.notes || 'Shipment picked up', body.location, userId);
  return getTransactionById(id);
};

const markInTransit = async (id, body, userId) => {
  const txn = await getTransactionById(id);
  validateTransition(txn.status, 'in_transit');
  await query("UPDATE logistics_transactions SET status='in_transit', updated_by=? WHERE logistics_transaction_id=?", [userId, id]);
  await addEvent(id, 'in_transit', body.notes || 'Shipment in transit', body.location, userId);
  return getTransactionById(id);
};

const markDelayed = async (id, body, userId) => {
  const txn = await getTransactionById(id);
  validateTransition(txn.status, 'delayed');
  await query("UPDATE logistics_transactions SET status='delayed', updated_by=? WHERE logistics_transaction_id=?", [userId, id]);
  await addEvent(id, 'delayed', body.reason || 'Shipment delayed', body.location, userId);
  return getTransactionById(id);
};

const markArrived = async (id, body, userId) => {
  const txn = await getTransactionById(id);
  validateTransition(txn.status, 'arrived');
  await query("UPDATE logistics_transactions SET status='arrived', updated_by=? WHERE logistics_transaction_id=?", [userId, id]);
  await addEvent(id, 'arrived', body.notes || 'Shipment arrived at destination', body.location, userId);
  return getTransactionById(id);
};

const markDelivered = async (id, body, userId) => {
  const txn = await getTransactionById(id);
  validateTransition(txn.status, 'delivered');
  await query(
    `UPDATE logistics_transactions
     SET status='delivered', actual_delivery_date=CURDATE(), delivered_by=?, delivered_at=NOW(),
         delivery_notes=?, updated_by=?
     WHERE logistics_transaction_id=?`,
    [body.delivered_by || null, body.delivery_notes || null, userId, id]
  );
  await addEvent(id, 'delivered', body.delivery_notes || 'Shipment delivered', body.location, userId);
  return getTransactionById(id);
};

const cancelTransaction = async (id, body, userId) => {
  const txn = await getTransactionById(id);
  if (['delivered','cancelled'].includes(txn.status)) throw new ApiError(httpStatus.BAD_REQUEST, `Cannot cancel a ${txn.status} shipment`);
  await query("UPDATE logistics_transactions SET status='cancelled', updated_by=? WHERE logistics_transaction_id=?", [userId, id]);
  await addEvent(id, 'cancelled', body.reason || 'Shipment cancelled', null, userId);
  return getTransactionById(id);
};

const addNote = async (id, body, userId) => {
  if (!body.note?.trim()) throw new ApiError(httpStatus.BAD_REQUEST, 'Note is required');
  await addEvent(id, 'note', body.note, body.location || null, userId);
  return getTransactionById(id);
};

module.exports = {
  getCompanies, getCompanyById, createCompany, updateCompany, deleteCompany,
  getTransactions, getTransactionById, createTransaction, updateTransaction,
  schedulePickup, markPickedUp, markInTransit, markDelayed, markArrived, markDelivered,
  cancelTransaction, addNote,
};
