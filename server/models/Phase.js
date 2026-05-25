const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');


const phaseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  dueDate: { type: Date },
  status: { type: String, enum: ['todo', 'in-progress', 'done'], default: 'todo' },
  isExternal: { type: Boolean, default: false }, // Access control flag
  progress: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

phaseSchema.index({ projectId: 1, dueDate: 1 });

phaseSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Phase', phaseSchema);
