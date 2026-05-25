const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const xpAuditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actionType: { type: String, required: true }, // e.g., 'COMPLETE_TASK', 'PROJECT_BONUS'
  amount: { type: Number, required: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
  timestamp: { type: Date, default: Date.now },
  description: { type: String } // Plain English reason
});

xpAuditLogSchema.index({ userId: 1, timestamp: -1 });

xpAuditLogSchema.plugin(tenantPlugin);

module.exports = mongoose.model('XPAuditLog', xpAuditLogSchema);
