const SecurityAudit = require('../models/SecurityAudit');
const logger = require('../utils/logger');
const { summarizeBody, inferAction, inferResourceType } = require('../utils/securityAuditRedact');

async function writeSecurityAudit(entry) {
  try {
    await SecurityAudit.create(entry);
  } catch (error) {
    logger.error('securityAudit', 'write failed', { error: error.message, action: entry?.action });
  }
}

async function listSecurityAudits(query = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 50));
  const filter = {};

  if (query.actorId) filter.actorId = query.actorId;
  if (query.action) filter.action = query.action;
  if (query.resourceType) filter.resourceType = query.resourceType;
  if (query.resourceId) filter.resourceId = query.resourceId;
  if (query.from || query.to) {
    filter.timestamp = {};
    if (query.from) filter.timestamp.$gte = new Date(query.from);
    if (query.to) filter.timestamp.$lte = new Date(query.to);
  }

  const [logs, total] = await Promise.all([
    SecurityAudit.find(filter)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SecurityAudit.countDocuments(filter),
  ]);

  return { logs, total, page, pages: Math.ceil(total / limit) || 1 };
}

/**
 * Express middleware — logs sensitive mutations after response completes.
 * @param {{ resourceType?: string, action?: string }} options
 */
function auditSensitiveMutation(options = {}) {
  return (req, res, next) => {
    const started = Date.now();
    const path = req.originalUrl || req.path || '';
    const resourceType = options.resourceType || inferResourceType(path);
    const action = options.action || inferAction(req.method, path);

    res.on('finish', () => {
      if (res.statusCode >= 500) return;
      if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return;

      const actor = req.user;
      if (!actor) return;

      writeSecurityAudit({
        tenantId: actor.tenantId || req.tenantId || undefined,
        actorId: actor._id,
        actorEmail: actor.email || '',
        action,
        resourceType,
        resourceId: String(req.params?.id || req.params?.userId || ''),
        method: req.method,
        path,
        before: null,
        after: summarizeBody(req.body),
        ip: req.ip || req.headers['x-forwarded-for'] || '',
        userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
        traceId: req.traceId || '',
        timestamp: new Date(started),
      });
    });

    next();
  };
}

module.exports = {
  writeSecurityAudit,
  listSecurityAudits,
  auditSensitiveMutation,
};
