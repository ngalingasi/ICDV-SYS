/**
 * fuel.model.js
 *
 * Manages the fuel stock ledger for ICDV manifests.
 *
 * Stock flow:
 *   1. fuel_officer creates an order → status='pending', stock unchanged
 *   2. supervisor/admin approves    → status='approved', stock increments atomically
 *   3. supervisor/admin rejects     → status='rejected', stock unchanged
 *   4. fuel_officer dispenses       → current_stock decremented, vehicle_fuel_records inserted
 *                                     blocked if current_stock < litres_dispensed
 *
 * Stock is tracked per (manifest_id, fuel_type) independently.
 * Diesel and petrol never share a stock row.
 */

const httpStatus = require('http-status');
const { query, transaction } = require('../config/database');
const ApiError = require('../utils/ApiError');

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Upsert the stock row for a manifest+fuel_type.
 * delta > 0 = stock added (on approval)
 * delta < 0 = stock consumed (on dispense)
 * Always runs inside a transaction with a FOR UPDATE lock on the stock row.
 */
const adjustStock = async (conn, manifestId, icdvId, fuelType, orderedDelta, dispensedDelta) => {
  const exec = (sql, p) => conn.query(sql, p).then(([r]) => r);

  // Upsert stock row — create if first order for this manifest+fuelType
  await exec(
    `INSERT INTO manifest_fuel_stock
       (manifest_id, fuel_type, icdv_id, total_ordered, total_dispensed, current_stock)
     VALUES (?, ?, ?, 0, 0, 0)
     ON DUPLICATE KEY UPDATE manifest_id = manifest_id`,
    [manifestId, fuelType, icdvId]
  );

  // Lock row for update
  const [stock] = await exec(
    `SELECT * FROM manifest_fuel_stock
     WHERE manifest_id=? AND fuel_type=? FOR UPDATE`,
    [manifestId, fuelType]
  );

  const newOrdered    = parseFloat(stock.total_ordered)    + orderedDelta;
  const newDispensed  = parseFloat(stock.total_dispensed)  + dispensedDelta;
  const newCurrent    = parseFloat(stock.current_stock)    + orderedDelta - dispensedDelta;

  if (newCurrent < 0) {
    throw new ApiError(
      httpStatus.UNPROCESSABLE_ENTITY,
      `Insufficient ${fuelType} stock — available: ${stock.current_stock.toFixed(2)}L`
    );
  }

  await exec(
    `UPDATE manifest_fuel_stock
     SET total_ordered=?, total_dispensed=?, current_stock=?, updated_at=NOW()
     WHERE manifest_id=? AND fuel_type=?`,
    [newOrdered, newDispensed, newCurrent, manifestId, fuelType]
  );

  return { total_ordered: newOrdered, total_dispensed: newDispensed, current_stock: newCurrent };
};

