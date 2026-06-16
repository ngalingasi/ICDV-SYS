/**
 * requestLogger.js
 *
 * Logs every API request/response into the `integration_logs` table —
 * the same table and shape used by the ERP integration endpoints
 * (GET /erp/integration-logs, GET /erp/health).
 *
 * Tagging convention for the `integration` column:
 *   - 'erp'                — requests under /api/erp/* (handled by erpSecret
 *                            middleware + erp.controller, tagged here too
 *                            for a consistent single source of truth)
 *   - 'internal_<module>'  — all other system traffic, tagged by the first
 *                            path segment after /api, e.g. /api/manifests/123
 *                            becomes 'internal_manifests'
 *
 * Design notes:
 *   - Logging is fire-and-forget: failures to write a log NEVER affect the
 *     actual API response. We catch and swallow DB errors here.
 *   - Sensitive headers (Authorization, cookie, x-erp-secret) are masked.
 *   - request/response payloads are size-capped before storage to avoid
 *     bloating the table with large file uploads/downloads.
 *   - Health check (/health) and static asset requests are skipped to
 *     avoid noise.
 */

const crypto = require('crypto');
const { query } = require('../config/database');

const MAX_PAYLOAD_CHARS = 5000; // truncate large bodies before storing
const SENSITIVE_HEADERS = ['authorization', 'cookie', 'x-erp-secret', 'set-cookie'];

// Paths we never log — health checks, static files, docs
const SKIP_PREFIXES = ['/health', '/uploads', '/api/docs'];

function maskHeaders(headers = {}) {
  const masked = {};
  for (const [key, value] of Object.entries(headers)) {
    masked[key] = SENSITIVE_HEADERS.includes(key.toLowerCase())
      ? '***masked***'
      : value;
  }
  return masked;
}

function truncate(value) {
  if (value === undefined || value === null) return null;
  let str;
  try {
    str = typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
  if (str.length > MAX_PAYLOAD_CHARS) {
    return str.slice(0, MAX_PAYLOAD_CHARS) + `...[truncated, ${str.length} chars total]`;
  }
  return str;
}

/**
 * Derives the `integration` tag from the request path.
 *   /api/erp/...        -> 'erp'
 *   /api/manifests/...  -> 'internal_manifests'
 *   /api/workflow/...   -> 'internal_workflow'
 *   /api                -> 'internal_root'
 */
function deriveIntegrationTag(originalUrl) {
  // Strip query string
  const pathOnly = originalUrl.split('?')[0];
  // Expect paths like /api/<module>/...
  const match = pathOnly.match(/^\/api\/([^/]+)/);
  if (!match) return 'internal_root';
  const module = match[1];
  if (module === 'erp') return 'erp';
  return `internal_${module}`;
}

function shouldSkip(originalUrl) {
  return SKIP_PREFIXES.some(prefix => originalUrl.startsWith(prefix));
}

/**
 * Express middleware — attach early in app.js, before routes.
 * Captures request data immediately, hooks into res.end to capture
 * the response, then writes a single log row asynchronously.
 */
function requestLogger(req, res, next) {
  if (shouldSkip(req.originalUrl)) return next();

  const correlationId = crypto.randomUUID();
  const startTime = Date.now();
  const integration = deriveIntegrationTag(req.originalUrl);

  // Capture request payload at this point (body already parsed by express.json())
  const requestPayload = truncate(req.body);
  const requestHeaders = maskHeaders(req.headers);

  // Intercept the response body without altering behavior for the client.
  // We hook res.send/res.json (whichever is called) to capture the payload,
  // and res.end (always called) to know when the response is finished.
  let capturedResponseBody;
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = (body) => {
    capturedResponseBody = body;
    return originalJson(body);
  };
  res.send = (body) => {
    if (capturedResponseBody === undefined) capturedResponseBody = body;
    return originalSend(body);
  };

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const status = res.statusCode >= 500 ? 'error'
                  : res.statusCode >= 400 ? 'error'
                  : 'success';

    // triggered_by: prefer authenticated user id if available (set by passport jwt)
    const triggeredBy = req.user?.user_id ?? req.user?.id ?? null;

    const errorMessage = status === 'error'
      ? (capturedResponseBody && capturedResponseBody.message
          ? String(capturedResponseBody.message).slice(0, 1000)
          : `HTTP ${res.statusCode}`)
      : null;

    // Fire-and-forget insert — never throws into the request/response cycle.
    query(
      `INSERT INTO integration_logs
         (correlation_id, integration, direction, method, url,
          request_headers, request_payload, response_status,
          response_payload, error_message, duration_ms,
          triggered_by, context, status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        correlationId,
        integration,
        'outbound',
        req.method,
        req.originalUrl,
        JSON.stringify(requestHeaders),
        requestPayload,
        res.statusCode,
        truncate(capturedResponseBody),
        errorMessage,
        durationMs,
        triggeredBy,
        req.icdvId ? `icdv_id=${req.icdvId}` : null,
        status,
      ]
    ).catch(() => {
      // integration_logs table may not exist yet on every deployment —
      // never let logging failures affect the actual application.
    });
  });

  next();
}

module.exports = requestLogger;
