const crypto = require('crypto');
const { tenantStorage, getContext } = require('../utils/tenantContext');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveTraceId(headerValue) {
  if (typeof headerValue === 'string' && UUID_RE.test(headerValue.trim())) {
    return headerValue.trim();
  }
  return crypto.randomUUID();
}

const traceMiddleware = (req, res, next) => {
  const incoming = req.headers['x-trace-id'] || req.headers['X-Trace-Id'];
  const traceId = resolveTraceId(incoming);
  req.traceId = traceId;
  res.setHeader('X-Trace-Id', traceId);

  const prior = getContext();
  const merged = {
    ...prior,
    traceId,
    tenantId: prior.tenantId ?? req.tenantId ?? null,
    userId: prior.userId ?? (req.user ? req.user._id?.toString() : null),
  };

  tenantStorage.run(merged, () => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (body && typeof body === 'object' && !Array.isArray(body) && body.traceId == null) {
        body.traceId = traceId;
      }
      return originalJson(body);
    };
    next();
  });
};

module.exports = traceMiddleware;
