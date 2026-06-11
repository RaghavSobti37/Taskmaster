const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const taskMentionReceiptSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true,
  },
  unreadCount: { type: Number, default: 0 },
  lastMentionAt: { type: Date },
}, { timestamps: true });

taskMentionReceiptSchema.index({ userId: 1, taskId: 1 }, { unique: true });
taskMentionReceiptSchema.index({ taskId: 1 });

taskMentionReceiptSchema.plugin(tenantPlugin);

module.exports = mongoose.model('TaskMentionReceipt', taskMentionReceiptSchema);
