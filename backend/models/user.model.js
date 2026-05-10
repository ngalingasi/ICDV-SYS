const httpStatus = require('http-status');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');

const SAFE_FIELDS = 'user_id, full_name, username, email, mobile, gender, avatar, role, status, must_change_password, last_password_changed, next_password_change, created_at, created_by';

/**
 * Create a user
 */
const createUser = async (body, creatorId = null) => {
  const { full_name, username, email = null, mobile = null, gender = 'male', role = 'user', password } = body;

  // Check uniqueness
  const existing = await query('SELECT user_id FROM users WHERE username = ? OR email = ?', [username, email]);
  if (existing.length) {
    throw new ApiError(httpStatus.CONFLICT, 'Username or email already taken');
  }

  const hash = await bcrypt.hash(password, 10);
  const result = await query(
    `INSERT INTO users (full_name, username, email, mobile, gender, password_hash, role, status, must_change_password, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, ?)`,
    [full_name, username, email || null, mobile || null, gender || 'male', hash, role || 'user', creatorId]
  );
  return getUserById(result.insertId);
};

/**
 * Get users with pagination and optional filters
 */
const getUsers = async ({ page, limit, role, status, search }) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);

  let where = '1=1';
  const params = [];

  if (role) { where += ' AND role = ?'; params.push(role); }
  if (status) { where += ' AND status = ?'; params.push(status); }
  if (search) {
    where += ' AND (full_name LIKE ? OR username LIKE ? OR email LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const [countRows] = await query(`SELECT COUNT(*) AS total FROM users WHERE ${where}`, params);
  const total = countRows.total;

  const users = await query(
    `SELECT ${SAFE_FIELDS} FROM users WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );

  // Attach skills to each user
  for (const user of users) {
    user.skills = await query(
      `SELECT s.skill_id, s.name, s.category FROM skills s
       JOIN user_skills us ON us.skill_id = s.skill_id
       WHERE us.user_id = ? ORDER BY s.name`,
      [user.user_id]
    );
  }
  return { results: users, ...paginate(total) };
};

/**
 * Get a single user by ID
 */
const getUserById = async (id) => {
  const rows = await query(`SELECT ${SAFE_FIELDS} FROM users WHERE user_id = ?`, [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'User not found');
  const user = rows[0];
  user.skills = await query(
    `SELECT s.skill_id, s.name, s.category
     FROM skills s JOIN user_skills us ON us.skill_id = s.skill_id
     WHERE us.user_id = ? ORDER BY s.category, s.name`,
    [id]
  );
  return user;
};

const getSkills = async () => {
  return query('SELECT * FROM skills ORDER BY category, name', []);
};

const updateUserSkills = async (userId, skillIds = []) => {
  // Remove all then re-insert
  await query('DELETE FROM user_skills WHERE user_id = ?', [userId]);
  for (const skillId of skillIds) {
    await query('INSERT IGNORE INTO user_skills (user_id, skill_id) VALUES (?,?)', [userId, skillId]);
  }
};

/**
 * Update a user
 */
const updateUser = async (id, body) => {
  const allowed = ['full_name', 'email', 'mobile', 'gender', 'avatar', 'role', 'status'];
  const fields = Object.keys(body).filter((k) => allowed.includes(k));
  if (!fields.length) throw new ApiError(httpStatus.BAD_REQUEST, 'No valid fields to update');

  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => body[f]);
  await query(`UPDATE users SET ${setClauses} WHERE user_id = ?`, [...values, id]);
  return getUserById(id);
};

/**
 * Delete a user (soft delete by setting status = inactive)
 */
const deleteUser = async (id) => {
  await query('UPDATE users SET status = "inactive" WHERE user_id = ?', [id]);
};

module.exports = { createUser, getUsers, getUserById, updateUser, deleteUser, getSkills, updateUserSkills };
