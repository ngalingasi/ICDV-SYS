/**
 * insights.model.js
 *
 * "Insights" is the umbrella for BI-style dashboards built on top of the
 * existing operational data (invoices, expenses, manifests). The first
 * dashboard is "Profit & Loss". More can be added later without renaming
 * anything, since each lives at its own endpoint.
 *
 * Profit & Loss definitions used throughout:
 *   - Billed revenue  = sum of invoice total_amount, any non-cancelled status
 *   - Paid revenue    = sum of invoice total_amount, status = 'paid' only
 *   - Outstanding     = billed - paid (invoiced/approved, not yet collected)
 *   - Expenses        = sum of expense total_amount (no workflow, always "real")
 *   - Billed profit   = billed revenue - expenses   (profit "on paper")
 *   - Paid profit     = paid revenue   - expenses   (profit actually realized)
 *
 * Per-manifest rows: a manifest with no invoice contributes revenue=0
 * (pure cost); a manifest with no expense contributes expense=0 (pure
 * profit on whatever was billed/paid). Neither side is ever excluded.
 */

'use strict';

const { query } = require('../config/database');
const { buildPagination } = require('../utils/paginate');

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const dateRangeClause = (col, dateFrom, dateTo, params) => {
  let clause = '';
  if (dateFrom) { clause += ` AND ${col} >= ?`; params.push(dateFrom); }
  if (dateTo)   { clause += ` AND ${col} <= ?`; params.push(dateTo); }
  return clause;
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. OVERALL SUMMARY (billed / paid / outstanding / expenses / profit)
// ─────────────────────────────────────────────────────────────────────────────

const getProfitSummary = async ({ date_from, date_to } = {}) => {
  const invParams = [];
  const invDateClause = dateRangeClause('issued_date', date_from, date_to, invParams);

  const [invRow] = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_amount ELSE 0 END), 0) AS billed_revenue,
       COALESCE(SUM(CASE WHEN status = 'paid'        THEN total_amount ELSE 0 END), 0) AS paid_revenue,
       COUNT(CASE WHEN status != 'cancelled' THEN 1 END) AS invoice_count,
       COUNT(CASE WHEN status = 'paid'        THEN 1 END) AS paid_count,
       COUNT(CASE WHEN status IN ('invoiced','approved') THEN 1 END) AS outstanding_count
     FROM invoices WHERE 1=1 ${invDateClause}`,
    invParams
  );

  const expParams = [];
  const expDateClause = dateRangeClause('expense_date', date_from, date_to, expParams);
  const [expRow] = await query(
    `SELECT COALESCE(SUM(total_amount), 0) AS total_expenses, COUNT(*) AS expense_count
     FROM expenses WHERE 1=1 ${expDateClause}`,
    expParams
  );

  const billed_revenue  = Number(invRow.billed_revenue);
  const paid_revenue    = Number(invRow.paid_revenue);
  const outstanding     = parseFloat((billed_revenue - paid_revenue).toFixed(2));
  const total_expenses  = Number(expRow.total_expenses);
  const billed_profit   = parseFloat((billed_revenue - total_expenses).toFixed(2));
  const paid_profit     = parseFloat((paid_revenue - total_expenses).toFixed(2));

  return {
    billed_revenue, paid_revenue, outstanding, total_expenses,
    billed_profit, paid_profit,
    billed_margin_pct: billed_revenue ? parseFloat(((billed_profit / billed_revenue) * 100).toFixed(1)) : 0,
    paid_margin_pct:   paid_revenue   ? parseFloat(((paid_profit   / paid_revenue)   * 100).toFixed(1)) : 0,
    invoice_count:      Number(invRow.invoice_count),
    paid_count:         Number(invRow.paid_count),
    outstanding_count:  Number(invRow.outstanding_count),
    expense_count:      Number(expRow.expense_count),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. PROFIT BY ICDV
// ─────────────────────────────────────────────────────────────────────────────

const getProfitByIcdv = async ({ date_from, date_to } = {}) => {
  const invParams = [];
  const invDateClause = dateRangeClause('inv.issued_date', date_from, date_to, invParams);
  const expParams = [];
  const expDateClause = dateRangeClause('e.expense_date', date_from, date_to, expParams);

  const rows = await query(
    `SELECT
       i.icdv_id, i.name AS icdv_name, i.code AS icdv_code,
       COALESCE(rev.billed_revenue, 0) AS billed_revenue,
       COALESCE(rev.paid_revenue, 0)   AS paid_revenue,
       COALESCE(exp.total_expenses, 0) AS total_expenses
     FROM icdvs i
     LEFT JOIN (
       SELECT inv.icdv_id,
         SUM(CASE WHEN inv.status != 'cancelled' THEN inv.total_amount ELSE 0 END) AS billed_revenue,
         SUM(CASE WHEN inv.status = 'paid'        THEN inv.total_amount ELSE 0 END) AS paid_revenue
       FROM invoices inv WHERE 1=1 ${invDateClause}
       GROUP BY inv.icdv_id
     ) rev ON rev.icdv_id = i.icdv_id
     LEFT JOIN (
       SELECT e.icdv_id, SUM(e.total_amount) AS total_expenses
       FROM expenses e WHERE 1=1 ${expDateClause}
       GROUP BY e.icdv_id
     ) exp ON exp.icdv_id = i.icdv_id
     WHERE i.is_active = 1
       AND (rev.billed_revenue IS NOT NULL OR exp.total_expenses IS NOT NULL)
     ORDER BY paid_revenue DESC`,
    [...invParams, ...expParams]
  );

  return rows.map(r => {
    const billed = Number(r.billed_revenue);
    const paid   = Number(r.paid_revenue);
    const exp    = Number(r.total_expenses);
    const billed_profit = parseFloat((billed - exp).toFixed(2));
    const paid_profit   = parseFloat((paid - exp).toFixed(2));
    return {
      icdv_id: r.icdv_id, icdv_name: r.icdv_name, icdv_code: r.icdv_code,
      billed_revenue: billed, paid_revenue: paid, total_expenses: exp,
      billed_profit, paid_profit,
      paid_margin_pct: paid ? parseFloat(((paid_profit / paid) * 100).toFixed(1)) : 0,
    };
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. PROFIT TREND (monthly buckets)
// ─────────────────────────────────────────────────────────────────────────────

const getProfitTrend = async ({ months = 6 } = {}) => {
  const m = Math.min(Math.max(parseInt(months, 10) || 6, 1), 24);

  const revRows = await query(
    `SELECT DATE_FORMAT(issued_date, '%Y-%m') AS month,
       SUM(CASE WHEN status != 'cancelled' THEN total_amount ELSE 0 END) AS billed_revenue,
       SUM(CASE WHEN status = 'paid'        THEN total_amount ELSE 0 END) AS paid_revenue
     FROM invoices
     WHERE issued_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
     GROUP BY month ORDER BY month`,
    [m]
  );

  const expRows = await query(
    `SELECT DATE_FORMAT(expense_date, '%Y-%m') AS month, SUM(total_amount) AS total_expenses
     FROM expenses
     WHERE expense_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
     GROUP BY month ORDER BY month`,
    [m]
  );

  // Merge into a month -> {billed, paid, expenses} map, then fill gaps
  // so the chart always shows a continuous M-month range even for months
  // with zero activity.
  const map = {};
  revRows.forEach(r => { map[r.month] = { billed_revenue: Number(r.billed_revenue), paid_revenue: Number(r.paid_revenue), total_expenses: 0 }; });
  expRows.forEach(r => {
    if (!map[r.month]) map[r.month] = { billed_revenue: 0, paid_revenue: 0, total_expenses: 0 };
    map[r.month].total_expenses = Number(r.total_expenses);
  });

  const out = [];
  const now = new Date();
  for (let i = m - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const entry = map[key] || { billed_revenue: 0, paid_revenue: 0, total_expenses: 0 };
    out.push({
      month: key,
      billed_revenue: entry.billed_revenue,
      paid_revenue:   entry.paid_revenue,
      total_expenses: entry.total_expenses,
      billed_profit:  parseFloat((entry.billed_revenue - entry.total_expenses).toFixed(2)),
      paid_profit:    parseFloat((entry.paid_revenue   - entry.total_expenses).toFixed(2)),
    });
  }
  return out;
};

// ─────────────────────────────────────────────────────────────────────────────
// 3b. REVENUE BY STATUS, MONTHLY (Paid / Outstanding / Cancelled)
// ─────────────────────────────────────────────────────────────────────────────
//
// A second view of the same monthly window as getProfitTrend, but split by
// invoice status instead of revenue-vs-expense. "Outstanding" here groups
// 'invoiced' + 'approved' (billed but not yet collected) into one series,
// matching how the rest of the dashboard defines outstanding.

const getRevenueByStatusTrend = async ({ months = 6 } = {}) => {
  const m = Math.min(Math.max(parseInt(months, 10) || 6, 1), 24);

  const rows = await query(
    `SELECT DATE_FORMAT(issued_date, '%Y-%m') AS month,
       SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) AS paid,
       SUM(CASE WHEN status IN ('invoiced','approved') THEN total_amount ELSE 0 END) AS outstanding,
       SUM(CASE WHEN status = 'cancelled' THEN total_amount ELSE 0 END) AS cancelled
     FROM invoices
     WHERE issued_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
     GROUP BY month ORDER BY month`,
    [m]
  );

  const map = {};
  rows.forEach(r => { map[r.month] = { paid: Number(r.paid), outstanding: Number(r.outstanding), cancelled: Number(r.cancelled) }; });

  const out = [];
  const now = new Date();
  for (let i = m - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const entry = map[key] || { paid: 0, outstanding: 0, cancelled: 0 };
    out.push({ month: key, ...entry });
  }
  return out;
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. PROFIT BY MANIFEST
// ─────────────────────────────────────────────────────────────────────────────
//
// Revenue here is derived from invoice_line_items.manifest_id (a manifest
// can appear across multiple invoice lines / multiple invoices). Expenses
// are derived from expenses.manifest_id directly (one expense = one manifest).
// A manifest appears in this table if EITHER side has data — the missing
// side is treated as zero, never excluded (confirmed default behavior).

const getProfitByManifest = async ({ page, limit, icdv_id, search, date_from, date_to } = {}) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);

  const params = [];
  let where = '1=1';
  if (icdv_id) { where += ' AND m.icdv_id=?'; params.push(icdv_id); }
  if (search)  { where += ' AND (m.manifest_number LIKE ? OR i.name LIKE ? OR v.name LIKE ?)'; params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  if (date_from) { where += ' AND m.arrival_date >= ?'; params.push(date_from); }
  if (date_to)   { where += ' AND m.arrival_date <= ?'; params.push(date_to); }

  const [{ total }] = await query(
    `SELECT COUNT(*) AS total
     FROM manifests m
     JOIN icdvs i   ON i.icdv_id  = m.icdv_id
     JOIN vessels v ON v.vessel_id = m.vessel_id
     LEFT JOIN (
       SELECT ili.manifest_id,
         SUM(CASE WHEN inv.status != 'cancelled' THEN ili.line_total ELSE 0 END) AS billed_revenue,
         SUM(CASE WHEN inv.status = 'paid'        THEN ili.line_total ELSE 0 END) AS paid_revenue
       FROM invoice_line_items ili
       JOIN invoices inv ON inv.invoice_id = ili.invoice_id
       WHERE ili.manifest_id IS NOT NULL
       GROUP BY ili.manifest_id
     ) rev ON rev.manifest_id = m.manifest_id
     LEFT JOIN (
       SELECT manifest_id, SUM(total_amount) AS total_expenses
       FROM expenses GROUP BY manifest_id
     ) exp ON exp.manifest_id = m.manifest_id
     WHERE ${where} AND (rev.billed_revenue IS NOT NULL OR exp.total_expenses IS NOT NULL)`,
    params
  );

  const rows = await query(
    `SELECT
       m.manifest_id, m.manifest_number, m.arrival_date,
       i.icdv_id, i.name AS icdv_name,
       v.name AS vessel_name,
       COALESCE(rev.billed_revenue, 0) AS billed_revenue,
       COALESCE(rev.paid_revenue, 0)   AS paid_revenue,
       COALESCE(exp.total_expenses, 0) AS total_expenses
     FROM manifests m
     JOIN icdvs i   ON i.icdv_id  = m.icdv_id
     JOIN vessels v ON v.vessel_id = m.vessel_id
     LEFT JOIN (
       SELECT ili.manifest_id,
         SUM(CASE WHEN inv.status != 'cancelled' THEN ili.line_total ELSE 0 END) AS billed_revenue,
         SUM(CASE WHEN inv.status = 'paid'        THEN ili.line_total ELSE 0 END) AS paid_revenue
       FROM invoice_line_items ili
       JOIN invoices inv ON inv.invoice_id = ili.invoice_id
       WHERE ili.manifest_id IS NOT NULL
       GROUP BY ili.manifest_id
     ) rev ON rev.manifest_id = m.manifest_id
     LEFT JOIN (
       SELECT manifest_id, SUM(total_amount) AS total_expenses
       FROM expenses GROUP BY manifest_id
     ) exp ON exp.manifest_id = m.manifest_id
     WHERE ${where} AND (rev.billed_revenue IS NOT NULL OR exp.total_expenses IS NOT NULL)
     ORDER BY m.arrival_date DESC, m.manifest_id DESC
     LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );

  const mapped = rows.map(r => {
    const billed = Number(r.billed_revenue);
    const paid   = Number(r.paid_revenue);
    const exp    = Number(r.total_expenses);
    return {
      manifest_id: r.manifest_id, manifest_number: r.manifest_number, arrival_date: r.arrival_date,
      icdv_id: r.icdv_id, icdv_name: r.icdv_name, vessel_name: r.vessel_name,
      billed_revenue: billed, paid_revenue: paid, total_expenses: exp,
      billed_profit: parseFloat((billed - exp).toFixed(2)),
      paid_profit:   parseFloat((paid   - exp).toFixed(2)),
    };
  });

  return paginate(mapped, total);
};

