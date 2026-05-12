const mongoose = require('mongoose');

const taskListSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Phase', required: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  position: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

taskListSchema.index({ phaseId: 1, position: 1 });

module.exports = mongoose.model('TaskList', taskListSchema);
