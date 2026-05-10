const httpStatus = require('http-status');
const { query, transaction } = require('../config/database');
const ApiError = require('../utils/ApiError');
const path = require('path');

// ── Helpers ───────────────────────────────────────────────────────────────────

const getActivityBudget = async (activityId) => {
  const rows = await query(
    `SELECT
       activity_id,
       COALESCE(revised_amount, budgeted_amount) AS effective_budget,
       total_paid
     FROM activities
     WHERE activity_id = ?`,
    [activityId]
  );
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Activity not found');
  return {
    effective_budget: Number(rows[0].effective_budget),
    total_paid:       Number(rows[0].total_paid),
    available:        Number(rows[0].effective_budget) - Number(rows[0].total_paid),
  };
};

const syncTotalPaid = async (activityId, conn = null) => {
  const exec = conn
    ? (sql, p) => conn.query(sql, p).then(([r]) => r)
    : query;
  await exec(
    `UPDATE activities
     SET total_paid = (
       SELECT COALESCE(SUM(amount), 0)
       FROM activity_payments
       WHERE activity_id = ? AND status = 'approved'
     )
     WHERE activity_id = ?`,
    [activityId, activityId]
  );
};

// ── CRUD ──────────────────────────────────────────────────────────────────────

const getPayments = async (activityId) => {
  return query(
    `SELECT p.*,
            u.full_name  AS created_by_name,
            a.full_name  AS approved_by_name
     FROM activity_payments p
     JOIN users u ON u.user_id = p.created_by
     LEFT JOIN users a ON a.user_id = p.approved_by
     WHERE p.activity_id = ?
     ORDER BY p.payment_date DESC, p.created_at DESC`,
    [activityId]
  );
};

const getPaymentById = async (paymentId) => {
  const rows = await query(
    `SELECT p.*, u.full_name AS created_by_name, a.full_name AS approved_by_name
     FROM activity_payments p
     JOIN users u ON u.user_id = p.created_by
     LEFT JOIN users a ON a.user_id = p.approved_by
     WHERE p.payment_id = ?`,
    [paymentId]
  );
  if (!rows.length) throw new ApiError(httpStatus.NOT_FOUND, 'Payment not found');
  return rows[0];
};

const createPayment = async (activityId, body, file, userId) => {
  const { effective_budget, total_paid } = await getActivityBudget(activityId);
  const amount = parseFloat(String(body.amount));

  if (!amount || amount <= 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Payment amount must be greater than 0');
  }

  const available = effective_budget - total_paid;
  if (amount > available) {
    const fmt = n => `TZS ${Number(n).toLocaleString()}`;
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      `Payment of ${fmt(amount)} exceeds available budget ${fmt(available)} ` +
      `(Budget: ${fmt(effective_budget)}, Already paid: ${fmt(total_paid)})`
    );
  }

  const evidencePath = file ? file.path  : null;
  const evidenceName = file ? file.originalname : null;

  const result = await query(
    `INSERT INTO activity_payments
       (activity_id, amount, payment_date, payment_method, reference_no,
        payee, description, status, evidence_path, evidence_name, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      activityId, amount, body.payment_date,
      body.payment_method || null, body.reference_no || null,
      body.payee || null, body.description || null,
      body.status || 'pending',
      evidencePath, evidenceName,
      userId,
    ]
  );

  // If approved on creation, sync total_paid
  if ((body.status || 'pending') === 'approved') {
    await syncTotalPaid(activityId);
  }

  return getPaymentById(result.insertId);
};

const updatePaymentStatus = async (paymentId, status, approverId) => {
  const payment = await getPaymentById(paymentId);
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid status');
  }

  // Check budget before approving
  if (status === 'approved') {
    const { effective_budget, total_paid } = await getActivityBudget(payment.activity_id);
    const available = effective_budget - total_paid;
    if (Number(payment.amount) > available) {
      const fmt = n => `TZS ${Number(n).toLocaleString()}`;
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Approving this payment would exceed the budget. ` +
        `Payment: ${fmt(payment.amount)}, Available: ${fmt(available)}`
      );
    }
  }

  await query(
    `UPDATE activity_payments
     SET status = ?, approved_by = ?, approved_at = ?
     WHERE payment_id = ?`,
    [status, status === 'approved' ? approverId : null,
     status === 'approved' ? new Date() : null, paymentId]
  );

  await syncTotalPaid(payment.activity_id);
  return getPaymentById(paymentId);
};

const deletePayment = async (paymentId, userId, userRole) => {
  const payment = await getPaymentById(paymentId);
  if (payment.status === 'approved') {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Cannot delete an approved payment');
  }
  if (userRole !== 'admin' && Number(payment.created_by) !== Number(userId)) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You can only delete your own payments');
  }
  await query('DELETE FROM activity_payments WHERE payment_id = ?', [paymentId]);
  await syncTotalPaid(payment.activity_id);
};

const getPaymentSummary = async (activityId) => {
  const budget = await getActivityBudget(activityId);
  const rows = await query(
    `SELECT
       COUNT(*)                                     AS total_count,
       COALESCE(SUM(amount),0)                      AS total_amount,
       COALESCE(SUM(CASE WHEN status='approved'  THEN amount ELSE 0 END),0) AS approved_amount,
       COALESCE(SUM(CASE WHEN status='pending'   THEN amount ELSE 0 END),0) AS pending_amount,
       COALESCE(SUM(CASE WHEN status='rejected'  THEN amount ELSE 0 END),0) AS rejected_amount,
       COUNT(CASE WHEN status='approved'  THEN 1 END) AS approved_count,
       COUNT(CASE WHEN status='pending'   THEN 1 END) AS pending_count,
       COUNT(CASE WHEN status='rejected'  THEN 1 END) AS rejected_count
     FROM activity_payments
     WHERE activity_id = ?`,
    [activityId]
  );
  const s = rows[0];
  return {
    ...s,
    effective_budget: budget.effective_budget,
    total_paid:       budget.total_paid,
    available:        budget.available,
    utilization_pct:  budget.effective_budget > 0
      ? Math.round((budget.total_paid / budget.effective_budget) * 100)
      : 0,
  };
};

module.exports = {
  getPayments, getPaymentById, createPayment,
  updatePaymentStatus, deletePayment, getPaymentSummary,
};