// ================================================================================
// TRANSFER TURNAROUND
//
// Duration = TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at)
// Only completed transfers (completed_at IS NOT NULL) appear in timing stats.
// Active/in-transit transfers appear in the in_transit_now count only.
//
// Threshold classification per ICDV (transit_time_configs):
//   <= normal_minutes  → on_time
//   <= max_minutes     → delayed
//   >  max_minutes     → very_late
// ================================================================================

const DEFAULT_NORMAL_MIN = 30;
const DEFAULT_MAX_MIN    = 60;

const dateClause = (col, from, to, params) => {
  let c = '';
  if (from) { c += ` AND DATE(${col}) >= ?`; params.push(from); }
  if (to)   { c += ` AND DATE(${col}) <= ?`; params.push(to);   }
  return c;
};

const getTurnaroundSummary = async ({ date_from, date_to } = {}) => {
  const params = [];
  const dc = dateClause('t.transferred_at', date_from, date_to, params);

  const [row] = await query(
    `SELECT
       COUNT(*)                                                         AS total_transfers,
       COUNT(CASE WHEN t.completed_at IS NULL THEN 1 END)              AS in_transit_now,
       COUNT(CASE WHEN t.completed_at IS NOT NULL THEN 1 END)          AS completed,
       ROUND(AVG(CASE WHEN t.completed_at IS NOT NULL
         THEN TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at) END), 1) AS avg_minutes,
       MIN(CASE WHEN t.completed_at IS NOT NULL
         THEN TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at) END)     AS min_minutes,
       MAX(CASE WHEN t.completed_at IS NOT NULL
         THEN TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at) END)     AS max_minutes
     FROM transfers t
     WHERE 1=1 ${dc}`,
    params
  );

  const normal = DEFAULT_NORMAL_MIN;
  const max    = DEFAULT_MAX_MIN;
  const classParams = [...params];
  const [cls] = await query(
    `SELECT
       COUNT(CASE WHEN t.completed_at IS NOT NULL
         AND TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at) <= ? THEN 1 END) AS cnt_on_time,
       COUNT(CASE WHEN t.completed_at IS NOT NULL
         AND TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at) > ?
         AND TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at) <= ? THEN 1 END) AS cnt_delayed,
       COUNT(CASE WHEN t.completed_at IS NOT NULL
         AND TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at) > ? THEN 1 END) AS cnt_very_late
     FROM transfers t
     WHERE 1=1 ${dc}`,
    [normal, normal, max, max, ...classParams]
  );

  const completed = Number(row.completed) || 0;
  return {
    total_transfers: Number(row.total_transfers),
    in_transit_now:  Number(row.in_transit_now),
    completed,
    avg_minutes:     row.avg_minutes   !== null ? Number(row.avg_minutes)   : null,
    min_minutes:     row.min_minutes   !== null ? Number(row.min_minutes)   : null,
    max_minutes_val: row.max_minutes   !== null ? Number(row.max_minutes)   : null,
    on_time:         Number(cls.cnt_on_time),
    delayed:         Number(cls.cnt_delayed),
    very_late:       Number(cls.cnt_very_late),
    on_time_pct:   completed ? parseFloat(((Number(cls.cnt_on_time)   / completed) * 100).toFixed(1)) : 0,
    delayed_pct:   completed ? parseFloat(((Number(cls.cnt_delayed)   / completed) * 100).toFixed(1)) : 0,
    very_late_pct: completed ? parseFloat(((Number(cls.cnt_very_late) / completed) * 100).toFixed(1)) : 0,
    normal_threshold: normal,
    max_threshold:    max,
  };
};

