const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const orgAccountSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  category: {
    type: String,
    enum: ['email', 'social', 'platform', 'other'],
    default: 'other',
  },
  platform: { type: String, trim: true, default: '' },
  identifier: { type: String, trim: true, default: '' },
  url: { type: String, trim: true, default: '' },
  loginEmail: { type: String, trim: true, default: '' },
  secret: { type: String, select: false, default: '' },
  projectIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
  managedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  notes: { type: String, trim: true, default: '' },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

orgAccountSchema.index({ category: 1, platform: 1 });
orgAccountSchema.index({ projectIds: 1 });

orgAccountSchema.plugin(tenantPlugin);

module.exports = mongoose.model('OrgAccount', orgAccountSchema);