// ── Validate manifest belongs to ICDV ─────────────────────────────────────────
const getManifest = async (manifestId, icdvId) => {
  const where = icdvId ? 'WHERE m.manifest_id=? AND m.icdv_id=?' : 'WHERE m.manifest_id=?';
  const params = icdvId ? [manifestId, icdvId] : [manifestId];
  const [m] = await query(
    `SELECT m.manifest_id, m.icdv_id, m.manifest_number, m.status,
            ic.name AS icdv_name
     FROM manifests m
     LEFT JOIN icdvs ic ON ic.icdv_id = m.icdv_id
     ${where}`,
    params
  );
  if (!m) throw new ApiError(httpStatus.NOT_FOUND, 'Manifest not found');
  return m;
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. FUEL ORDERS
// ─────────────────────────────────────────────────────────────────────────────

const createFuelOrder = async (manifestId, { fuel_type, ordered_litres, notes }, userId, icdvId) => {
  const manifest = await getManifest(manifestId, icdvId);
  const litres = parseFloat(ordered_litres);
  if (!litres || litres <= 0) throw new ApiError(httpStatus.BAD_REQUEST, 'ordered_litres must be > 0');
  if (!['diesel', 'petrol'].includes(fuel_type))
    throw new ApiError(httpStatus.BAD_REQUEST, 'fuel_type must be diesel or petrol');

  const result = await query(
    `INSERT INTO manifest_fuel_orders
       (manifest_id, icdv_id, fuel_type, ordered_litres, status, notes, ordered_by)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
    [manifest.manifest_id, manifest.icdv_id, fuel_type, litres, notes || null, userId]
  );

  return getFuelOrder(result.insertId, manifest.icdv_id);
};

const getFuelOrder = async (orderId, icdvId = null) => {
  const scopeClause = icdvId ? ' AND o.icdv_id=?' : '';
  const params = icdvId ? [orderId, icdvId] : [orderId];
  const [o] = await query(
    `SELECT o.*,
            u1.full_name AS ordered_by_name,
            u2.full_name AS reviewed_by_name,
            m.manifest_number
     FROM manifest_fuel_orders o
     LEFT JOIN users u1 ON u1.user_id = o.ordered_by
     LEFT JOIN users u2 ON u2.user_id = o.reviewed_by
     LEFT JOIN manifests m ON m.manifest_id = o.manifest_id
     WHERE o.order_id=?${scopeClause}`,
    params
  );
  if (!o) throw new ApiError(httpStatus.NOT_FOUND, 'Fuel order not found');
  return o;
};

const listFuelOrders = async (manifestId, icdvId = null, { status, fuel_type } = {}) => {
  const where = ['o.manifest_id=?'];
  const params = [manifestId];
  if (icdvId)    { where.push('o.icdv_id=?');   params.push(icdvId); }
  if (status)    { where.push('o.status=?');     params.push(status); }
  if (fuel_type) { where.push('o.fuel_type=?');  params.push(fuel_type); }

  return query(
    `SELECT o.*,
            u1.full_name AS ordered_by_name,
            u2.full_name AS reviewed_by_name
     FROM manifest_fuel_orders o
     LEFT JOIN users u1 ON u1.user_id = o.ordered_by
     LEFT JOIN users u2 ON u2.user_id = o.reviewed_by
     WHERE ${where.join(' AND ')}
     ORDER BY o.created_at DESC`,
    params
  );
};

/**
 * approveOrder — supervisor/admin/super_admin only.
 * Increments stock atomically. Returns the updated order.
 */
const approveOrder = async (orderId, reviewNotes, reviewerId, icdvId) =>
  transaction(async (conn) => {
    const exec = (sql, p) => conn.query(sql, p).then(([r]) => r);

    // Lock the order row
    const [order] = await exec(
      `SELECT * FROM manifest_fuel_orders WHERE order_id=? FOR UPDATE`,
      [orderId]
    );
    if (!order) throw new ApiError(httpStatus.NOT_FOUND, 'Fuel order not found');
    if (icdvId && order.icdv_id !== icdvId)
      throw new ApiError(httpStatus.FORBIDDEN, 'Order does not belong to your ICDV');
    if (order.status !== 'pending')
      throw new ApiError(httpStatus.CONFLICT, `Order is already ${order.status}`);

    // Approve: increment stock
    await adjustStock(conn, order.manifest_id, order.icdv_id, order.fuel_type, parseFloat(order.ordered_litres), 0);

    await exec(
      `UPDATE manifest_fuel_orders
       SET status='approved', reviewed_by=?, reviewed_at=NOW(), review_notes=?, updated_at=NOW()
       WHERE order_id=?`,
      [reviewerId, reviewNotes || null, orderId]
    );

    const [updated] = await exec(
      `SELECT o.*, u1.full_name AS ordered_by_name, u2.full_name AS reviewed_by_name
       FROM manifest_fuel_orders o
       LEFT JOIN users u1 ON u1.user_id = o.ordered_by
       LEFT JOIN users u2 ON u2.user_id = o.reviewed_by
       WHERE o.order_id=?`,
      [orderId]
    );
    return updated;
  });

/**
 * rejectOrder — supervisor/admin/super_admin only.
 * No stock change.
 */
const rejectOrder = async (orderId, reviewNotes, reviewerId, icdvId) => {
  const order = await getFuelOrder(orderId, icdvId);
  if (order.status !== 'pending')
    throw new ApiError(httpStatus.CONFLICT, `Order is already ${order.status}`);

  await query(
    `UPDATE manifest_fuel_orders
     SET status='rejected', reviewed_by=?, reviewed_at=NOW(), review_notes=?, updated_at=NOW()
     WHERE order_id=?`,
    [reviewerId, reviewNotes || null, orderId]
  );

  return getFuelOrder(orderId, icdvId);
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. FUEL DISPENSE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lookup a vehicle by chassis — returns vehicle + manifest + current stock for both fuel types.
 * Used by the FuelPage operation step-1 (chassis search).
 */
const fuelLookup = async (chassisNumber, icdvId = null) => {
  const scopeClause = icdvId ? ' AND v.icdv_id=?' : '';
  const params = icdvId ? [chassisNumber, icdvId] : [chassisNumber];

  const [vehicle] = await query(
    `SELECT v.vehicle_id, v.chassis_number, v.brand, v.model, v.year, v.color,
            v.workflow_status, v.current_location, v.icdv_id,
            m.manifest_id, m.manifest_number, m.status AS manifest_status,
            ic.name AS icdv_name
     FROM vehicles v
     JOIN manifests m  ON m.manifest_id = v.manifest_id
     LEFT JOIN icdvs ic ON ic.icdv_id   = v.icdv_id
     WHERE v.chassis_number=?${scopeClause}`,
    params
  );
  if (!vehicle) throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');

  // Fetch stock for both fuel types
  const stockRows = await query(
    `SELECT fuel_type, total_ordered, total_dispensed, current_stock
     FROM manifest_fuel_stock
     WHERE manifest_id=?`,
    [vehicle.manifest_id]
  );

  const stock = { diesel: null, petrol: null };
  for (const row of stockRows) stock[row.fuel_type] = row;

  // Prior dispensings for this vehicle
  const priorFuels = await query(
    `SELECT fuel_type, SUM(litres_dispensed) AS total_litres, COUNT(*) AS times
     FROM vehicle_fuel_records
     WHERE vehicle_id=?
     GROUP BY fuel_type`,
    [vehicle.vehicle_id]
  );

  return { ...vehicle, stock, prior_dispensings: priorFuels };
};

/**
 * dispenseFuel — inserts a vehicle_fuel_record and decrements stock atomically.
 * Blocked if current_stock < litres_dispensed.
 */
const dispenseFuel = async (vehicleId, { fuel_type, litres_dispensed, notes }, dispenserId, icdvId) =>
  transaction(async (conn) => {
    const exec = (sql, p) => conn.query(sql, p).then(([r]) => r);

    const litres = parseFloat(litres_dispensed);
    if (!litres || litres <= 0) throw new ApiError(httpStatus.BAD_REQUEST, 'litres_dispensed must be > 0');
    if (!['diesel', 'petrol'].includes(fuel_type))
      throw new ApiError(httpStatus.BAD_REQUEST, 'fuel_type must be diesel or petrol');

    // Lock and validate vehicle
    const [vehicle] = await exec(
      `SELECT v.vehicle_id, v.icdv_id, v.manifest_id, v.chassis_number
       FROM vehicles v WHERE v.vehicle_id=? FOR UPDATE`,
      [vehicleId]
    );
    if (!vehicle) throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');
    if (icdvId && vehicle.icdv_id !== icdvId)
      throw new ApiError(httpStatus.FORBIDDEN, 'Vehicle does not belong to your ICDV');

    // Check there is at least one approved order for this manifest + fuel_type
    const [approvedOrder] = await exec(
      `SELECT order_id FROM manifest_fuel_orders
       WHERE manifest_id=? AND fuel_type=? AND status='approved' LIMIT 1`,
      [vehicle.manifest_id, fuel_type]
    );
    if (!approvedOrder)
      throw new ApiError(
        httpStatus.UNPROCESSABLE_ENTITY,
        `No approved ${fuel_type} order exists for this manifest — cannot dispense`
      );

    // Decrement stock (adjustStock throws 422 if insufficient)
    const newStock = await adjustStock(conn, vehicle.manifest_id, vehicle.icdv_id, fuel_type, 0, litres);

    // Insert dispensing record
    const ins = await exec(
      `INSERT INTO vehicle_fuel_records
         (manifest_id, vehicle_id, icdv_id, fuel_type, litres_dispensed, notes, dispensed_by, dispensed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [vehicle.manifest_id, vehicleId, vehicle.icdv_id, fuel_type, litres, notes || null, dispenserId]
    );

    return {
      fuel_record_id:  ins.insertId,
      chassis_number:  vehicle.chassis_number,
      fuel_type,
      litres_dispensed: litres,
      remaining_stock: newStock.current_stock,
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// 3. FUEL DASHBOARD (manifest-level)
// ─────────────────────────────────────────────────────────────────────────────

const getFuelDashboard = async (manifestId, icdvId = null) => {
  const manifest = await getManifest(manifestId, icdvId);

  // Stock summary per fuel type
  const stockRows = await query(
    `SELECT fuel_type, total_ordered, total_dispensed, current_stock
     FROM manifest_fuel_stock WHERE manifest_id=?`,
    [manifestId]
  );

  // All orders
  const orders = await listFuelOrders(manifestId, icdvId);

  // All dispensings with vehicle info
  const records = await query(
    `SELECT r.fuel_record_id, r.fuel_type, r.litres_dispensed, r.dispensed_at, r.notes,
            v.chassis_number, v.brand, v.model,
            u.full_name AS dispensed_by_name
     FROM vehicle_fuel_records r
     JOIN vehicles v ON v.vehicle_id = r.vehicle_id
     LEFT JOIN users u ON u.user_id  = r.dispensed_by
     WHERE r.manifest_id=?
     ORDER BY r.dispensed_at DESC`,
    [manifestId]
  );

  // Vehicle counts: total in manifest, how many have been fuelled at least once
  const [totals] = await query(
    `SELECT COUNT(*) AS total_vehicles FROM vehicles WHERE manifest_id=?`,
    [manifestId]
  );
  const [fuelled] = await query(
    `SELECT COUNT(DISTINCT vehicle_id) AS fuelled_vehicles
     FROM vehicle_fuel_records WHERE manifest_id=?`,
    [manifestId]
  );

  // Build stock map
  const stock = { diesel: null, petrol: null };
  for (const row of stockRows) stock[row.fuel_type] = row;

  // Order counts per status
  const orderSummary = { pending: 0, approved: 0, rejected: 0, total_orders: orders.length };
  for (const o of orders) orderSummary[o.status] = (orderSummary[o.status] || 0) + 1;

  return {
    manifest,
    stock,
    order_summary: orderSummary,
    orders,
    records,
    vehicle_stats: {
      total_vehicles:    totals.total_vehicles,
      fuelled_vehicles:  fuelled.fuelled_vehicles,
      unfuelled_vehicles: totals.total_vehicles - fuelled.fuelled_vehicles,
    },
  };
};

module.exports = {
  createFuelOrder,
  getFuelOrder,
  listFuelOrders,
  approveOrder,
  rejectOrder,
  fuelLookup,
  dispenseFuel,
  getFuelDashboard,
};
