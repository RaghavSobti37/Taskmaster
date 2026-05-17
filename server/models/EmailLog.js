const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema({
  campaignId: { type: String, required: true, index: true },
  leadEmail: { type: String, required: true, index: true },
  pixelId: { type: String, unique: true, index: true, sparse: true },
  clickId: { type: String, unique: true, index: true, sparse: true },
  opened: { type: Boolean, default: false },
  clicked: { type: Boolean, default: false },
  bounced: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('EmailLog', emailLogSchema);
