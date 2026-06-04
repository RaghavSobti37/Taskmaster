const mongoose = require('mongoose');

const mailTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  content: { type: String, required: true },
  format: { type: String, enum: ['rawHtml', 'visual'], default: 'visual' },
  subject: { type: String, default: '' },
  status: {
    type: String,
    enum: ['draft', 'pending_approval', 'approved', 'rejected'],
    default: 'draft',
  },
  dummyValues: {
    type: Map,
    of: String,
    default: () => new Map(),
  },
  approvedContent: { type: String },
  submittedAt: { type: Date },
  approvedAt: { type: Date },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rejectionNote: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('MailTemplate', mailTemplateSchema);
