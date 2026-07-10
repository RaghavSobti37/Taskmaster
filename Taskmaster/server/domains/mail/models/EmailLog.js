const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');


const emailLogSchema = new mongoose.Schema({
  campaignId: { type: String, required: true, index: true },
  leadEmail: { type: String, required: true, index: true },
  pixelId: { type: String, unique: true, index: true, sparse: true },
  clickId: { type: String, unique: true, index: true, sparse: true },
  opened: { type: Boolean, default: false },
  clicked: { type: Boolean, default: false },
  bounced: { type: Boolean, default: false }
}, { timestamps: true });

emailLogSchema.plugin(tenantPlugin);

module.exports = mongoose.model('EmailLog', emailLogSchema);
