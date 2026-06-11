const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, lowercase: true, trim: true },
  color: { type: String, default: '#3b82f6' },
  sortOrder: { type: Number, default: 0 },
  signupAllowed: { type: Boolean, default: true },
  permissionPreset: {
    type: String,
    enum: ['admin', 'ops', 'operations', 'sales', 'artist-management', 'creative', 'standard'],
    default: 'standard',
  },
  pagePermissions: {
    type: [String],
    default: [],
  },
  createdAt: { type: Date, default: Date.now }
});

departmentSchema.index({ tenantId: 1, slug: 1 }, { unique: true });

departmentSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Department', departmentSchema);
