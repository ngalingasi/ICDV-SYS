const httpStatus = require('http-status');
const { query } = require('../config/database');
const ApiError = require('../utils/ApiError');

const createTarget = async (body, creatorId) => {
  const { TARGET_STATUSES } = require('../config/statuses');
  const { objective_id, name, metric_type = 'count', unit = null, target_value, deadline = null, status = TARGET_STATUSES.ON_TRACK } = body;
  const result = await query(
    'INSERT INTO targets (objective_id, name, metric_type, unit, target_value, current_value, deadline, status, created_by) VALUES (?,?,?,?,?,0,?,?,?)',
    [objective_id, name, metric_type, unit, target_value, deadline, status, creatorId]
  );
  return getTargetById(result.insertId);
};

const getTargetsByObjective = async (objectiveId) => {
  return query('SELECT * FROM targets WHERE objective_id = ? ORDER BY created_at', [objectiveId]);
};

const getTargetById = async (id) => {
  const rows = await query('SELECT * FROM targets WHERE target_id = ?', [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Target not found');
  return rows[0];
};

const updateTarget = async (id, body) => {
  const allowed = ['name', 'metric_type', 'unit', 'target_value', 'current_value', 'deadline', 'status'];
  const fields = Object.keys(body).filter((k) => allowed.includes(k));
  if (!fields.length) throw new ApiError(httpStatus.BAD_REQUEST, 'No valid fields');

  const set = fields.map((f) => `${f} = ?`).join(', ');
  await query(`UPDATE targets SET ${set} WHERE target_id = ?`, [...fields.map((f) => body[f]), id]);
  return getTargetById(id);
};

const deleteTarget = async (id) => {
  const rows = await query('SELECT target_id FROM targets WHERE target_id = ?', [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Target not found');
  await query('DELETE FROM targets WHERE target_id = ?', [id]);
};

module.exports = { createTarget, getTargetsByObjective, getTargetById, updateTarget, deleteTarget };
