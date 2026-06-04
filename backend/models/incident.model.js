/**
 * incident.model.js
 *
 * Incident reporting for vehicles during operations.
 *
 * Status flow:
 *   reported → acknowledged (supervisor/admin) → resolved (supervisor/admin)
 *
 * Anyone can report. Only supervisor/admin can acknowledge/resolve.
 * Attachments: up to 3 files per incident.
 */

const httpStatus = require('http-status');
const { query }  = require('../config/database');
const ApiError   = require('../utils/ApiError');
const path       = require('path');

// ── Helpers ───────────────────────────────────────────────────────────────────

const toRelativePath = (filePath) => {
  if (!filePath) return null;
  const n   = filePath.replace(/\\/g, '/');
  const idx = n.indexOf('/uploads/');
  if (idx !== -1) return n.slice(idx);
  return '/uploads/' + path.basename(filePath);
};

// ── Incident Types ────────────────────────────────────────────────────────────

const getIncidentTypes = async (includeInactive = false) => {
  const where = includeInactive ? '' : 'WHERE is_active=1';
  return query(`SELECT * FROM incident_types ${where} ORDER BY sort_order, name`);
};

const createIncidentType = async ({ name, description, sort_order = 0 }) => {
  const r = await query(
    `INSERT INTO incident_types (name, description, sort_order) VALUES (?,?,?)`,
    [name.trim(), description || null, sort_order]
  );
  const [row] = await query('SELECT * FROM incident_types WHERE type_id=?', [r.insertId]);
  return row;
};

const updateIncidentType = async (typeId, body) => {
  const fields = [];
  const params = [];
  if (body.name        !== undefined) { fields.push('name=?');        params.push(body.name.trim()); }
  if (body.description !== undefined) { fields.push('description=?'); params.push(body.description || null); }
  if (body.sort_order  !== undefined) { fields.push('sort_order=?');  params.push(body.sort_order); }
  if (body.is_active   !== undefined) { fields.push('is_active=?');   params.push(body.is_active ? 1 : 0); }
  if (!fields.length) throw new ApiError(httpStatus.BAD_REQUEST, 'No fields to update');
  params.push(typeId);
  await query(`UPDATE incident_types SET ${fields.join(',')} WHERE type_id=?`, params);
  const [row] = await query('SELECT * FROM incident_types WHERE type_id=?', [typeId]);
  return row;
};

// ── Vehicle lookup for incident form ──────────────────────────────────────────
// Returns vehicle details + auto-detected driver from active transfer

const lookupVehicleForIncident = async (chassisNumber, icdvId = null) => {
  const scopeClause = icdvId ? ' AND v.icdv_id=?' : '';
  const params = icdvId ? [chassisNumber, icdvId] : [chassisNumber];

  const [vehicle] = await query(
    `SELECT
       v.vehicle_id, v.chassis_number, v.brand, v.model, v.year, v.color,
       v.workflow_status, v.current_location, v.icdv_id,
       m.manifest_id, m.manifest_number,
       ic.name AS icdv_name,
       d.driver_id, d.full_name AS driver_name, d.id_number AS driver_id_card,
       d.license_number AS driver_license, d.phone AS driver_phone
     FROM vehicles v
     LEFT JOIN manifests m ON m.manifest_id = v.manifest_id
     LEFT JOIN icdvs    ic ON ic.icdv_id    = v.icdv_id
     -- Auto-detect driver from active transfer
     LEFT JOIN transfers t ON t.vehicle_id  = v.vehicle_id AND t.status = 'active'
     LEFT JOIN drivers   d ON d.driver_id   = t.driver_id
     WHERE v.chassis_number=?${scopeClause}`,
    params
  );
  if (!vehicle) throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');
  return vehicle;
};

// ── Incidents CRUD ────────────────────────────────────────────────────────────

