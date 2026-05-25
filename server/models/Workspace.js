const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');


const WorkspaceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['owner', 'admin', 'viewer'], default: 'viewer' }
  }],
  settings: {
    publicShareToken: { type: String }, // Phase 4 public share token
    isPublicShared: { type: Boolean, default: false }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

WorkspaceSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Workspace', WorkspaceSchema);
