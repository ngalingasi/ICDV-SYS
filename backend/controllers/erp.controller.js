const httpStatus   = require('http-status');
const catchAsync   = require('../utils/catchAsync');
const { query }    = require('../config/database');
const tokenModel   = require('../models/token.model');

const SAFE_USER_FIELDS = [
  'user_id', 'full_name', 'username', 'email',
  'mobile', 'gender', 'avatar', 'role',
  'icdv_id', 'icdv_name',
  'status', 'must_change_password',
];

const sanitizeUser = (user) =>
  SAFE_USER_FIELDS.reduce((obj, key) => {
    obj[key] = user[key] !== undefined ? user[key] : null;
    return obj;
  }, {});

const enrichUser = async (user) => {
  const icdvId = user.icdv_id ?? null;
  if (icdvId) {
    try {
      const rows = await query('SELECT name FROM icdvs WHERE icdv_id = ?', [icdvId]);
      user.icdv_name = rows.length ? rows[0].name : null;
    } catch {
      user.icdv_name = null;
    }
  } else {
    user.icdv_name = null;
  }
  return user;
};

// ── lookup-user ───────────────────────────────────────────────────────────────
const lookupUser = catchAsync(async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(httpStatus.BAD_REQUEST).json({
      status:  false,
      message: 'email is required',
    });
  }

  const rows = await query(
    `SELECT * FROM users WHERE email = ? AND status = 'active' LIMIT 1`,
    [email]
  );

  if (!rows.length) {
    return res.status(httpStatus.NOT_FOUND).json({
      status:  false,
      message: 'User not found in this system',
    });
  }

  const user = rows[0];
  await enrichUser(user);
  const tokens = await tokenModel.generateAuthTokens(user);

  res.status(httpStatus.OK).json({
    status:  true,
    message: 'User found',
    user:    sanitizeUser(user),
    tokens,
  });
});

// ── health ────────────────────────────────────────────────────────────────────
const health = catchAsync(async (req, res) => {
  // DB ping
  let dbStatus = 'ok';
  let dbLatencyMs = null;
  try {
    const t0 = Date.now();
    await query('SELECT 1');
    dbLatencyMs = Date.now() - t0;
  } catch {
    dbStatus = 'error';
  }

  // User + ICDV stats
  let users = { total: 0, active: 0 };
  let icdvs = { total: 0 };
  let recentErrors = 0;
  try {
    const rows = await query(
      `SELECT COUNT(*) AS total, SUM(status='active') AS active FROM users`
    );
    users = { total: Number(rows[0].total ?? 0), active: Number(rows[0].active ?? 0) };
  } catch { /* skip */ }

  try {
    const rows = await query(`SELECT COUNT(*) AS total FROM icdvs`);
    icdvs = { total: Number(rows[0].total ?? 0) };
  } catch { /* skip */ }

  // Errors from integration_logs last 24h (if table exists)
  try {
    const rows = await query(
      `SELECT COUNT(*) AS cnt FROM integration_logs
       WHERE status = 'error' AND created_at >= NOW() - INTERVAL 24 HOUR`
    );
    recentErrors = Number(rows[0].cnt ?? 0);
  } catch { /* table may not exist */ }

  const uptimeSeconds = Math.floor(process.uptime());

  res.status(httpStatus.OK).json({
    status:         true,
    system:         'ICDV Management (Bandari)',
    environment:    process.env.NODE_ENV ?? 'unknown',
    uptime_seconds: uptimeSeconds,
    uptime_human:   formatUptime(uptimeSeconds),
    db: {
      status:     dbStatus,
      latency_ms: dbLatencyMs,
    },
    users,
    icdvs,
    errors_last_24h: recentErrors,
    memory_mb:   Math.round(process.memoryUsage().rss / 1024 / 1024),
    node_version: process.version,
    timestamp:   new Date().toISOString(),
  });
});

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

// (single module.exports at end of file — see below)


// ── integration-logs ──────────────────────────────────────────────────────────
const getLogs = catchAsync(async (req, res) => {
  const {
    integration, status, fromDate, toDate,
    search, page = 1, limit = 50,
  } = req.query;

  const conditions = [];
  const params     = [];

  if (integration) { conditions.push('integration = ?');       params.push(integration); }
  if (status)      { conditions.push('status = ?');            params.push(status); }
  if (fromDate)    { conditions.push('DATE(created_at) >= ?'); params.push(fromDate); }
  if (toDate)      { conditions.push('DATE(created_at) <= ?'); params.push(toDate); }
  if (search) {
    conditions.push('(correlation_id LIKE ? OR url LIKE ? OR context LIKE ?)');
    const q = `%${search}%`;
    params.push(q, q, q);
  }

  const where  = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const lim    = Math.min(Number(limit), 200);
  const offset = (Number(page) - 1) * lim;

  let total = 0;
  let rows  = [];
  try {
    const countRows = await query(`SELECT COUNT(*) AS total FROM integration_logs ${where}`, params);
    total = countRows[0].total;
    rows  = await query(
      `SELECT id, correlation_id, integration, method, url,
              response_status, error_message, duration_ms,
              triggered_by, context, status, created_at
       FROM integration_logs ${where}
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, lim, offset]
    );
  } catch { /* table may not exist yet */ }

  res.status(httpStatus.OK).json({
    status: true, message: 'Fetched successfully',
    total, page: Number(page), limit: lim, data: rows,
  });
});



// ── me ────────────────────────────────────────────────────────────────────────
const getMe = catchAsync(async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ status: false, message: 'email is required' });

  const rows = await query(
    `SELECT u.user_id, u.full_name, u.username, u.email, u.mobile, u.gender,
            u.avatar, u.role, u.icdv_id, u.status, u.must_change_password,
            i.name AS icdv_name
     FROM users u
     LEFT JOIN icdvs i ON i.icdv_id = u.icdv_id
     WHERE u.email = ? AND u.status = 'active' LIMIT 1`,
    [email]
  );

  if (!rows.length) return res.status(404).json({ status: false, message: 'User not found' });

  const u = rows[0];
  res.status(200).json({
    status: true,
    user: {
      user_id:              u.user_id,
      full_name:            u.full_name,
      username:             u.username             ?? null,
      email:                u.email,
      mobile:               u.mobile               ?? null,
      gender:               u.gender               ?? null,
      avatar:               u.avatar               ?? null,
      role:                 u.role,
      icdv_id:              u.icdv_id              ?? null,
      icdv_name:            u.icdv_name            ?? null,
      status:               'active',
      must_change_password: u.must_change_password ?? 0,
    },
  });
});

module.exports = { lookupUser, health, getLogs, getMe };
