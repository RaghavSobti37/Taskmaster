const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

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
  ctaLink: { type: String, trim: true }
}, { timestamps: true });

announcementSchema.index({ createdAt: -1 });
announcementSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Announcement', announcementSchema);
