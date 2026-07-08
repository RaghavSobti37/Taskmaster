/** Abort slow HTTP requests before they wedge the event loop. */
function requestTimeoutMiddleware(timeoutMs = 10_000) {
  return (req, res, next) => {
    res.setTimeout(timeoutMs, () => {
      if (!res.headersSent) {
        res.status(503).json({ ok: false, error: 'Request timeout' });
      }
    });
    req.setTimeout(timeoutMs);
    next();
  };
}

module.exports = { requestTimeoutMiddleware };
