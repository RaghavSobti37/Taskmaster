const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const auditEventSchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  actorEmail: { type: String },
  action: { type: String, required: true, index: true },
  resourceType: { type: String, index: true },
  resourceId: { type: String, index: true },
  before: { type: mongoose.Schema.Types.Mixed },
  after: { type: mongoose.Schema.Types.Mixed },
  ip: { type: String },
  userAgent: { type: String },
  onBehalfOf: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  impersonationReason: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

auditEventSchema.index({ tenantId: 1, timestamp: -1 });
auditEventSchema.index({ tenantId: 1, action: 1, timestamp: -1 });

auditEventSchema.plugin(tenantPlugin);

module.exports = mongoose.model('AuditEvent', auditEventSchema);