const getTurnaroundTrend = async ({ months = 6 } = {}) => {
  const m = Math.min(Math.max(parseInt(months, 10) || 6, 1), 24);

  const rows = await query(
    `SELECT
       DATE_FORMAT(t.transferred_at, '%Y-%m') AS month,
       COUNT(*)                                AS transfers,
       ROUND(AVG(TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at)), 1) AS avg_minutes,
       MIN(TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at))            AS min_minutes,
       MAX(TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at))            AS max_minutes
     FROM transfers t
     WHERE t.completed_at IS NOT NULL
       AND t.transferred_at >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
     GROUP BY month ORDER BY month`,
    [m]
  );

  const map = {};
  rows.forEach(r => {
    map[r.month] = { transfers: Number(r.transfers), avg_minutes: Number(r.avg_minutes), min_minutes: Number(r.min_minutes), max_minutes: Number(r.max_minutes) };
  });

  const out = [];
  const now = new Date();
  for (let i = m - 1; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ month: key, ...(map[key] || { transfers: 0, avg_minutes: null, min_minutes: null, max_minutes: null }) });
  }
  return out;
};

const getTurnaroundByIcdv = async ({ date_from, date_to } = {}) => {
  const params = [];
  const dc = dateClause('t.transferred_at', date_from, date_to, params);

  const rows = await query(
    `SELECT
       i.icdv_id, i.name AS icdv_name, i.code AS icdv_code,
       COALESCE(ttc.normal_minutes, ${DEFAULT_NORMAL_MIN}) AS normal_minutes,
       COALESCE(ttc.max_minutes,    ${DEFAULT_MAX_MIN})    AS max_minutes,
       COUNT(t.transfer_id)                                AS total_transfers,
       COUNT(CASE WHEN t.completed_at IS NOT NULL THEN 1 END) AS completed,
       ROUND(AVG(CASE WHEN t.completed_at IS NOT NULL
         THEN TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at) END), 1) AS avg_minutes,
       COUNT(CASE WHEN t.completed_at IS NOT NULL
         AND TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at)
           <= COALESCE(ttc.normal_minutes, ${DEFAULT_NORMAL_MIN}) THEN 1 END)  AS on_time,
       COUNT(CASE WHEN t.completed_at IS NOT NULL
         AND TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at)
           > COALESCE(ttc.max_minutes, ${DEFAULT_MAX_MIN}) THEN 1 END)         AS very_late
     FROM icdvs i
     JOIN transfers t ON t.icdv_id = i.icdv_id
     LEFT JOIN transit_time_configs ttc ON ttc.icdv_id = i.icdv_id
     WHERE 1=1 ${dc}
     GROUP BY i.icdv_id, i.name, i.code,
              COALESCE(ttc.normal_minutes, ${DEFAULT_NORMAL_MIN}),
              COALESCE(ttc.max_minutes,    ${DEFAULT_MAX_MIN})
     HAVING COUNT(t.transfer_id) > 0
     ORDER BY ROUND(AVG(CASE WHEN t.completed_at IS NOT NULL
       THEN TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at) END), 1) ASC`,
    params
  );

  return rows.map(r => {
    const completed = Number(r.completed) || 0;
    return {
      icdv_id: r.icdv_id, icdv_name: r.icdv_name, icdv_code: r.icdv_code,
      normal_minutes: Number(r.normal_minutes), max_minutes: Number(r.max_minutes),
      total_transfers: Number(r.total_transfers), completed,
      avg_minutes: r.avg_minutes !== null ? Number(r.avg_minutes) : null,
      on_time:    Number(r.on_time),
      very_late:  Number(r.very_late),
      on_time_pct:   completed ? parseFloat(((Number(r.on_time)   / completed) * 100).toFixed(1)) : 0,
      very_late_pct: completed ? parseFloat(((Number(r.very_late) / completed) * 100).toFixed(1)) : 0,
    };
  });
};

