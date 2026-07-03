const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const securityAuditSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  actorEmail: { type: String, default: '', index: true },
  action: { type: String, required: true, index: true },
  resourceType: { type: String, required: true, index: true },
  resourceId: { type: String, default: '', index: true },
  method: { type: String, default: '' },
  path: { type: String, default: '' },
  before: { type: mongoose.Schema.Types.Mixed },
  after: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String, default: '' },
  userAgent: { type: String, default: '' },
  traceId: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now },
});

securityAuditSchema.index({ tenantId: 1, timestamp: -1 });
securityAuditSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });

// ponytail: 2yr retention — TTL index on timestamp
securityAuditSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 * 2 });

securityAuditSchema.plugin(tenantPlugin);

module.exports = mongoose.model('SecurityAudit', securityAuditSchema);
