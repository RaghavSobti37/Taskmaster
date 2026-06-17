const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const financeDocumentSchema = new mongoose.Schema({
  title: { type: String, trim: true },
  description: { type: String, default: '', trim: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
  isFolder: { type: Boolean, default: false },
  folderName: { type: String, trim: true },
  folderId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinanceDocument', default: null },
  parentFolderId: { type: mongoose.Schema.Types.ObjectId, ref: 'FinanceDocument', default: null },
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
  referenceNumber: { type: String, trim: true, default: '' },
  fileUrl: { type: String, default: '' },
  fileKey: { type: String }, // UploadThing file key for deletion
  fileName: { type: String },
  fileSize: { type: Number }, // bytes
  fileType: { type: String }, // MIME type e.g. 'application/pdf'
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  extractedText: { type: String, default: '' },
  metadata: {
    amount: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
    vendor: { type: String, default: '' },
    date: { type: Date },
    tax: { type: Number, default: 0 },
    detectedCategory: { type: String, default: 'other' },
    submissionType: { type: String, enum: ['invoice', 'reimbursement'], default: 'invoice' },
    attachments: [{
      fileUrl: { type: String },
      fileKey: { type: String },
      fileName: { type: String },
      fileSize: { type: Number },
      fileType: { type: String },
    }],
  },
}, { timestamps: true });

financeDocumentSchema.index({ project: 1, createdAt: -1 });
financeDocumentSchema.index({ project: 1, isFolder: 1, folderId: 1 });
financeDocumentSchema.index({ folderId: 1 });
financeDocumentSchema.index({ isFolder: 1 });
financeDocumentSchema.index({ category: 1 });
financeDocumentSchema.index({ uploadedBy: 1 });
financeDocumentSchema.index({ approvalStatus: 1 });
financeDocumentSchema.index({ submittedBy: 1 });
financeDocumentSchema.index({ project: 1, referenceNumber: 1 });

// Sanitize title / folderName; validate folder vs document
financeDocumentSchema.pre('save', function (next) {
  if (this.isFolder) {
    if (!this.folderName) {
      return next(new Error('folderName is required for folders'));
    }
    this.title = this.folderName;
    this.folderName = this.folderName.replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
    this.title = this.folderName;
    if (!this.fileUrl) this.fileUrl = 'folder://placeholder';
    return next();
  }
  if (!this.title) {
    return next(new Error('title is required for documents'));
  }
  if (!this.fileUrl) {
    return next(new Error('fileUrl is required for documents'));
  }
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
