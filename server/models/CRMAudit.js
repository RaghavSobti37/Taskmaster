const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

/**
 * Audit Log Schema
 */
const AuditSchema = new mongoose.Schema({
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', index: true },
  leadRowId: { type: String, index: true }, // Legacy link
  userId: { type: mongoose.Schema.Types.Mixed, ref: 'User', required: true, index: true }, // ID of user who made the change (e.g. sr01 or ObjectId)
  userRole: { type: String },
  fieldChanged: { type: String, required: true },
  oldValue: { type: String },
  newValue: { type: String },
  timestamp: { type: Date, default: Date.now, expires: '7d' },
});

AuditSchema.index({ leadId: 1, timestamp: -1 });

AuditSchema.plugin(tenantPlugin);

module.exports = mongoose.model('CRMAudit', AuditSchema);
