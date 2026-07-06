const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const tenantIntegrationSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true, index: true },
    category: {
      type: String,
      required: true,
      enum: ['email', 'marketing', 'crm', 'analytics', 'custom'],
    },
    label: { type: String, trim: true },
    status: {
      type: String,
      default: 'disconnected',
      enum: ['connected', 'disconnected', 'error', 'reauth_required'],
    },
    authType: {
      type: String,
      required: true,
      enum: ['oauth2', 'api_key', 'webhook_secret', 'smtp'],
    },
    credentialsEncrypted: { type: String, select: false },
    scopes: [{ type: String }],
    externalAccountId: { type: String, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    capabilities: [{ type: String }],
    lastSyncAt: { type: Date },
    lastError: { type: String },
    tokenExpiresAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

tenantIntegrationSchema.index(
  { tenantId: 1, provider: 1, externalAccountId: 1 },
  { unique: true, sparse: true },
);
tenantIntegrationSchema.index({ tenantId: 1, category: 1 });

tenantIntegrationSchema.plugin(tenantPlugin);

module.exports = mongoose.model('TenantIntegration', tenantIntegrationSchema);
