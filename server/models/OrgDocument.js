const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const orgDocumentSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '', trim: true },
  category: { type: String, default: 'Other', trim: true },
  tags: { type: [String], default: [] },
  sourceType: { type: String, enum: ['file', 'link'], required: true },
  fileUrl: { type: String, default: '' },
  fileKey: { type: String },
  fileName: { type: String },
  fileSize: { type: Number },
  fileType: { type: String },
  externalUrl: { type: String, default: '' },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

orgDocumentSchema.index({ category: 1, createdAt: -1 });
orgDocumentSchema.index({ tags: 1 });
orgDocumentSchema.index({ sourceType: 1 });

orgDocumentSchema.pre('save', function () {
  if (this.title) {
    this.title = this.title.replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
  }
  if (this.description) {
    this.description = this.description.replace(/<[^>]*>/g, '').trim().replace(/\s+/g, ' ');
  }
  if (this.sourceType === 'file' && !this.fileUrl) {
    throw new Error('fileUrl is required for file documents');
  }
  if (this.sourceType === 'link' && !this.externalUrl) {
    throw new Error('externalUrl is required for link documents');
  }
});

orgDocumentSchema.plugin(tenantPlugin);

module.exports = mongoose.model('OrgDocument', orgDocumentSchema);
