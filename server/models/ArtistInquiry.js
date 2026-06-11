const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const STATUSES = ['new', 'contacted', 'negotiating', 'blocked', 'confirmed', 'dead'];

const ArtistInquirySchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
  source: { type: String, default: 'manual' },
  clientName: { type: String, required: true },
  phone: { type: String },
  email: { type: String },
  eventName: { type: String },
  eventDate: { type: Date },
  expectedBudget: { type: Number, default: 0 },
  status: { type: String, enum: STATUSES, default: 'new', index: true },
  assignedManagerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedManagerName: { type: String },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'Task' },
  deadReason: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

ArtistInquirySchema.index({ artistId: 1, status: 1 });
ArtistInquirySchema.plugin(tenantPlugin);

module.exports = mongoose.model('ArtistInquiry', ArtistInquirySchema);
module.exports.INQUIRY_STATUSES = STATUSES;
