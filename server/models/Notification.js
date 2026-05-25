const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');


const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['reminder', 'system', 'alert'], default: 'reminder' },
  read: { type: Boolean, default: false },
  relatedLeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  createdAt: { type: Date, default: Date.now }
});

notificationSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Notification', notificationSchema);
