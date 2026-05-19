const mongoose = require('mongoose');
require('./User');
require('./Lead');

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
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CRMAudit', AuditSchema);
