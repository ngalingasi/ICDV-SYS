/**
 * config/traceAndFound.js
 *
 * Thin wrapper around backend/lib/traceandfound-sdk.js.
 *
 * WHY THIS WRAPPER EXISTS (rather than calling the SDK directly everywhere):
 *
 *  1. Graceful no-op when not configured. Endpoint/apiKey/organizationId are
 *     optional env vars — local/dev/test environments without them just skip
 *     tracing instead of crashing (the SDK itself throws from initialize()
 *     if required config is missing).
 *
 *  2. Per-ICDV-tenant "client" tagging, race-free. ICDV is multi-tenant —
 *     one Node process serves many ICDV depots concurrently, unlike the
 *     SDK's docs, which describe `client` as a single global set once via
 *     setContext() (their one-client-per-deployment model, e.g. one hospital
 *     per process). Reading the SDK source directly (it's minified, no
 *     public docs for this) confirms `client` — like `module`/`user` — can
 *     also be passed per-call, as a plain field in the options object given
 *     to captureError/captureLog, or as the 3rd (options) argument to
 *     captureEvent: internally, ContextCollector.build(options) resolves
 *     `options.client ?? <global setContext value> ?? null`, i.e. a per-call
 *     value always wins over the global one. So every helper below passes
 *     `client` per-call and never touches global setContext() at all —
 *     there's no shared mutable state involved, so concurrent requests for
 *     different tenants can never cross-contaminate each other's events.
 *
 *  3. Never breaks the app. Every helper here swallows its own errors —
 *     on top of the SDK's own "never throws" guarantee — so a problem in
 *     this file can never surface as a 500 to a real user.
 */

'use strict';

const config = require('./config');
const logger = require('./logger');

let sdk = null;
let enabled = false;

/**
 * Called once at process startup (see index.js). Silently skips if
 * endpoint/apiKey/organizationId aren't all configured.
 */
function initTraceAndFound() {
  const { endpoint, apiKey, organizationId, application, terminal } = config.traceAndFound;
  if (!endpoint || !apiKey || !organizationId) {
    logger.info('TraceAndFound not configured (endpoint/apiKey/organizationId missing) — skipping.');
    return;
  }
  try {
    // eslint-disable-next-line global-require
    sdk = require('../lib/traceandfound-sdk.js');
    sdk.initialize({
      endpoint,
      apiKey,
      organizationId,
      application: application || 'icdv',
      environment: config.env,
      ...(terminal ? { terminal } : {}), // identifies this server instance/process, optional
    });
    enabled = true;
    logger.info('TraceAndFound initialized');
  } catch (err) {
    enabled = false;
    logger.error(
      'Failed to initialize TraceAndFound — is backend/lib/traceandfound-sdk.js present? ' + err.message
    );
  }
}

/** Called from index.js on SIGTERM/SIGINT so queued events flush before exit. */
async function shutdownTraceAndFound() {
  if (!enabled || !sdk) return;
  try {
    await sdk.shutdown();
  } catch {
    // never block process shutdown on a tracing failure
  }
}

// ── Per-tenant client-name cache ──────────────────────────────────────────────
// icdv_id -> name. Kept synchronous on read purely to avoid a DB round-trip on
// every single event (not for any correctness/race reason — see header above,
// `client` is passed per-call so there's no shared state to race on).
const tenantNameCache = new Map();
const pendingTenantLookups = new Set();

function getTenantClientName(icdvId) {
  if (!icdvId) return undefined;
  const cached = tenantNameCache.get(icdvId);
  if (cached) return cached;

  // Not cached yet — return a safe placeholder now, and warm the cache
  // in the background (fire-and-forget) so later events for this tenant
  // get the real name.
  if (!pendingTenantLookups.has(icdvId)) {
    pendingTenantLookups.add(icdvId);
    // eslint-disable-next-line global-require
    const icdvModel = require('../models/icdv.model');
    icdvModel.getIcdvById(icdvId)
      .then((icdv) => {
        if (icdv && icdv.name) tenantNameCache.set(icdvId, icdv.name);
      })
      .catch(() => { /* keep using the placeholder */ })
      .finally(() => pendingTenantLookups.delete(icdvId));
  }
  return `ICDV-${icdvId}`;
}

/**
 * Capture an error, tagged to the ICDV tenant it happened under.
 * @param {Error} err
 * @param {number|null} icdvId
 * @param {object} options - module/operation/request/response/errorCode/traceId/metadata
 */
function captureError(err, icdvId, options = {}) {
  if (!enabled || !sdk) return;
  try {
    sdk.captureError(err, {
      ...options,
      client: getTenantClientName(icdvId),
      metadata: { ...(options.metadata || {}), icdv_id: icdvId },
    });
  } catch {
    // tracing must never break the app
  }
}

/**
 * Capture a business event (e.g. "vehicle.discharged"), tagged to its ICDV tenant.
 * @param {string} name
 * @param {number|null} icdvId
 * @param {object} data - the event's payload
 */
function captureEvent(name, icdvId, data = {}) {
  if (!enabled || !sdk) return;
  try {
    sdk.captureEvent(name, { ...data, icdv_id: icdvId }, { client: getTenantClientName(icdvId) });
  } catch {
    // tracing must never break the app
  }
}

/**
 * Capture a plain log line, tagged to its ICDV tenant.
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {string} message
 * @param {number|null} icdvId
 */
function captureLog(level, message, icdvId, options = {}) {
  if (!enabled || !sdk) return;
  try {
    sdk.captureLog(level, message, {
      ...options,
      client: getTenantClientName(icdvId),
      metadata: { ...(options.metadata || {}), icdv_id: icdvId },
    });
  } catch {
    // tracing must never break the app
  }
}

module.exports = {
  initTraceAndFound,
  shutdownTraceAndFound,
  captureError,
  captureEvent,
  captureLog,
  isEnabled: () => enabled,
};
