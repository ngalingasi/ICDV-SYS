const httpStatus = require('http-status');
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');

const SAFE_FIELDS = 'u.user_id, u.full_name, u.username, u.email, u.mobile, u.gender, u.avatar, u.role, u.icdv_id, u.status, u.must_change_password, u.last_password_changed, u.next_password_change, u.created_at, u.created_by, i.name AS icdv_name';

const createUser = async (body, creatorId = null) => {
  const {
    full_name, username, email = null, mobile = null,
    gender = 'male', role = 'user', password,
    icdv_id = null,
  } = body;

  const existing = await query('SELECT user_id FROM users WHERE username = ? OR (email IS NOT NULL AND email = ?)', [username, email]);
  if (existing.length) throw new ApiError(httpStatus.CONFLICT, 'Username or email already taken');

  const hash = await bcrypt.hash(password, 10);
  const result = await query(
    `INSERT INTO users (full_name, username, email, mobile, gender, password_hash, role, icdv_id, status, must_change_password, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?)`,
    [full_name, username, email || null, mobile || null, gender || 'male', hash, role || 'operator', icdv_id || null, creatorId]
  );
  return getUserById(result.insertId);
};

const getUsers = async ({ page, limit, role, status, search } = {}, icdvId = null) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  let where = '1=1';
  const params = [];

  if (icdvId !== null) { where += ' AND u.icdv_id = ?'; params.push(icdvId); }
  if (role)   { where += ' AND u.role = ?';   params.push(role); }
  if (status) { where += ' AND u.status = ?'; params.push(status); }
  if (search) {
    where += ' AND (u.full_name LIKE ? OR u.username LIKE ? OR u.email LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  const [countRow] = await query(`SELECT COUNT(*) AS total FROM users u WHERE ${where}`, params);
  const total = countRow.total;

  const users = await query(
    `SELECT ${SAFE_FIELDS}
     FROM users u
     LEFT JOIN icdvs i ON i.icdv_id = u.icdv_id
     WHERE ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );

  for (const user of users) {
    user.skills = await query(
      `SELECT s.skill_id, s.name, s.category FROM skills s
       JOIN user_skills us ON us.skill_id = s.skill_id
       WHERE us.user_id = ? ORDER BY s.name`,
      [user.user_id]
    );
  }
  return paginate(users, total);
};

const getUserById = async (id) => {
  const rows = await query(
    `SELECT ${SAFE_FIELDS}
     FROM users u
     LEFT JOIN icdvs i ON i.icdv_id = u.icdv_id
     WHERE u.user_id = ?`,
    [id]
  );
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

const getSkills = async () => query('SELECT * FROM skills ORDER BY category, name', []);

const updateUserSkills = async (userId, skillIds = []) => {
  await query('DELETE FROM user_skills WHERE user_id = ?', [userId]);
  for (const skillId of skillIds) {
    await query('INSERT IGNORE INTO user_skills (user_id, skill_id) VALUES (?,?)', [userId, skillId]);
  }
};

const updateUser = async (id, body) => {
  const allowed = ['full_name', 'email', 'mobile', 'gender', 'avatar', 'role', 'status', 'must_change_password', 'icdv_id'];
  const fields = Object.keys(body).filter((k) => allowed.includes(k));
  if (!fields.length) throw new ApiError(httpStatus.BAD_REQUEST, 'No valid fields to update');
  const setClauses = fields.map((f) => `${f} = ?`).join(', ');
  const values = fields.map((f) => body[f]);
  await query(`UPDATE users SET ${setClauses} WHERE user_id = ?`, [...values, id]);
  return getUserById(id);
};

const deleteUser = async (id) => {
  await query('UPDATE users SET status = "inactive" WHERE user_id = ?', [id]);
};

module.exports = { createUser, getUsers, getUserById, updateUser, deleteUser, getSkills, updateUserSkills };