const createIncident = async (body, reporterId, icdvId, attachmentPaths = []) => {
  const { vehicle_id, type_id, severity, description, driver_id, driver_snapshot } = body;
  if (!vehicle_id)   throw new ApiError(httpStatus.BAD_REQUEST, 'vehicle_id is required');
  if (!type_id)      throw new ApiError(httpStatus.BAD_REQUEST, 'type_id is required');
  if (!description?.trim()) throw new ApiError(httpStatus.BAD_REQUEST, 'description is required');

  // Resolve manifest_id from vehicle
  const [veh] = await query(
    'SELECT manifest_id, icdv_id FROM vehicles WHERE vehicle_id=?', [vehicle_id]
  );
  if (!veh) throw new ApiError(httpStatus.NOT_FOUND, 'Vehicle not found');
  if (icdvId && veh.icdv_id !== icdvId)
    throw new ApiError(httpStatus.FORBIDDEN, 'Vehicle does not belong to your ICDV');

  const effectiveIcdvId = icdvId ?? veh.icdv_id;

  const r = await query(
    `INSERT INTO incidents
       (vehicle_id, manifest_id, icdv_id, type_id, severity, description,
        driver_id, driver_snapshot, reported_by, reported_at)
     VALUES (?,?,?,?,?,?,?,?,?,NOW())`,
    [
      vehicle_id, veh.manifest_id, effectiveIcdvId, type_id,
      severity || 'medium', description.trim(),
      driver_id || null, driver_snapshot || null,
      reporterId,
    ]
  );

  const incidentId = r.insertId;

  // Insert attachments (up to 3)
  if (attachmentPaths.length) {
    for (const att of attachmentPaths.slice(0, 3)) {
      await query(
        `INSERT INTO incident_attachments (incident_id, file_path, file_name, mime_type, uploaded_by)
         VALUES (?,?,?,?,?)`,
        [incidentId, att.path, att.originalname, att.mimetype, reporterId]
      );
    }
  }

  return getIncidentById(incidentId);
};

const getIncidentById = async (incidentId, icdvId = null) => {
  const scopeClause = icdvId ? ' AND i.icdv_id=?' : '';
  const params = icdvId ? [incidentId, icdvId] : [incidentId];

  const [incident] = await query(
    `SELECT
       i.*,
       it.name                    AS incident_type_name,
       v.chassis_number, v.brand, v.model, v.color,
       m.manifest_number,
       ic.name                    AS icdv_name,
       u1.full_name               AS reported_by_name,
       u2.full_name               AS acknowledged_by_name,
       u3.full_name               AS resolved_by_name,
       d.full_name                AS driver_name_current,
       d.id_number                AS driver_id_card,
       d.license_number           AS driver_license
     FROM incidents i
     LEFT JOIN incident_types it  ON it.type_id     = i.type_id
     LEFT JOIN vehicles       v   ON v.vehicle_id   = i.vehicle_id
     LEFT JOIN manifests      m   ON m.manifest_id  = i.manifest_id
     LEFT JOIN icdvs          ic  ON ic.icdv_id     = i.icdv_id
     LEFT JOIN users          u1  ON u1.user_id     = i.reported_by
     LEFT JOIN users          u2  ON u2.user_id     = i.acknowledged_by
     LEFT JOIN users          u3  ON u3.user_id     = i.resolved_by
     LEFT JOIN drivers        d   ON d.driver_id    = i.driver_id
     WHERE i.incident_id=?${scopeClause}`,
    params
  );
  if (!incident) throw new ApiError(httpStatus.NOT_FOUND, 'Incident not found');

  incident.attachments = await query(
    'SELECT * FROM incident_attachments WHERE incident_id=? ORDER BY uploaded_at',
    [incidentId]
  );
  return incident;
};

