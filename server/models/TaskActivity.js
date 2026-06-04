const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const ACTIVITY_TYPES = ['created', 'assignment', 'message', 'status_change', 'field_change'];

const taskActivitySchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ACTIVITY_TYPES,
    required: true,
  },
  body: { type: String, default: '' },
  actorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedById: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  mentionedUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  statusFrom: { type: String },
  statusTo: { type: String },
  fieldKey: { type: String },
  valueFrom: { type: String },
  valueTo: { type: String },
}, { timestamps: true });

taskActivitySchema.index({ taskId: 1, createdAt: 1 });

taskActivitySchema.plugin(tenantPlugin);

module.exports = mongoose.model('TaskActivity', taskActivitySchema);
module.exports.ACTIVITY_TYPES = ACTIVITY_TYPES;
