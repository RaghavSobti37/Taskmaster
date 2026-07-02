const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const connectedAccountSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      enum: ['gsc', 'ga4', 'google_trends', 'meta', 'linkedin', 'medium', 'website'],
    },
    label: { type: String, trim: true },
    status: { type: String, default: 'disconnected', enum: ['connected', 'disconnected', 'error'] },
    accountId: { type: String, trim: true },
    accessToken: { type: String },
    refreshToken: { type: String },
    tokenExpiresAt: { type: Date },
    scopes: [{ type: String }],
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    lastSyncAt: { type: Date },
    lastError: { type: String },
  },
  { timestamps: true },
);

connectedAccountSchema.index({ provider: 1 });
connectedAccountSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ConnectedAccount', connectedAccountSchema);
