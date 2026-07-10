const AuditEvent = require('../models/AuditEvent');

const recordAuditEvent = async ({
  tenantId,
  actorId,
  actorEmail,
  action,
  resourceType,
  resourceId,
  before,
  after,
  req,
  onBehalfOf,
  impersonationReason,
  metadata,
}) => {
  if (!tenantId || !action) return null;
  return AuditEvent.create({
    tenantId,
    actorId: actorId || null,
    actorEmail: actorEmail || '',
    action,
    resourceType: resourceType || '',
    resourceId: resourceId ? String(resourceId) : '',
    before: before ?? undefined,
    after: after ?? undefined,
    ip: req?.ip || req?.headers?.['x-forwarded-for'] || '',
    userAgent: req?.headers?.['user-agent'] || '',
    onBehalfOf: onBehalfOf || null,
    impersonationReason: impersonationReason || '',
    metadata: metadata || undefined,
    timestamp: new Date(),
  });
};

const listAuditEvents = async (tenantId, { limit = 100, cursor, action } = {}) => {
  const filter = { tenantId };
  if (action) filter.action = action;
  if (cursor) filter.timestamp = { $lt: new Date(cursor) };
  const rows = await AuditEvent.find(filter)
    .sort({ timestamp: -1 })
    .limit(Math.min(limit, 500))
    .lean();
  return rows;
};

module.exports = {
  recordAuditEvent,
  listAuditEvents,
};