const getTurnaroundByDriver = async ({ date_from, date_to, icdv_id } = {}) => {
  const params = [];
  const dc = dateClause('t.transferred_at', date_from, date_to, params);
  let icdvClause = '';
  if (icdv_id) { icdvClause = ' AND t.icdv_id = ?'; params.push(icdv_id); }

  const rows = await query(
    `SELECT
       d.driver_id, d.full_name AS driver_name, d.license_number,
       COUNT(t.transfer_id)                                                     AS total_transfers,
       COUNT(CASE WHEN t.completed_at IS NOT NULL THEN 1 END)                   AS completed,
       ROUND(AVG(CASE WHEN t.completed_at IS NOT NULL
         THEN TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at) END), 1)  AS avg_minutes,
       MIN(CASE WHEN t.completed_at IS NOT NULL
         THEN TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at) END)      AS fastest_minutes,
       MAX(CASE WHEN t.completed_at IS NOT NULL
         THEN TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at) END)      AS slowest_minutes,
       COUNT(CASE WHEN t.completed_at IS NOT NULL
         AND TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at)
           <= ${DEFAULT_NORMAL_MIN} THEN 1 END)                                  AS on_time
     FROM drivers d
     JOIN transfers t ON t.driver_id = d.driver_id
     WHERE 1=1 ${dc} ${icdvClause}
     GROUP BY d.driver_id, d.full_name, d.license_number
     HAVING COUNT(t.transfer_id) > 0
     ORDER BY ROUND(AVG(CASE WHEN t.completed_at IS NOT NULL
       THEN TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at) END), 1) ASC`,
    params
  );

  return rows.map(r => {
    const completed = Number(r.completed) || 0;
    return {
      driver_id:       r.driver_id,
      driver_name:     r.driver_name,
      license_number:  r.license_number,
      total_transfers: Number(r.total_transfers),
      completed,
      avg_minutes:     r.avg_minutes     !== null ? Number(r.avg_minutes)     : null,
      fastest_minutes: r.fastest_minutes !== null ? Number(r.fastest_minutes) : null,
      slowest_minutes: r.slowest_minutes !== null ? Number(r.slowest_minutes) : null,
      on_time:         Number(r.on_time),
      on_time_pct:     completed ? parseFloat(((Number(r.on_time) / completed) * 100).toFixed(1)) : 0,
    };
  });
};

