const mongoose = require('mongoose');

const crmAuditSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userRole: { type: String },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }, // Optional for system-wide actions
  action: { type: String }, // e.g., 'UPDATE', 'BATCH_DELETE', 'SYSTEM_RESET'
  fieldChanged: { type: String, required: true },
  oldValue: { type: String },
  newValue: { type: String },
  notes: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('CRMAudit', crmAuditSchema);
