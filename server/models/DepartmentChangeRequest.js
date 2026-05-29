const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const departmentChangeRequestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  currentDepartmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  requestedDepartmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reviewNote: { type: String, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

departmentChangeRequestSchema.plugin(tenantPlugin);

module.exports = mongoose.model('DepartmentChangeRequest', departmentChangeRequestSchema);