const getSlowestTransfers = async ({ page, limit, date_from, date_to, icdv_id } = {}) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  const params = [];
  let where = 't.completed_at IS NOT NULL';
  where += dateClause('t.transferred_at', date_from, date_to, params);
  if (icdv_id) { where += ' AND t.icdv_id = ?'; params.push(icdv_id); }
  where += ` AND TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at)
             > COALESCE(ttc.max_minutes, ${DEFAULT_MAX_MIN})`;

  const joins = `FROM transfers t
     JOIN vehicles v  ON v.vehicle_id  = t.vehicle_id
     JOIN drivers d   ON d.driver_id   = t.driver_id
     JOIN icdvs i     ON i.icdv_id     = t.icdv_id
     LEFT JOIN transit_time_configs ttc ON ttc.icdv_id = t.icdv_id`;

  const [{ total }] = await query(`SELECT COUNT(*) AS total ${joins} WHERE ${where}`, params);

  const rows = await query(
    `SELECT
       t.transfer_id, v.chassis_number, v.brand, v.model,
       d.full_name AS driver_name, i.name AS icdv_name,
       t.transferred_at, t.completed_at,
       TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at)            AS minutes_taken,
       COALESCE(ttc.max_minutes, ${DEFAULT_MAX_MIN})                       AS max_threshold,
       TIMESTAMPDIFF(MINUTE, t.transferred_at, t.completed_at)
         - COALESCE(ttc.max_minutes, ${DEFAULT_MAX_MIN})                   AS minutes_over
     ${joins} WHERE ${where}
     ORDER BY minutes_taken DESC
     LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );

  return paginate(rows.map(r => ({
    ...r,
    minutes_taken: Number(r.minutes_taken),
    max_threshold: Number(r.max_threshold),
    minutes_over:  Number(r.minutes_over),
  })), total);
};

// ================================================================================
// PAYMENT / RECEIVABLES
// ================================================================================

const getPaymentSummary = async ({ date_from, date_to } = {}) => {
  const params = [];
  let dc = '';
  if (date_from) { dc += ' AND DATE(inv.issued_date) >= ?'; params.push(date_from); }
  if (date_to)   { dc += ' AND DATE(inv.issued_date) <= ?'; params.push(date_to); }

  const [row] = await query(
    `SELECT
       COUNT(*) AS total_invoices,
       COUNT(CASE WHEN inv.status != 'cancelled' THEN 1 END) AS active_invoices,
       COUNT(CASE WHEN inv.status = 'paid' THEN 1 END) AS paid_count,
       COUNT(CASE WHEN inv.status IN ('invoiced','approved') THEN 1 END) AS outstanding_count,
       COUNT(CASE WHEN inv.status IN ('invoiced','approved')
         AND inv.due_date IS NOT NULL AND inv.due_date < CURDATE() THEN 1 END) AS overdue_count,
       COALESCE(SUM(CASE WHEN inv.status != 'cancelled' THEN inv.total_amount END), 0) AS total_billed,
       COALESCE(SUM(CASE WHEN inv.status = 'paid' THEN inv.total_amount END), 0) AS total_collected,
       COALESCE(SUM(CASE WHEN inv.status IN ('invoiced','approved') THEN inv.total_amount END), 0) AS total_outstanding,
       COALESCE(SUM(CASE WHEN inv.status IN ('invoiced','approved')
         AND inv.due_date IS NOT NULL AND inv.due_date < CURDATE() THEN inv.total_amount END), 0) AS total_overdue,
       ROUND(AVG(CASE WHEN inv.approved_at IS NOT NULL
         THEN DATEDIFF(inv.approved_at, inv.issued_date) END), 1) AS avg_days_to_approval,
       ROUND(AVG(CASE WHEN inv.paid_at IS NOT NULL
         THEN DATEDIFF(inv.paid_at, inv.issued_date) END), 1) AS avg_days_to_payment
     FROM invoices inv WHERE 1=1 ${dc}`,
    params
  );

  const billed    = Number(row.total_billed);
  const collected = Number(row.total_collected);
  return {
    total_invoices:       Number(row.total_invoices),
    active_invoices:      Number(row.active_invoices),
    paid_count:           Number(row.paid_count),
    outstanding_count:    Number(row.outstanding_count),
    overdue_count:        Number(row.overdue_count),
    total_billed:         billed,
    total_collected:      collected,
    total_outstanding:    Number(row.total_outstanding),
    total_overdue:        Number(row.total_overdue),
    collection_rate_pct:  billed ? parseFloat(((collected / billed) * 100).toFixed(1)) : 0,
    avg_days_to_approval: row.avg_days_to_approval !== null ? Number(row.avg_days_to_approval) : null,
    avg_days_to_payment:  row.avg_days_to_payment  !== null ? Number(row.avg_days_to_payment)  : null,
  };
};

const getPaymentByIcdv = async ({ date_from, date_to } = {}) => {
  const params = [];
  let dc = '';
  if (date_from) { dc += ' AND DATE(inv.issued_date) >= ?'; params.push(date_from); }
  if (date_to)   { dc += ' AND DATE(inv.issued_date) <= ?'; params.push(date_to); }

  const rows = await query(
    `SELECT
       i.icdv_id, i.name AS icdv_name,
       COUNT(CASE WHEN inv.status != 'cancelled' THEN 1 END)                  AS active_invoices,
       COUNT(CASE WHEN inv.status = 'paid' THEN 1 END)                        AS paid_count,
       COUNT(CASE WHEN inv.status IN ('invoiced','approved') THEN 1 END)      AS outstanding_count,
       COUNT(CASE WHEN inv.status IN ('invoiced','approved')
         AND inv.due_date IS NOT NULL AND inv.due_date < CURDATE() THEN 1 END) AS overdue_count,
       COALESCE(SUM(CASE WHEN inv.status != 'cancelled' THEN inv.total_amount END), 0) AS total_billed,
       COALESCE(SUM(CASE WHEN inv.status = 'paid' THEN inv.total_amount END), 0)       AS total_collected,
       COALESCE(SUM(CASE WHEN inv.status IN ('invoiced','approved') THEN inv.total_amount END), 0) AS total_outstanding,
       ROUND(AVG(CASE WHEN inv.paid_at IS NOT NULL
         THEN DATEDIFF(inv.paid_at, inv.issued_date) END), 1) AS avg_days_to_payment
     FROM icdvs i
     JOIN invoices inv ON inv.icdv_id = i.icdv_id
     WHERE 1=1 ${dc}
     GROUP BY i.icdv_id, i.name
     HAVING active_invoices > 0
     ORDER BY total_outstanding DESC`,
    params
  );

  return rows.map(r => {
    const billed    = Number(r.total_billed);
    const collected = Number(r.total_collected);
    return {
      icdv_id: r.icdv_id, icdv_name: r.icdv_name,
      active_invoices:   Number(r.active_invoices),
      paid_count:        Number(r.paid_count),
      outstanding_count: Number(r.outstanding_count),
      overdue_count:     Number(r.overdue_count),
      total_billed:      billed,
      total_collected:   collected,
      total_outstanding: Number(r.total_outstanding),
      avg_days_to_payment: r.avg_days_to_payment !== null ? Number(r.avg_days_to_payment) : null,
      collection_rate_pct: billed ? parseFloat(((collected / billed) * 100).toFixed(1)) : 0,
    };
  });
};

const getOverdueInvoices = async ({ page, limit } = {}) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);

  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM invoices inv
     JOIN icdvs i ON i.icdv_id = inv.icdv_id
     WHERE inv.status IN ('invoiced','approved')
       AND inv.due_date IS NOT NULL AND inv.due_date < CURDATE()`
  );

  const rows = await query(
    `SELECT inv.invoice_id, inv.invoice_number, inv.issued_date, inv.due_date,
       inv.total_amount, inv.status,
       DATEDIFF(CURDATE(), inv.due_date) AS days_overdue,
       i.name AS icdv_name
     FROM invoices inv
     JOIN icdvs i ON i.icdv_id = inv.icdv_id
     WHERE inv.status IN ('invoiced','approved')
       AND inv.due_date IS NOT NULL AND inv.due_date < CURDATE()
     ORDER BY days_overdue DESC
     LIMIT ? OFFSET ?`,
    [l, offset]
  );

  return paginate(rows.map(r => ({ ...r, days_overdue: Number(r.days_overdue), total_amount: Number(r.total_amount) })), total);
};

