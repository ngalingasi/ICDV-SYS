const httpStatus = require('http-status');
const { query }  = require('../config/database');
const ApiError   = require('../utils/ApiError');

const getCommentsByActivity = async (activityId) => {
  return query(
    `SELECT c.*, u.full_name AS user_name, u.role AS user_role
     FROM activity_comments c
     JOIN users u ON u.user_id = c.user_id
     WHERE c.activity_id = ?
     ORDER BY c.created_at ASC`,
    [activityId]
  );
};

const createComment = async (activityId, userId, comment) => {
  const result = await query(
    'INSERT INTO activity_comments (activity_id, user_id, comment) VALUES (?,?,?)',
    [activityId, userId, comment]
  );
  const rows = await query(
    `SELECT c.*, u.full_name AS user_name, u.role AS user_role
     FROM activity_comments c
     JOIN users u ON u.user_id = c.user_id
     WHERE c.comment_id = ?`,
    [result.insertId]
  );
  return rows[0];
};

const deleteComment = async (commentId, userId, userRole) => {
  const rows = await query('SELECT * FROM activity_comments WHERE comment_id = ?', [commentId]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Comment not found');
  const comment = rows[0];
  // Only the author or admin can delete
  if (userRole !== 'admin' && Number(comment.user_id) !== Number(userId)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You can only delete your own comments');
  }
  await query('DELETE FROM activity_comments WHERE comment_id = ?', [commentId]);
};

module.exports = { getCommentsByActivity, createComment, deleteComment };
