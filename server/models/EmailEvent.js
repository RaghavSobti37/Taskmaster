const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');


const emailEventSchema = new mongoose.Schema({
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', index: true },
  leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  type: { type: String, enum: ['sent', 'opened', 'clicked', 'bounced'] },
  timestamp: { type: Date, default: Date.now }
});

emailEventSchema.plugin(tenantPlugin);

module.exports = mongoose.model('EmailEvent', emailEventSchema);