// ================================================================================
// FLEET PIPELINE
// ================================================================================

const getFleetPipelineSummary = async () => {
  const [row] = await query(
    `SELECT
       COUNT(*) AS total,
       SUM(workflow_status = 'manifested')  AS cnt_manifested,
       SUM(workflow_status = 'discharged')  AS cnt_discharged,
       SUM(workflow_status = 'batched')     AS cnt_batched,
       SUM(workflow_status = 'in_transit')  AS cnt_in_transit,
       SUM(workflow_status = 'received')    AS cnt_received
     FROM vehicles`
  );

  // Stale: vehicles that have been in the same non-terminal step > 3 days
  // We use vehicles.updated_at as a proxy (last time the workflow status changed)
  const staleRows = await query(
    `SELECT workflow_status, COUNT(*) AS cnt
     FROM vehicles
     WHERE workflow_status IN ('discharged','batched')
       AND DATEDIFF(NOW(), updated_at) > 3
     GROUP BY workflow_status`
  );
  const stale = {};
  staleRows.forEach(r => { stale[r.workflow_status] = Number(r.cnt); });

  return {
    total:           Number(row.total),
    manifested:      Number(row.cnt_manifested),
    discharged:      Number(row.cnt_discharged),
    batched:         Number(row.cnt_batched),
    in_transit:      Number(row.cnt_in_transit),
    received:        Number(row.cnt_received),
    stale_discharged: stale.discharged  || 0,
    stale_batched:    stale.batched     || 0,
  };
};

