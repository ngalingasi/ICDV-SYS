const httpStatus = require('http-status');
const { query, transaction } = require('../config/database');
const ApiError = require('../utils/ApiError');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get the project's total budget and how much is already allocated to targets
 */
const getProjectBudgetStatus = async (projectId, conn = null) => {
  const exec = conn
    ? (sql, p) => conn.query(sql, p).then(([r]) => r)
    : (sql, p) => query(sql, p);

  const [project] = await exec(
    'SELECT project_id, estimated_cost FROM projects WHERE project_id = ?',
    [projectId]
  );
  if (!project) throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');

  const [agg] = await exec(
    `SELECT COALESCE(SUM(t.allocated_budget), 0) AS allocated
     FROM targets t
     JOIN objectives o ON o.objective_id = t.objective_id
     WHERE o.project_id = ?`,
    [projectId]
  );

  return {
    total:       Number(project.estimated_cost),
    allocated:   Number(agg.allocated),
    available:   Number(project.estimated_cost) - Number(agg.allocated),
  };
};

/**
 * Get a target's budget and how much is committed across its activities
 */
const getTargetBudgetStatus = async (targetId, conn = null) => {
  const exec = conn
    ? (sql, p) => conn.query(sql, p).then(([r]) => r)
    : (sql, p) => query(sql, p);

  const [target] = await exec(
    'SELECT target_id, allocated_budget, spent_amount FROM targets WHERE target_id = ?',
    [targetId]
  );
  if (!target) throw new ApiError(httpStatus.NOT_FOUND, 'Target not found');

  const [agg] = await exec(
    `SELECT COALESCE(SUM(budgeted_amount), 0)  AS committed,
            COALESCE(SUM(revised_amount), 0)   AS revised_committed
     FROM activities
     WHERE target_id = ?`,
    [targetId]
  );

  const allocated  = Number(target.allocated_budget);
  const committed  = Number(agg.committed);
  const available  = allocated - committed;

  return { allocated, committed, available, spent: Number(target.spent_amount) };
};

// ─────────────────────────────────────────────────────────────────────────────
// TARGET BUDGET ALLOCATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Allocate (or re-allocate) budget to a target.
 * Checks total project budget is not exceeded.
 */
