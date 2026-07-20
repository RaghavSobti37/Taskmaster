/** Paths that still build large CoreKnot-owned payloads. */
const LONG_TIMEOUT_RE = /^\/api\/(export|reports|analytics\/reports)/i;

/**
 * Abort slow HTTP requests before they wedge the event loop.
 * Marks req.timedOut so handlers skip a second res.json (ERR_HTTP_HEADERS_SENT).
 */
function requestTimeoutMiddleware(defaultTimeoutMs = 30_000, longTimeoutMs = 120_000) {
  const base = Number(defaultTimeoutMs) > 0 ? Number(defaultTimeoutMs) : 30_000;
  const long = Number(longTimeoutMs) > 0 ? Number(longTimeoutMs) : 120_000;

  return (req, res, next) => {
    const path = req.originalUrl || req.url || '';
    const timeoutMs = LONG_TIMEOUT_RE.test(path.split('?')[0]) ? long : base;

    req.timedOut = false;
    res.setTimeout(timeoutMs, () => {
      req.timedOut = true;
      if (!res.headersSent && !res.writableEnded) {
        res.status(503).json({ ok: false, error: 'Request timeout' });
      }
    });
    req.setTimeout(timeoutMs);
    next();
  };
}

module.exports = { requestTimeoutMiddleware, LONG_TIMEOUT_RE };
