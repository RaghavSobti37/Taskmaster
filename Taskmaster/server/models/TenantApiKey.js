const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const tenantApiKeySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  keyPrefix: { type: String, required: true, index: true },
  keyHash: { type: String, required: true, unique: true, select: false },
  scopes: [{ type: String }],
  lastUsedAt: { type: Date },
  revokedAt: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

tenantApiKeySchema.index({ tenantId: 1, revokedAt: 1 });

tenantApiKeySchema.plugin(tenantPlugin);

module.exports = mongoose.model('TenantApiKey', tenantApiKeySchema);
