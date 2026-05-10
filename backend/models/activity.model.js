const httpStatus = require('http-status');
const { query, transaction } = require('../config/database');
const ApiError = require('../utils/ApiError');
const { buildPagination } = require('../utils/paginate');
const { ACTIVITY_STATUSES, ACTIVITY_STATUS_TRANSITIONS } = require('../config/statuses');
const { validateActivityBudget, syncTargetSpent } = require('./budget.model');

/**
 * Create an activity — budgeted_amount is required and validated against target budget
 */
const createActivity = async (body, creatorId) => {
  const {
    target_id,
    region_id        = null,
    name,
    description      = null,
    main_activity_id = null,
    council          = null,
    ward             = null,
    street           = null,
    road_name        = null,
    latitude         = null,
    longitude        = null,
    global_id        = null,
    assigned_user_id = null,
    supervisor_id    = null,
    start_date       = null,
    end_date         = null,
    status           = ACTIVITY_STATUSES.PENDING,
    budgeted_amount,
  } = body;

  if (!budgeted_amount || Number(budgeted_amount) <= 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'budgeted_amount is required and must be greater than 0');
  }

  return transaction(async (conn) => {
    // Validate budget fits within target allocation
    await validateActivityBudget(target_id, Number(budgeted_amount), conn);

    const [result] = await conn.query(
      `INSERT INTO activities (target_id, region_id, name, description, main_activity_id, council, ward,
        street, road_name, latitude, longitude, global_id, assigned_user_id, supervisor_id,
        start_date, end_date, progress, budgeted_amount, status, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?)`,
      [target_id, region_id, name, description, main_activity_id, council, ward, street,
       road_name, latitude, longitude, global_id, assigned_user_id, supervisor_id,
       start_date, end_date, Number(budgeted_amount), status, creatorId]
    );

    // Sync target spent tracker
    await syncTargetSpent(target_id, conn);

    return getActivityById(result.insertId, conn);
  });
};

/**
 * Get paginated activities with optional filters
 */
const getActivities = async ({ page, limit, target_id, region_id, status, assigned_user_id, project_manager_id }) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);

  let where = '1=1';
  const params = [];

  if (target_id)        { where += ' AND a.target_id = ?';        params.push(parseInt(target_id, 10)); }
  if (region_id)        { where += ' AND a.region_id = ?';        params.push(parseInt(region_id, 10)); }
  if (status)           { where += ' AND a.status = ?';           params.push(status); }
  if (assigned_user_id)   { where += ' AND a.assigned_user_id = ?';     params.push(parseInt(assigned_user_id, 10)); }
  if (project_manager_id) {
    // Filter activities that belong to projects managed by this user
    where += ` AND ob.objective_id IN (
      SELECT ob2.objective_id FROM objectives ob2
      JOIN projects p2 ON p2.project_id = ob2.project_id
      WHERE p2.project_manager_id = ?
    )`;
    params.push(parseInt(project_manager_id, 10));
  }

  const [countRow] = await query(`SELECT COUNT(*) AS total FROM activities a WHERE ${where}`, params);
  const activities = await query(
    `SELECT a.*,
            COALESCE(a.revised_amount, a.budgeted_amount) AS effective_budget,
            COALESCE(a.revised_amount, a.budgeted_amount) - a.total_paid AS available_budget,
            r.region_name,
            au.full_name AS assigned_user_name,
            su.full_name AS supervisor_name,
            t.name       AS target_name
     FROM activities a
     LEFT JOIN regions r     ON r.region_id     = a.region_id
     LEFT JOIN users au      ON au.user_id      = a.assigned_user_id
     LEFT JOIN users su      ON su.user_id      = a.supervisor_id
     LEFT JOIN targets t     ON t.target_id     = a.target_id
     LEFT JOIN objectives ob ON ob.objective_id = t.objective_id
     WHERE ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );

  return { results: activities, ...paginate(countRow.total) };
};

/**
 * Get single activity by ID
 */
const getActivityById = async (id, conn = null) => {
  const exec = conn
    ? (sql, p) => conn.query(sql, p).then(([rows]) => rows)
    : (sql, p) => query(sql, p);

  const rows = await exec(
    `SELECT a.*,
            COALESCE(a.revised_amount, a.budgeted_amount) AS effective_budget,
            r.region_name,
            au.full_name AS assigned_user_name,
            su.full_name AS supervisor_name,
            t.name       AS target_name
     FROM activities a
     LEFT JOIN regions r  ON r.region_id  = a.region_id
     LEFT JOIN users au   ON au.user_id   = a.assigned_user_id
     LEFT JOIN users su   ON su.user_id   = a.supervisor_id
     LEFT JOIN targets t  ON t.target_id  = a.target_id
     WHERE a.activity_id = ?`,
    [id]
  );
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Activity not found');
  const activity = rows[0];

  // Attach sub-activities
  activity.sub_activities = await (exec === query ? query : exec)(
    `SELECT a.activity_id, a.name, a.status, a.progress,
            COALESCE(a.revised_amount, a.budgeted_amount) AS effective_budget
     FROM activities a WHERE a.main_activity_id = ?`,
    [id]
  );

  return activity;
};

/**
 * Update an activity – enforces valid status transitions and tracks history
 */
const updateActivity = async (id, body, updatorId) => {
  const current = await getActivityById(id);

  // Enforce status transition rules
  if (body.status && body.status !== current.status) {
    const allowedTransitions = ACTIVITY_STATUS_TRANSITIONS[current.status] || [];
    if (!allowedTransitions.includes(body.status)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cannot transition activity from "${current.status}" to "${body.status}". ` +
        `Allowed transitions: ${allowedTransitions.length ? allowedTransitions.join(', ') : 'none (terminal status)'}`
      );
    }
  }

  // Auto-set progress to 100 when marking completed
  if (body.status === ACTIVITY_STATUSES.COMPLETED && body.progress === undefined) {
    body.progress = 100;
  }

  const allowed = [
    'name', 'description', 'council', 'ward', 'street', 'road_name',
    'latitude', 'longitude', 'assigned_user_id', 'supervisor_id',
    'start_date', 'end_date', 'progress', 'status',
  ];
  const fields = Object.keys(body).filter((k) => allowed.includes(k));
  if (!fields.length) throw new ApiError(httpStatus.BAD_REQUEST, 'No valid fields to update');

  const result = await transaction(async (conn) => {
    const setClauses = fields.map((f) => `${f} = ?`).join(', ');
    const values = fields.map((f) => body[f] === undefined ? null : body[f]);
    await conn.query(`UPDATE activities SET ${setClauses} WHERE activity_id = ?`, [...values, id]);

    // Track status change in history
    if (body.status && body.status !== current.status) {
      await conn.query(
        'INSERT INTO activity_status_history (activity_id, old_status, new_status, changed_by) VALUES (?,?,?,?)',
        [id, current.status, body.status, updatorId]
      );
    }

    // Sync target spent if status changed (e.g. cancelled frees up budget)
    if (body.status && body.status !== current.status) {
      await syncTargetSpent(current.target_id, conn);
    }

    return getActivityById(id, conn);
  });

  // Auto-update target status AFTER transaction commits — runs on committed data
  if (body.status && body.status !== current.status) {
    await autoUpdateTargetStatus(current.target_id).catch((e) => {
      console.error('autoUpdateTargetStatus failed:', e.message);
    });
  }

  return result;
};

