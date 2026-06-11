/**
 * Standard API response envelope for new and migrated routes.
 * Error shape keeps `error` at top level for existing client handlers.
 */

function apiSuccess(res, data, status = 200, meta) {
  const body = { ok: true, data };
  if (meta && Object.keys(meta).length) body.meta = meta;
  return res.status(status).json(body);
}

function apiError(res, message, status = 500, extra = {}) {
  return res.status(status).json({ ok: false, error: message, ...extra });
}

/** Flat success — for endpoints that already expose fields beside `ok` (e.g. /api/health). */
function apiOk(res, fields, status = 200) {
  return res.status(status).json({ ok: true, ...fields });
}

module.exports = { apiSuccess, apiError, apiOk };
