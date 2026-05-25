const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');


const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  mentions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' }, // If message created a task
  channel: { type: String, default: 'General Hub' },
  outletId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

messageSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Message', messageSchema);
