const httpStatus = require('http-status');
const { query } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');
const { DELIVERY_STATUS_TRANSITIONS } = require('../config/statuses');

const createDelivery = async (body, creatorId) => {
  const {
    vehicle_id, driver_id = null, scheduled_date = null,
    delivery_address = null, recipient_name = null, recipient_phone = null,
    notes = null, status = 'scheduled',
  } = body;

  // Check vehicle is ready
  const [vehicle] = await query(
    "SELECT vehicle_id, operational_status FROM vehicles WHERE vehicle_id=?", [vehicle_id]
  );
  if (!vehicle) throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');

  const [r] = await query(
    `INSERT INTO deliveries (vehicle_id, driver_id, scheduled_date, delivery_address,
      recipient_name, recipient_phone, notes, status, created_by)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [vehicle_id, driver_id, scheduled_date, delivery_address,
     recipient_name, recipient_phone, notes, status, creatorId]
  );
  return getDeliveryById(r.insertId);
};

const getDeliveries = async ({ page, limit, vehicle_id, driver_id, status, search }) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  let where = '1=1';
  const params = [];
  if (vehicle_id) { where += ' AND dl.vehicle_id=?'; params.push(vehicle_id); }
  if (driver_id)  { where += ' AND dl.driver_id=?';  params.push(driver_id); }
  if (status)     { where += ' AND dl.status=?';     params.push(status); }
  if (search) {
    where += ' AND (vh.chassis_number LIKE ? OR dl.recipient_name LIKE ? OR d.full_name LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM deliveries dl
     LEFT JOIN vehicles vh ON vh.vehicle_id = dl.vehicle_id
     LEFT JOIN drivers d ON d.driver_id = dl.driver_id
     WHERE ${where}`, params
  );
  const deliveries = await query(
    `SELECT dl.*,
       vh.chassis_number, vh.brand, vh.model, vh.customer_name,
       m.manifest_number, v.name AS vessel_name,
       d.full_name AS driver_name, d.phone AS driver_phone,
       u.full_name AS created_by_name
     FROM deliveries dl
     LEFT JOIN vehicles vh ON vh.vehicle_id = dl.vehicle_id
     LEFT JOIN manifests m ON m.manifest_id = vh.manifest_id
     LEFT JOIN vessels v ON v.vessel_id = m.vessel_id
     LEFT JOIN drivers d ON d.driver_id = dl.driver_id
     LEFT JOIN users u ON u.user_id = dl.created_by
     WHERE ${where}
     ORDER BY dl.scheduled_date DESC, dl.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );
  return paginate(deliveries, total);
};

const getDeliveryById = async (id) => {
  const [delivery] = await query(
    `SELECT dl.*,
       vh.chassis_number, vh.brand, vh.model, vh.color, vh.customer_name,
       m.manifest_number, v.name AS vessel_name,
       d.full_name AS driver_name, d.license_number, d.phone AS driver_phone,
       u.full_name AS created_by_name
     FROM deliveries dl
     LEFT JOIN vehicles vh ON vh.vehicle_id = dl.vehicle_id
     LEFT JOIN manifests m ON m.manifest_id = vh.manifest_id
     LEFT JOIN vessels v ON v.vessel_id = m.vessel_id
     LEFT JOIN drivers d ON d.driver_id = dl.driver_id
     LEFT JOIN users u ON u.user_id = dl.created_by
     WHERE dl.delivery_id=?`,
    [id]
  );
  if (!delivery) throw new ApiError(httpStatus.NOT_FOUND, 'Delivery not found');
  return delivery;
};

const updateDelivery = async (id, body, updaterId) => {
  await getDeliveryById(id);
  const fields = [];
  const params = [];
  const allowed = ['driver_id','scheduled_date','delivery_address','recipient_name','recipient_phone','notes'];
  for (const key of allowed) {
    if (body[key] !== undefined) { fields.push(`${key}=?`); params.push(body[key]); }
  }
  if (!fields.length) return getDeliveryById(id);
  fields.push('updated_by=?', 'updated_at=NOW()');
  params.push(updaterId, id);
  await query(`UPDATE deliveries SET ${fields.join(',')} WHERE delivery_id=?`, params);
  return getDeliveryById(id);
};

const updateDeliveryStatus = async (id, newStatus, userId, data = {}) => {
  const delivery = await getDeliveryById(id);
  const allowed = DELIVERY_STATUS_TRANSITIONS[delivery.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new ApiError(httpStatus.BAD_REQUEST,
      `Cannot transition from '${delivery.status}' to '${newStatus}'`);
  }

  const extra = [];
  const extraP = [];
  if (newStatus === 'delivered') {
    extra.push('delivered_date=NOW()');
    if (data.delivery_notes) { extra.push('delivery_notes=?'); extraP.push(data.delivery_notes); }
  }
  const setClause = [`status=?`, ...extra, 'updated_by=?', 'updated_at=NOW()'].join(',');
  await query(
    `UPDATE deliveries SET ${setClause} WHERE delivery_id=?`,
    [newStatus, ...extraP, userId, id]
  );

  // When delivered — update vehicle
  if (newStatus === 'delivered') {
    await query(
      "UPDATE vehicles SET operational_status='delivered', release_status='collected', updated_by=?, updated_at=NOW() WHERE vehicle_id=?",
      [userId, delivery.vehicle_id]
    );
  }
  return getDeliveryById(id);
};

const deleteDelivery = async (id) => {
  const delivery = await getDeliveryById(id);
  if (['in_transit','delivered'].includes(delivery.status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot delete an in-transit or delivered delivery');
  }
  await query('DELETE FROM deliveries WHERE delivery_id=?', [id]);
  return delivery;
};

module.exports = { createDelivery, getDeliveries, getDeliveryById, updateDelivery, updateDeliveryStatus, deleteDelivery };