const getFleetPipelineByIcdv = async () => {
  const rows = await query(
    `SELECT
       i.icdv_id, i.name AS icdv_name,
       COUNT(v.vehicle_id) AS total,
       SUM(v.workflow_status = 'manifested')  AS cnt_manifested,
       SUM(v.workflow_status = 'discharged')  AS cnt_discharged,
       SUM(v.workflow_status = 'batched')     AS cnt_batched,
       SUM(v.workflow_status = 'in_transit')  AS cnt_in_transit,
       SUM(v.workflow_status = 'received')    AS cnt_received
     FROM icdvs i
     JOIN vehicles v ON v.icdv_id = i.icdv_id
     WHERE i.is_active = 1
     GROUP BY i.icdv_id, i.name
     HAVING total > 0
     ORDER BY total DESC`
  );

  return rows.map(r => ({
    icdv_id:    r.icdv_id,    icdv_name:  r.icdv_name,
    total:      Number(r.total),
    manifested: Number(r.cnt_manifested),
    discharged: Number(r.cnt_discharged),
    batched:    Number(r.cnt_batched),
    in_transit: Number(r.cnt_in_transit),
    received:   Number(r.cnt_received),
  }));
};

const getStaleVehicles = async ({ page, limit, days = 3 } = {}) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  const d = Number(days) || 3;

  const [{ total }] = await query(
    `SELECT COUNT(*) AS total FROM vehicles v
     JOIN manifests m ON m.manifest_id = v.manifest_id
     JOIN icdvs i ON i.icdv_id = v.icdv_id
     WHERE v.workflow_status IN ('discharged','batched')
       AND DATEDIFF(NOW(), v.updated_at) > ?`,
    [d]
  );

  const rows = await query(
    `SELECT v.vehicle_id, v.chassis_number, v.brand, v.model, v.color,
       v.workflow_status, DATEDIFF(NOW(), v.updated_at) AS days_stale,
       m.manifest_number, i.name AS icdv_name
     FROM vehicles v
     JOIN manifests m ON m.manifest_id = v.manifest_id
     JOIN icdvs i ON i.icdv_id = v.icdv_id
     WHERE v.workflow_status IN ('discharged','batched')
       AND DATEDIFF(NOW(), v.updated_at) > ?
     ORDER BY days_stale DESC
     LIMIT ? OFFSET ?`,
    [d, l, offset]
  );

  return paginate(rows.map(r => ({ ...r, days_stale: Number(r.days_stale) })), total);
};