/**
 * Delete an activity — frees its budget from the target
 */
const deleteActivity = async (id) => {
  const rows = await query('SELECT activity_id, target_id FROM activities WHERE activity_id = ?', [id]);
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Activity not found');
  const { target_id } = rows[0];

  await query('DELETE FROM activities WHERE activity_id = ?', [id]);
  await syncTargetSpent(target_id);
};

/**
 * Get status history for an activity
 */
const getActivityStatusHistory = async (activityId) => {
  return query(
    `SELECT h.*, u.full_name AS changed_by_name
     FROM activity_status_history h
     LEFT JOIN users u ON u.user_id = h.changed_by
     WHERE h.activity_id = ? ORDER BY h.changed_at DESC`,
    [activityId]
  );
};

/**
 * Get sub-activities for a parent activity
 */
const getSubActivities = async (parentId) => {
  return query(
    `SELECT a.*,
            COALESCE(a.revised_amount, a.budgeted_amount) AS effective_budget,
            r.region_name, au.full_name AS assigned_user_name, t.name AS target_name
     FROM activities a
     LEFT JOIN regions r  ON r.region_id  = a.region_id
     LEFT JOIN users au   ON au.user_id   = a.assigned_user_id
     LEFT JOIN targets t  ON t.target_id  = a.target_id
     WHERE a.main_activity_id = ? ORDER BY a.created_at`,
    [parentId]
  );
};


/**
 * Auto-update target status based on its activities
 * Rules:
 *   - If deadline passed + target not achieved → Missed
 *   - If >= 30% activities are overdue/delayed → At Risk
 *   - If all activities completed → Achieved
 *   - Otherwise → On Track
 */
const autoUpdateTargetStatus = async (targetId) => {
  const target = await query('SELECT * FROM targets WHERE target_id = ?', [targetId]);
  if (!target.length) return;
  const t = target[0];

  // Already manually set to achieved/missed — don't override
  if (t.status === 'achieved') return;

  const acts = await query(
    `SELECT status, end_date FROM activities WHERE target_id = ? AND main_activity_id IS NULL`,
    [targetId]
  );
  if (!acts.length) return;

  const now      = new Date();
  const total    = acts.length;
  const completed = acts.filter(a => a.status === 'completed').length;
  const overdue  = acts.filter(a => a.status === 'overdue').length;
  const cancelled = acts.filter(a => a.status === 'cancelled').length;
  const active   = total - cancelled;
  const deadlinePassed = t.deadline && new Date(t.deadline) < now;

  let newStatus = t.status; // keep current by default

  if (deadlinePassed && completed < active) {
    newStatus = 'missed';
  } else if (active > 0 && completed === active) {
    newStatus = 'achieved';
  } else if (active > 0 && overdue / active >= 0.3) {
    // 30%+ activities overdue → at risk
    newStatus = 'at_risk';
  } else if (t.status === 'at_risk' && overdue / active < 0.3) {
    // Recovered
    newStatus = 'on_track';
  }

  if (newStatus !== t.status) {
    await query('UPDATE targets SET status = ? WHERE target_id = ?', [newStatus, targetId]);
  }
};

module.exports = {
  createActivity, getActivities, getActivityById, updateActivity,
  deleteActivity, getActivityStatusHistory, getSubActivities, autoUpdateTargetStatus,
};
