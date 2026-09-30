const httpStatus  = require('http-status');
const catchAsync  = require('../utils/catchAsync');
const incidentModel = require('../models/incident.model');
const path        = require('path');
const { captureEvent } = require('../config/traceAndFound');

const toRelativePath = (filePath) => {
  if (!filePath) return null;
  const n   = filePath.replace(/\\/g, '/');
  const idx = n.indexOf('/uploads/');
  return idx !== -1 ? n.slice(idx) : '/uploads/' + path.basename(filePath);
};

// ── Incident Types ─────────────────────────────────────────────────────────────
const getTypes     = catchAsync(async (req, res) => {
  res.json(await incidentModel.getIncidentTypes());
});
const createType   = catchAsync(async (req, res) => {
  res.status(httpStatus.CREATED).json(await incidentModel.createIncidentType(req.body));
});
const updateType   = catchAsync(async (req, res) => {
  res.json(await incidentModel.updateIncidentType(Number(req.params.typeId), req.body));
});

// ── Vehicle Lookup ─────────────────────────────────────────────────────────────
const lookup = catchAsync(async (req, res) => {
  const { chassis_number } = req.query;
  if (!chassis_number) return res.status(400).json({ message: 'chassis_number is required' });
  res.json(await incidentModel.lookupVehicleForIncident(chassis_number.trim(), req.icdvId));
});

// ── Incidents ──────────────────────────────────────────────────────────────────
const create = catchAsync(async (req, res) => {
  const attachments = (req.files ?? []).map(f => ({
    path:         toRelativePath(f.path),
    originalname: f.originalname,
    mimetype:     f.mimetype,
  }));
  const incident = await incidentModel.createIncident(req.body, req.user.user_id, req.icdvId, attachments);
  // Safety-relevant — worth tracking regardless of severity, and severity is
  // carried on the event so a dashboard/alert can filter on it if wanted.
  captureEvent('incident.reported', incident.icdv_id, {
    incident_id: incident.incident_id, vehicle_id: incident.vehicle_id,
    type_id: incident.type_id, severity: incident.severity, reported_by: req.user.user_id,
  });
  res.status(httpStatus.CREATED).json(incident);
});

const list       = catchAsync(async (req, res) => {
  res.json(await incidentModel.listIncidents(req.query, req.icdvId));
});

const getOne     = catchAsync(async (req, res) => {
  res.json(await incidentModel.getIncidentById(Number(req.params.incidentId), req.icdvId));
});

const acknowledge = catchAsync(async (req, res) => {
  const incident = await incidentModel.acknowledgeIncident(Number(req.params.incidentId), req.user.user_id, req.icdvId);
  captureEvent('incident.acknowledged', incident.icdv_id, { incident_id: incident.incident_id, user_id: req.user.user_id });
  res.json(incident);
});

const resolve    = catchAsync(async (req, res) => {
  const incident = await incidentModel.resolveIncident(
    Number(req.params.incidentId), req.body.resolution_notes, req.user.user_id, req.icdvId
  );
  captureEvent('incident.resolved', incident.icdv_id, { incident_id: incident.incident_id, user_id: req.user.user_id });
  res.json(incident);
});

const vehicleIncidents = catchAsync(async (req, res) => {
  res.json(await incidentModel.getVehicleIncidents(Number(req.params.vehicleId), req.icdvId));
});

module.exports = {
  getTypes, createType, updateType,
  lookup, create, list, getOne,
  acknowledge, resolve,
  vehicleIncidents,
};
