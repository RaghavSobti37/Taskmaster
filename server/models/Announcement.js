const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const announcementRecipientSchema = new mongoose.Schema({
  email: { type: String, required: true, trim: true, lowercase: true },
  name: { type: String, trim: true, default: '' },
  status: {
    type: String,
    enum: ['Pending', 'Sending', 'Sent', 'Opened', 'Failed'],
    default: 'Pending'
  },
  sentAt: { type: Date, default: null },
  openedAt: { type: Date, default: null },
  messageId: { type: String, trim: true, default: '' },
  error: { type: String, trim: true, default: '' }
}, { _id: true });

const announcementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  audienceType: {
    type: String,
    enum: ['all', 'selected', 'project'],
    default: 'all',
    index: true
  },
  recipients: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sendEmail: { type: Boolean, default: true },
  expiresAt: { type: Date, default: null },
  ctaText: { type: String, trim: true },
  ctaLink: { type: String, trim: true },
  emailDispatch: {
    status: {
      type: String,
      enum: ['idle', 'queued', 'sending', 'completed', 'failed'],
      default: 'idle'
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    total: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    recipients: { type: [announcementRecipientSchema], default: [] }
  }
}, { timestamps: true });

announcementSchema.index({ createdAt: -1 });
announcementSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Announcement', announcementSchema);
