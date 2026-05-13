const mongoose = require('mongoose');

const crmAuditSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userRole: { type: String },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  fieldChanged: { type: String, required: true },
  oldValue: { type: String },
  newValue: { type: String },
}, { timestamps: true });

module.exports = mongoose.model('CRMAudit', crmAuditSchema);
