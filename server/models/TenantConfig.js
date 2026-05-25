const mongoose = require('mongoose');

const tenantConfigSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  features: {
    leads: { type: Boolean, default: true },
    tasks: { type: Boolean, default: true },
    campaigns: { type: Boolean, default: false },
    analytics: { type: Boolean, default: true }
  },
  theme: {
    primaryColor: { type: String, default: '#0B0F19' },
    logoUrl: { type: String }
  },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TenantConfig', tenantConfigSchema);