const listIncidents = async ({ page = 1, limit = 20, status, severity, type_id, vehicle_id, search } = {}, icdvId = null) => {
  const where  = ['1=1'];
  const params = [];

  if (icdvId)    { where.push('i.icdv_id=?');    params.push(icdvId); }
  if (status)    { where.push('i.status=?');      params.push(status); }
  if (severity)  { where.push('i.severity=?');    params.push(severity); }
  if (type_id)   { where.push('i.type_id=?');     params.push(type_id); }
  if (vehicle_id){ where.push('i.vehicle_id=?');  params.push(vehicle_id); }
  if (search)    {
    where.push('(v.chassis_number LIKE ? OR i.description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereStr = 'WHERE ' + where.join(' AND ');
  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM incidents i LEFT JOIN vehicles v ON v.vehicle_id=i.vehicle_id ${whereStr}`, params);

  const l      = Math.min(Number(limit) || 20, 100);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * l;

  const rows = await query(
    `SELECT
       i.incident_id, i.severity, i.status, i.reported_at, i.description,
       i.icdv_id,
       it.name   AS incident_type_name,
       v.chassis_number, v.brand, v.model,
       ic.name   AS icdv_name,
       u1.full_name AS reported_by_name,
       i.driver_snapshot
     FROM incidents i
     LEFT JOIN incident_types it ON it.type_id   = i.type_id
     LEFT JOIN vehicles       v  ON v.vehicle_id = i.vehicle_id
     LEFT JOIN icdvs          ic ON ic.icdv_id   = i.icdv_id
     LEFT JOIN users          u1 ON u1.user_id   = i.reported_by
     ${whereStr}
     ORDER BY i.reported_at DESC
     LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );

  return {
    results: rows,
    total,
    page: Math.max(Number(page) || 1, 1),
    limit: l,
    totalPages: Math.ceil(total / l),
  };
};

// ── Status transitions ────────────────────────────────────────────────────────

const acknowledgeIncident = async (incidentId, reviewerId, icdvId) => {
  const inc = await getIncidentById(incidentId, icdvId);
  if (inc.status !== 'reported')
    throw new ApiError(httpStatus.CONFLICT, `Incident is already ${inc.status}`);
  await query(
    `UPDATE incidents SET status='acknowledged', acknowledged_by=?, acknowledged_at=NOW() WHERE incident_id=?`,
    [reviewerId, incidentId]
  );
  return getIncidentById(incidentId, icdvId);
};

const resolveIncident = async (incidentId, resolution_notes, reviewerId, icdvId) => {
  const inc = await getIncidentById(incidentId, icdvId);
  if (inc.status === 'resolved')
    throw new ApiError(httpStatus.CONFLICT, 'Incident is already resolved');
  await query(
    `UPDATE incidents SET status='resolved', resolved_by=?, resolved_at=NOW(), resolution_notes=? WHERE incident_id=?`,
    [reviewerId, resolution_notes || null, incidentId]
  );
  return getIncidentById(incidentId, icdvId);
};

// ── Vehicle incident history (used by VehicleDetail) ─────────────────────────

const getVehicleIncidents = async (vehicleId, icdvId = null) => {
  const scopeClause = icdvId ? ' AND i.icdv_id=?' : '';
  const params = icdvId ? [vehicleId, icdvId] : [vehicleId];
  const rows = await query(
    `SELECT
       i.incident_id, i.severity, i.status, i.reported_at, i.description,
       i.resolution_notes, i.resolved_at,
       it.name AS incident_type_name,
       u1.full_name AS reported_by_name,
       u3.full_name AS resolved_by_name,
       i.driver_snapshot
     FROM incidents i
     LEFT JOIN incident_types it ON it.type_id  = i.type_id
     LEFT JOIN users          u1 ON u1.user_id  = i.reported_by
     LEFT JOIN users          u3 ON u3.user_id  = i.resolved_by
     WHERE i.vehicle_id=?${scopeClause}
     ORDER BY i.reported_at DESC`,
    params
  );
  for (const row of rows) {
    row.attachments = await query(
      'SELECT * FROM incident_attachments WHERE incident_id=? ORDER BY uploaded_at',
      [row.incident_id]
    );
  }
  return rows;
};

module.exports = {
  getIncidentTypes,
  createIncidentType,
  updateIncidentType,
  lookupVehicleForIncident,
  createIncident,
  getIncidentById,
  listIncidents,
  acknowledgeIncident,
  resolveIncident,
  getVehicleIncidents,
};
