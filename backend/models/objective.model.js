const httpStatus = require('http-status');
const { query } = require('../config/database');
const ApiError = require('../utils/ApiError');

const createObjective = async (body, creatorId) => {
  const { OBJECTIVE_STATUSES } = require('../config/statuses');
  const { project_id, title, description = null, priority = 'medium', status = OBJECTIVE_STATUSES.PENDING } = body;
  const result = await query(
    'INSERT INTO objectives (project_id, title, description, priority, status, created_by) VALUES (?,?,?,?,?,?)',
    [project_id, title, description, priority, status, creatorId]
  );
  return getObjectiveById(result.insertId);
};

const getObjectivesByProject = async (projectId) => {
  return query(
    `SELECT o.*, COUNT(t.target_id) AS target_count
     FROM objectives o
     LEFT JOIN targets t ON t.objective_id = o.objective_id
     WHERE o.project_id = ?
     GROUP BY o.objective_id
     ORDER BY o.created_at`,
    [projectId]
  );
};

const getObjectiveById = async (id) => {
  const rows = await query('SELECT * FROM objectives WHERE objective_id = ?', [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Objective not found');
  const obj = rows[0];
  obj.targets = await query('SELECT * FROM targets WHERE objective_id = ?', [id]);
  return obj;
};

const updateObjective = async (id, body) => {
  const allowed = ['title', 'description', 'priority', 'status'];
  const fields = Object.keys(body).filter((k) => allowed.includes(k));
  if (!fields.length) throw new ApiError(httpStatus.BAD_REQUEST, 'No valid fields');

  const set = fields.map((f) => `${f} = ?`).join(', ');
  await query(`UPDATE objectives SET ${set} WHERE objective_id = ?`, [...fields.map((f) => body[f]), id]);
  return getObjectiveById(id);
};

const deleteObjective = async (id) => {
  const rows = await query('SELECT objective_id FROM objectives WHERE objective_id = ?', [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Objective not found');
  await query('DELETE FROM objectives WHERE objective_id = ?', [id]);
};

module.exports = { createObjective, getObjectivesByProject, getObjectiveById, updateObjective, deleteObjective };
