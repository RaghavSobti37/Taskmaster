const mongoose = require('mongoose');

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
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  phaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Phase' },
  parentTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', default: null },
  
  assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  
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
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

taskSchema.index({ projectId: 1, status: 1 });
taskSchema.index({ phaseId: 1, status: 1 });
taskSchema.index({ assignees: 1 });
taskSchema.index({ projectId: 1, dueDate: 1 });

module.exports = mongoose.model('Task', taskSchema);
