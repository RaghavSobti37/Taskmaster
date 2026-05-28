const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const workspaceSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, uppercase: true, trim: true },
  color: { type: String, default: '#64748b' },
  order: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

workspaceSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Workspace', workspaceSchema);
