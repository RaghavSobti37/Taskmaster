const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const financeDocumentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'approved',
  },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  rejectionReason: { type: String, default: '' },
  category: {
    type: String,
    enum: ['invoice', 'receipt', 'contract', 'proposal', 'budget', 'report', 'tax', 'other'],
    default: 'other'
  },
  fileUrl: { type: String, required: true },
  fileKey: { type: String }, // UploadThing file key for deletion
  fileName: { type: String },
  fileSize: { type: Number }, // bytes
  fileType: { type: String }, // MIME type e.g. 'application/pdf'
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  extractedText: { type: String, default: '' },
  metadata: {
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    vendor: { type: String, default: '' },
    date: { type: Date },
    tax: { type: Number, default: 0 },
    detectedCategory: { type: String, default: 'other' }
  },
}, { timestamps: true });

financeDocumentSchema.index({ project: 1, createdAt: -1 });
financeDocumentSchema.index({ category: 1 });
financeDocumentSchema.index({ uploadedBy: 1 });
financeDocumentSchema.index({ approvalStatus: 1 });
financeDocumentSchema.index({ submittedBy: 1 });

// Sanitize title
financeDocumentSchema.pre('save', function (next) {
  if (this.title) {
    this.title = this.title.replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
  }
  if (this.description) {
    this.description = this.description.replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
  }
  next();
});

financeDocumentSchema.plugin(tenantPlugin);

module.exports = mongoose.model('FinanceDocument', financeDocumentSchema);