const allocateTargetBudget = async (targetId, amount, updatorId) => {
  return transaction(async (conn) => {
    const exec = (sql, p) => conn.query(sql, p).then(([r]) => r);

    const [target] = await exec(
      `SELECT t.*, o.project_id
       FROM targets t
       JOIN objectives o ON o.objective_id = t.objective_id
       WHERE t.target_id = ?`,
      [targetId]
    );
    if (!target) throw new ApiError(httpStatus.NOT_FOUND, 'Target not found');

    // Project budget check — exclude current target's own allocation from the sum
    const [agg] = await exec(
      `SELECT COALESCE(SUM(t2.allocated_budget), 0) AS already_allocated
       FROM targets t2
       JOIN objectives o2 ON o2.objective_id = t2.objective_id
       WHERE o2.project_id = ? AND t2.target_id != ?`,
      [target.project_id, targetId]
    );

    const [proj] = await exec(
      'SELECT estimated_cost FROM projects WHERE project_id = ?',
      [target.project_id]
    );

    const totalBudget      = Number(proj.estimated_cost);
    const otherAllocations = Number(agg.already_allocated);
    const available        = totalBudget - otherAllocations;

    if (amount > available) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Insufficient project budget. ` +
        `Requested: ${fmt(amount)}, Available: ${fmt(available)} ` +
        `(Project total: ${fmt(totalBudget)}, Already allocated to other targets: ${fmt(otherAllocations)})`
      );
    }

    // Check new allocation is not less than already committed activities
    const [actAgg] = await exec(
      'SELECT COALESCE(SUM(budgeted_amount), 0) AS committed FROM activities WHERE target_id = ?',
      [targetId]
    );
    if (amount < Number(actAgg.committed)) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cannot reduce target budget below committed activity budgets. ` +
        `Activities already committed: ${fmt(actAgg.committed)}`
      );
    }

    await exec(
      'UPDATE targets SET allocated_budget = ? WHERE target_id = ?',
      [amount, targetId]
    );

    return getTargetBudgetStatus(targetId);
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY BUDGET VALIDATION (used at creation)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate that a new activity budget amount fits within the target's available budget.
 * Must be called inside the same transaction as the INSERT.
 */
const validateActivityBudget = async (targetId, amount, conn) => {
  const exec = (sql, p) => conn.query(sql, p).then(([r]) => r);

  const [target] = await exec(
    'SELECT allocated_budget FROM targets WHERE target_id = ?',
    [targetId]
  );
  if (!target) throw new ApiError(httpStatus.NOT_FOUND, 'Target not found');

  const [agg] = await exec(
    'SELECT COALESCE(SUM(budgeted_amount), 0) AS committed FROM activities WHERE target_id = ?',
    [targetId]
  );

  const allocated = Number(target.allocated_budget);
  const committed = Number(agg.committed);
  const available = allocated - committed;

  // Block if target has no budget allocated yet
  if (allocated === 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      'Target has no budget allocated. Please allocate budget to the target before adding activities.'
    );
  }

  // Block if activity budget exceeds available balance
  if (amount > available) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Activity budget exceeds target available budget. ` +
      `Requested: ${fmt(amount)}, Available: ${fmt(available)} ` +
      `(Target allocated: ${fmt(allocated)}, Already committed: ${fmt(committed)})`
    );
  }
};

/**
 * After activity is saved, update target's spent_amount tracker
 */
const syncTargetSpent = async (targetId, conn = null) => {
  const exec = conn
    ? (sql, p) => conn.query(sql, p)
    : (sql, p) => query(sql, p);

  await exec(
    `UPDATE targets
     SET spent_amount = (
       SELECT COALESCE(SUM(COALESCE(revised_amount, budgeted_amount)), 0)
       FROM activities
       WHERE target_id = ? AND status NOT IN ('cancelled')
     )
     WHERE target_id = ?`,
    [targetId, targetId]
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BUDGET REVISION REQUESTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Submit a budget revision request for an activity
 */
const requestBudgetRevision = async (activityId, requestedAmount, reason, requestedBy) => {
  // Fetch current activity budget
  const rows = await query(
    'SELECT activity_id, target_id, budgeted_amount, revised_amount, status FROM activities WHERE activity_id = ?',
    [activityId]
  );
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Activity not found');
  const activity = rows[0];

  if (['cancelled', 'completed'].includes(activity.status)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Cannot request budget revision for a ${activity.status} activity`
    );
  }

  // Block if there's already a pending revision
  const pending = await query(
    'SELECT revision_id FROM budget_revisions WHERE activity_id = ? AND status = "pending"',
    [activityId]
  );
  if (pending.length) {
    throw new ApiError(
      httpStatus.CONFLICT,
      'There is already a pending budget revision request for this activity'
    );
  }

  const currentAmount = Number(activity.revised_amount ?? activity.budgeted_amount);

  if (requestedAmount <= currentAmount) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Requested amount (${fmt(requestedAmount)}) must be greater than current budget (${fmt(currentAmount)})`
    );
  }

  const result = await query(
    `INSERT INTO budget_revisions (activity_id, requested_by, current_amount, requested_amount, reason)
     VALUES (?,?,?,?,?)`,
    [activityId, requestedBy, currentAmount, requestedAmount, reason]
  );

  return getRevisionById(result.insertId);
};

/**
 * Approve a budget revision — checks target budget still has room
 */
const approveRevision = async (revisionId, reviewerId, reviewNotes = null) => {
  return transaction(async (conn) => {
    const exec = (sql, p) => conn.query(sql, p).then(([r]) => r);

    const [revision] = await exec(
      `SELECT br.*, a.target_id, a.budgeted_amount, a.revised_amount
       FROM budget_revisions br
       JOIN activities a ON a.activity_id = br.activity_id
       WHERE br.revision_id = ?`,
      [revisionId]
    );
    if (!revision) throw new ApiError(httpStatus.NOT_FOUND, 'Revision not found');
    if (revision.status !== 'pending') {
      throw new ApiError(httpStatus.BAD_REQUEST, `Revision is already ${revision.status}`);
    }

    // Check target has enough room for the extra amount
    const currentActivityBudget = Number(revision.revised_amount ?? revision.budgeted_amount);
    const extraNeeded = Number(revision.requested_amount) - currentActivityBudget;

    const [tgt] = await exec(
      'SELECT allocated_budget FROM targets WHERE target_id = ?',
      [revision.target_id]
    );
    const [actAgg] = await exec(
      `SELECT COALESCE(SUM(budgeted_amount), 0) AS committed
       FROM activities
       WHERE target_id = ? AND activity_id != ?`,
      [revision.target_id, revision.activity_id]
    );

    const allocated  = Number(tgt.allocated_budget);
    const otherCommitted = Number(actAgg.committed);
    const currentThis    = currentActivityBudget;
    const available      = allocated - otherCommitted - currentThis;

    if (extraNeeded > available) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Cannot approve: Target only has ${fmt(available)} available. ` +
        `Extra needed: ${fmt(extraNeeded)}. Consider increasing the target's allocated budget first.`
      );
    }

    // Approve: update revision record
    await exec(
      `UPDATE budget_revisions
       SET status = 'approved', reviewed_by = ?, review_notes = ?, reviewed_at = NOW()
       WHERE revision_id = ?`,
      [reviewerId, reviewNotes, revisionId]
    );

    // Apply new budget to activity
    await exec(
      'UPDATE activities SET revised_amount = ? WHERE activity_id = ?',
      [revision.requested_amount, revision.activity_id]
    );

    // Sync target spent tracker
    await conn.query(
      `UPDATE targets
       SET spent_amount = (
         SELECT COALESCE(SUM(COALESCE(revised_amount, budgeted_amount)), 0)
         FROM activities
         WHERE target_id = ? AND status NOT IN ('cancelled')
       )
       WHERE target_id = ?`,
      [revision.target_id, revision.target_id]
    );

    return getRevisionById(revisionId);
  });
};

