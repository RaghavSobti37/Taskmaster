const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const taskTypeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', index: true },
  projectRole: { type: String, enum: ['admin', 'manager', 'member', 'owner', null], default: null },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

taskTypeSchema.index({ tenantId: 1, name: 1, departmentId: 1 });

taskTypeSchema.plugin(tenantPlugin);

module.exports = mongoose.model('TaskType', taskTypeSchema);
