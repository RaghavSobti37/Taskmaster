const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');
const { auditLogPlugin } = require('../../../plugins/auditLogPlugin');


const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  status: { 
    type: String, 
    enum: ['todo', 'in-progress', 'in-review', 'done'], 
    default: 'todo',
    lowercase: true 
  },
  priority: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  type: { type: String, default: '' },
  scheduleSlot: { type: String, enum: ['AM', 'PM', 'FULL'], default: 'FULL' },
  scheduleDate: { type: Date },
  notifiedWarning: { type: Boolean, default: false },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  workspace: { type: String, default: 'General', index: true },
  phaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Phase' },
  parentTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  // assignees removed from physical schema, now a virtual
  
  startDate: { type: Date },
  dueDate: { type: Date },
  duration: { type: Number }, // In days
  
  plannedHours: { type: Number, default: 0 },
  actualHours: { type: Number, default: 0 },
  progress: { type: Number, default: 0, min: 0, max: 100 },
  completedAt: { type: Date },
  
  dependencies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  /** @mentioned users in project/workspace scope — view access only (not assignees). */
  mentionAccessIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  notifiedOverdue: { type: Boolean, default: false },
  color: { type: String }
}, { timestamps: true });

taskSchema.index({ createdBy: 1, status: 1 });
taskSchema.index({ mentionAccessIds: 1, status: 1 });
taskSchema.index({ projectId: 1, status: 1 });
taskSchema.index({ phaseId: 1, status: 1 });
taskSchema.index({ projectId: 1, dueDate: 1 });
taskSchema.index({ tenantId: 1, createdAt: -1 });
taskSchema.index({ tenantId: 1, status: 1, dueDate: 1 });
taskSchema.index({ tenantId: 1, projectId: 1, status: 1 });
taskSchema.index({ status: 1, dueDate: 1, notifiedWarning: 1 });
taskSchema.index({ status: 1, dueDate: 1, notifiedOverdue: 1 });
taskSchema.index({ title: 'text', description: 'text' });

taskSchema.virtual('assignees', {
  ref: 'TaskAssignment',
  localField: '_id',
  foreignField: 'taskId'
});

// Ensure virtuals are included in JSON and Object outputs
taskSchema.set('toObject', { virtuals: true });
taskSchema.set('toJSON', { virtuals: true });

taskSchema.plugin(tenantPlugin);
taskSchema.plugin(auditLogPlugin, { modelName: 'Task' });

module.exports = mongoose.model('Task', taskSchema);
