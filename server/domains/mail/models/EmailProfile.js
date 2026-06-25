const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const providerUsageSchema = new mongoose.Schema({
  today: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  lastResetDate: { type: String, default: '' },
}, { _id: false });

const emailProfileSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  smtpHost: { type: String, default: 'rotation' },
  smtpPort: { type: Number, default: 587 },
  smtpUser: { type: String, required: true },
  smtpPass: { type: String, required: true },
  signature: { type: String, default: '' },
  providerType: { type: String, default: 'rotation' },
  rotationEnabled: { type: Boolean, default: true },
  /** Explicit list of provider keys user has credentials for — empty = auto-detect from login email */
  rotationProviders: [{ type: String }],
  providerCredentials: {
    type: Map,
    of: {
      smtpUser: { type: String, default: '' },
      smtpPass: { type: String, default: '' },
      enabled: { type: Boolean, default: true },
    },
  },
  dailyLimit: { type: Number, default: 500 },
  sendStats: {
    today: { type: Number, default: 0 },
    lastResetDate: { type: String, default: '' },
    total: { type: Number, default: 0 },
  },
  providerUsage: {
    type: Map,
    of: providerUsageSchema,
    default: () => new Map(),
  },
  isDefault: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

emailProfileSchema.index({ createdBy: 1 });

emailProfileSchema.plugin(tenantPlugin);

module.exports = mongoose.model('EmailProfile', emailProfileSchema);