/**
 * Reject a budget revision request
 */
const rejectRevision = async (revisionId, reviewerId, reviewNotes) => {
  const rows = await query(
    'SELECT * FROM budget_revisions WHERE revision_id = ?',
    [revisionId]
  );
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Revision not found');
  if (rows[0].status !== 'pending') {
    throw new ApiError(httpStatus.BAD_REQUEST, `Revision is already ${rows[0].status}`);
  }

  await query(
    `UPDATE budget_revisions
     SET status = 'rejected', reviewed_by = ?, review_notes = ?, reviewed_at = NOW()
     WHERE revision_id = ?`,
    [reviewerId, reviewNotes, revisionId]
  );

  return getRevisionById(revisionId);
};

/**
 * List revision requests — filterable by activity, status
 */
const getRevisions = async ({ activity_id, status, page = 1, limit = 20 } = {}) => {
  let where = '1=1';
  const params = [];
  if (activity_id) { where += ' AND br.activity_id = ?'; params.push(activity_id); }
  if (status)      { where += ' AND br.status = ?';      params.push(status); }

  return query(
    `SELECT br.*,
            a.name       AS activity_name,
            u.full_name  AS requested_by_name,
            r.full_name  AS reviewed_by_name
     FROM budget_revisions br
     JOIN activities a ON a.activity_id = br.activity_id
     JOIN users u      ON u.user_id     = br.requested_by
     LEFT JOIN users r ON r.user_id     = br.reviewed_by
     WHERE ${where}
     ORDER BY br.created_at DESC`,
    params
  );
};

/**
 * Get a single revision by ID
 */
const getRevisionById = async (id) => {
  const rows = await query(
    `SELECT br.*,
            a.name       AS activity_name,
            u.full_name  AS requested_by_name,
            r.full_name  AS reviewed_by_name
     FROM budget_revisions br
     JOIN activities a ON a.activity_id = br.activity_id
     JOIN users u      ON u.user_id     = br.requested_by
     LEFT JOIN users r ON r.user_id     = br.reviewed_by
     WHERE br.revision_id = ?`,
    [id]
  );
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Revision not found');
  return rows[0];
};

/**
 * Get project budget summary
 */
const getProjectBudgetSummary = async (projectId) => {
  const rows = await query(
    'SELECT * FROM v_project_budget_summary WHERE project_id = ?',
    [projectId]
  );
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Project not found');
  return rows[0];
};

/**
 * Get target budget summary
 */
const getTargetBudgetSummary = async (targetId) => {
  const rows = await query(
    'SELECT * FROM v_target_budget_summary WHERE target_id = ?',
    [targetId]
  );
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Target not found');
  return rows[0];
};

// ─────────────────────────────────────────────────────────────────────────────
// UTIL
// ─────────────────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 });

module.exports = {
  getProjectBudgetStatus,
  getTargetBudgetStatus,
  allocateTargetBudget,
  validateActivityBudget,
  syncTargetSpent,
  requestBudgetRevision,
  approveRevision,
  rejectRevision,
  getRevisions,
  getRevisionById,
  getProjectBudgetSummary,
  getTargetBudgetSummary,
};
