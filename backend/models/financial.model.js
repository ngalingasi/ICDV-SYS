const { query } = require('../config/database');

/**
 * Build a project filter clause that joins through objectives
 * @param {number|null} projectId
 * @returns {string} SQL AND clause
 */
const projectClause = (projectId) =>
  projectId ? `AND ob.project_id = ${parseInt(projectId, 10)}` : '';

const getTotals = async (projectId) => {
  const [row] = await query(`
    SELECT
      COUNT(a.activity_id)                                                    AS activity_count,
      COALESCE(SUM(COALESCE(a.revised_amount, a.budgeted_amount)), 0)         AS total_budget,
      COALESCE(SUM(a.total_paid), 0)                                          AS total_paid,
      COALESCE(SUM(COALESCE(a.revised_amount, a.budgeted_amount))
               - SUM(a.total_paid), 0)                                        AS remaining,
      COALESCE(SUM(CASE WHEN a.revised_amount IS NOT NULL
                        THEN a.revised_amount - a.budgeted_amount
                        ELSE 0 END), 0)                                       AS total_revision_delta
    FROM activities a
    JOIN targets    t  ON t.target_id     = a.target_id
    JOIN objectives ob ON ob.objective_id = t.objective_id
    WHERE a.status != 'cancelled' ${projectClause(projectId)}
  `, []);
  return row;
};

const getBuckets = async (projectId) => {
  return query(`
    SELECT
      CASE
        WHEN a.total_paid > COALESCE(a.revised_amount, a.budgeted_amount) THEN 'over_budget'
        WHEN a.total_paid = COALESCE(a.revised_amount, a.budgeted_amount) THEN 'fully_spent'
        WHEN a.total_paid = 0                                             THEN 'no_spend'
        ELSE                                                                   'within_budget'
      END                                                                     AS bucket,
      COUNT(*)                                                                AS count,
      COALESCE(SUM(COALESCE(a.revised_amount, a.budgeted_amount)), 0)         AS budget,
      COALESCE(SUM(a.total_paid), 0)                                          AS paid
    FROM activities a
    JOIN targets    t  ON t.target_id     = a.target_id
    JOIN objectives ob ON ob.objective_id = t.objective_id
    WHERE a.status != 'cancelled' ${projectClause(projectId)}
    GROUP BY bucket
  `, []);
};

const getPaymentStatus = async (projectId) => {
  const [row] = await query(`
    SELECT
      COALESCE(SUM(CASE WHEN p.status = 'approved' THEN p.amount ELSE 0 END), 0) AS approved,
      COALESCE(SUM(CASE WHEN p.status = 'pending'  THEN p.amount ELSE 0 END), 0) AS pending,
      COALESCE(SUM(CASE WHEN p.status = 'rejected' THEN p.amount ELSE 0 END), 0) AS rejected,
      COUNT(CASE WHEN p.status = 'approved' THEN 1 END)                          AS approved_count,
      COUNT(CASE WHEN p.status = 'pending'  THEN 1 END)                          AS pending_count,
      COUNT(CASE WHEN p.status = 'rejected' THEN 1 END)                          AS rejected_count
    FROM activity_payments p
    JOIN activities a  ON a.activity_id  = p.activity_id
    JOIN targets    t  ON t.target_id    = a.target_id
    JOIN objectives ob ON ob.objective_id = t.objective_id
    WHERE 1=1 ${projectClause(projectId)}
  `, []);
  return row;
};

const getCashFlow = async (projectId) => {
  return query(`
    SELECT
      DATE_FORMAT(p.payment_date, '%Y-%m') AS month,
      COALESCE(SUM(p.amount), 0)           AS amount,
      COUNT(*)                             AS count
    FROM activity_payments p
    JOIN activities a  ON a.activity_id  = p.activity_id
    JOIN targets    t  ON t.target_id    = a.target_id
    JOIN objectives ob ON ob.objective_id = t.objective_id
    WHERE p.status = 'approved'
      AND p.payment_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
      ${projectClause(projectId)}
    GROUP BY month
    ORDER BY month ASC
  `, []);
};

const getRevisionSummary = async (projectId) => {
  const [row] = await query(`
    SELECT
      COUNT(*)                                                                  AS total_revisions,
      COALESCE(SUM(CASE WHEN br.status = 'approved'
        THEN br.requested_amount - a.budgeted_amount ELSE 0 END), 0)           AS approved_revision_total,
      COUNT(CASE WHEN br.status = 'pending'  THEN 1 END)                       AS pending_revisions,
      COUNT(CASE WHEN br.status = 'approved' THEN 1 END)                       AS approved_revisions,
      COUNT(CASE WHEN br.status = 'rejected' THEN 1 END)                       AS rejected_revisions
    FROM budget_revisions br
    JOIN activities a  ON a.activity_id  = br.activity_id
    JOIN targets    t  ON t.target_id    = a.target_id
    JOIN objectives ob ON ob.objective_id = t.objective_id
    WHERE 1=1 ${projectClause(projectId)}
  `, []);
  return row;
};

const getTopSpend = async (projectId) => {
  return query(`
    SELECT
      a.activity_id,
      a.name,
      a.status,
      COALESCE(a.revised_amount, a.budgeted_amount)                AS effective_budget,
      a.total_paid,
      COALESCE(a.revised_amount, a.budgeted_amount) - a.total_paid AS remaining,
      CASE
        WHEN a.total_paid > COALESCE(a.revised_amount, a.budgeted_amount) THEN 'over_budget'
        WHEN a.total_paid = 0                                             THEN 'no_spend'
        ELSE                                                                   'within_budget'
      END AS budget_status
    FROM activities a
    JOIN targets    t  ON t.target_id     = a.target_id
    JOIN objectives ob ON ob.objective_id = t.objective_id
    WHERE a.total_paid > 0 ${projectClause(projectId)}
    ORDER BY a.total_paid DESC
    LIMIT 8
  `, []);
};

module.exports = {
  getTotals,
  getBuckets,
  getPaymentStatus,
  getCashFlow,
  getRevisionSummary,
  getTopSpend,
};
