const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  outletId: { type: String, required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['active', 'archived', 'completed'], default: 'active' },
  metadataLayout: { type: mongoose.Schema.Types.ObjectId, ref: 'Layout' },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

projectSchema.index({ outletId: 1, createdAt: -1 });

module.exports = mongoose.model('Project', projectSchema);