// ================================================================================
// VESSEL PRODUCTIVITY
// ================================================================================

const getVesselProductivitySummary = async () => {
  const [row] = await query(
    `SELECT
       COUNT(*) AS total_vessels,
       SUM(status = 'expected')   AS cnt_expected,
       SUM(status = 'arrived')    AS cnt_arrived,
       SUM(status = 'processing') AS cnt_processing,
       SUM(status = 'completed')  AS cnt_completed,
       SUM(status = 'departed')   AS cnt_departed
     FROM vessels v`
  );

  const [vrow] = await query(
    `SELECT
       COUNT(DISTINCT v.vessel_id) AS vessels_with_vehicles,
       COUNT(vh.vehicle_id)        AS total_vehicles,
       ROUND(COUNT(vh.vehicle_id) / NULLIF(COUNT(DISTINCT v.vessel_id), 0), 1) AS avg_vehicles_per_vessel
     FROM vessels v
     JOIN manifests m  ON m.vessel_id   = v.vessel_id
     JOIN vehicles  vh ON vh.manifest_id = m.manifest_id`
  );

  return {
    total_vessels:         Number(row.total_vessels),
    expected:              Number(row.cnt_expected),
    arrived:               Number(row.cnt_arrived),
    processing:            Number(row.cnt_processing),
    completed:             Number(row.cnt_completed),
    departed:              Number(row.cnt_departed),
    active_now:            Number(row.cnt_arrived) + Number(row.cnt_processing),
    total_vehicles:        Number(vrow.total_vehicles),
    avg_vehicles_per_vessel: vrow.avg_vehicles_per_vessel !== null ? Number(vrow.avg_vehicles_per_vessel) : 0,
  };
};

const getVesselList = async ({ page, limit, status } = {}) => {
  const { limit: l, offset, paginate } = buildPagination(page, limit);
  const params = [];
  let where = '1=1';
  if (status) { where += ' AND v.status = ?'; params.push(status); }

  const [{ total }] = await query(`SELECT COUNT(*) AS total FROM vessels v WHERE ${where}`, params);

  const rows = await query(
    `SELECT v.*,
       COUNT(DISTINCT m.manifest_id)  AS manifest_count,
       COUNT(DISTINCT vh.vehicle_id)  AS vehicle_count,
       SUM(vh.workflow_status = 'received') AS received_count
     FROM vessels v
     LEFT JOIN manifests m  ON m.vessel_id  = v.vessel_id
     LEFT JOIN vehicles  vh ON vh.manifest_id = m.manifest_id
     WHERE ${where}
     GROUP BY v.vessel_id
     ORDER BY v.arrival_date DESC
     LIMIT ? OFFSET ?`,
    [...params, l, offset]
  );

  return paginate(rows.map(r => ({
    ...r,
    manifest_count: Number(r.manifest_count),
    vehicle_count:  Number(r.vehicle_count),
    received_count: Number(r.received_count),
    completion_pct: r.vehicle_count > 0
      ? parseFloat(((r.received_count / r.vehicle_count) * 100).toFixed(1)) : 0,
  })), total);
};

const getMonthlyVesselTrend = async ({ months = 6 } = {}) => {
  const m = Math.min(Math.max(parseInt(months, 10) || 6, 1), 24);

  const rows = await query(
    `SELECT DATE_FORMAT(v.arrival_date, '%Y-%m') AS month,
       COUNT(DISTINCT v.vessel_id)    AS vessels,
       COUNT(DISTINCT m.manifest_id)  AS manifests,
       COUNT(DISTINCT vh.vehicle_id)  AS vehicles
     FROM vessels v
     LEFT JOIN manifests m  ON m.vessel_id  = v.vessel_id
     LEFT JOIN vehicles  vh ON vh.manifest_id = m.manifest_id
     WHERE v.arrival_date >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
     GROUP BY month ORDER BY month`,
    [m]
  );

  const map = {};
  rows.forEach(r => { map[r.month] = { vessels: Number(r.vessels), manifests: Number(r.manifests), vehicles: Number(r.vehicles) }; });

  const out = [];
  const now = new Date();
  for (let i = m - 1; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push({ month: key, ...(map[key] || { vessels: 0, manifests: 0, vehicles: 0 }) });
  }
  return out;
};

module.exports = {
  // Profit & Loss
  getProfitSummary, getProfitByIcdv, getProfitTrend, getRevenueByStatusTrend, getProfitByManifest,
  // Transfer Turnaround
  getTurnaroundSummary, getTurnaroundTrend, getTurnaroundByIcdv, getTurnaroundByDriver, getSlowestTransfers,
  // Payment / Receivables
  getPaymentSummary, getPaymentByIcdv, getOverdueInvoices,
  // Fleet Pipeline
  getFleetPipelineSummary, getFleetPipelineByIcdv, getStaleVehicles,
  // Vessel Productivity
  getVesselProductivitySummary, getVesselList, getMonthlyVesselTrend,
};
