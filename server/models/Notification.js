/** @deprecated Inbox is local-only (device storage). Runtime dispatch does not write here. */
const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');


const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['reminder', 'system', 'alert'], default: 'reminder' },
  category: { type: String, enum: ['task', 'crm', 'attendance', 'announcement', 'review', 'department', 'system'], default: 'system' },
  read: { type: Boolean, default: false },
  relatedLeadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  relatedTaskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
  relatedProjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  actionUrl: { type: String, default: '' },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  iconType: { type: String, enum: ['system', 'task', 'user'], default: 'system' },
  emailSent: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

notificationSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Notification', notificationSchema);
