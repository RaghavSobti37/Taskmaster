const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const workspaceSchema = new mongoose.Schema({
  name: { type: String, required: true, uppercase: true, trim: true },
  color: { type: String, default: '#64748b' },
  order: { type: Number, default: 0 },
  defaultMembers: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'manager', 'member'], default: 'member' },
  }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

workspaceSchema.index({ tenantId: 1, name: 1 }, { unique: true });
workspaceSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Workspace', workspaceSchema);
