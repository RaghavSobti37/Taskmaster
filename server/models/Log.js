const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true },
  details: { type: Object },
  targetId: { type: mongoose.Schema.Types.ObjectId }, // ID of project/task/etc
  targetType: { type: String }, // 'Project', 'Task', etc
  createdAt: { type: Date, default: Date.now, expires: '90d' } // Auto-purge after 90 days
});

logSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Log', logSchema);
