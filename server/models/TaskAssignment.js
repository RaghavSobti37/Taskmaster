const mongoose = require('mongoose');

const taskAssignmentSchema = new mongoose.Schema({
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedAt: { type: Date, default: Date.now },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

taskAssignmentSchema.index({ taskId: 1, userId: 1 }, { unique: true });
taskAssignmentSchema.index({ userId: 1, taskId: 1 });

module.exports = mongoose.model('TaskAssignment', taskAssignmentSchema);
