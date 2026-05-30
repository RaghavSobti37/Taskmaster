const Log = require('../models/Log');

// Fields that must NEVER be logged
const SENSITIVE_FIELDS = ['password', 'currentPassword', 'newPassword', 'token', 'secret', 'jwt'];

const sanitizeBody = (body) => {
  if (!body || typeof body !== 'object') return body;
  const safe = { ...body };
  for (const field of SENSITIVE_FIELDS) {
    if (safe[field]) safe[field] = '[REDACTED]';
  }
  return safe;
};

const systemLogger = async (req, res, next) => {
  const skipActivityLog = req.originalUrl.startsWith('/api/system-logs');
  const originalSend = res.send;

  res.send = function (data) {
    res.send = originalSend;

    if (
      !skipActivityLog
      && req.user
      && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE')
    ) {
      Log.create({
        userId: req.user._id,
        action: `${req.method} ${req.originalUrl}`,
        targetId: req.params.id || null,
        details: {
          body: sanitizeBody(req.body),
          statusCode: res.statusCode,
        },
      }).catch((err) => console.error('Logging error:', err));
    }

    return res.send(data);
  };

  next();
};

module.exports = systemLogger;
