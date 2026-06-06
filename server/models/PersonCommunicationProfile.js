const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const EMAIL_STATUS_ENUM = ['Active', 'Unsubscribed', 'Invalid', 'Pending', 'Bounced'];

const PersonCommunicationProfileSchema = new mongoose.Schema({
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true, unique: true, index: true },
  emailStatus: { type: String, enum: EMAIL_STATUS_ENUM, default: 'Pending', index: true },
  unsubscribed: { type: Boolean, default: false, index: true },
  bounceCount: { type: Number, default: 0 },
  unsubscribeReason: { type: String },
}, { timestamps: true });

PersonCommunicationProfileSchema.plugin(tenantPlugin);

module.exports = mongoose.model('PersonCommunicationProfile', PersonCommunicationProfileSchema);
