const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const fieldToggleSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    required: { type: Boolean, default: false },
  },
  { _id: false },
);

const websiteFormSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    publishableKey: { type: String, required: true, unique: true, index: true },
    keyPrefix: { type: String, trim: true },
    allowedOrigins: [{ type: String, trim: true }],
    fields: {
      name: { type: fieldToggleSchema, default: () => ({ enabled: true, required: true }) },
      email: { type: fieldToggleSchema, default: () => ({ enabled: true, required: false }) },
      phone: { type: fieldToggleSchema, default: () => ({ enabled: true, required: false }) },
      message: { type: fieldToggleSchema, default: () => ({ enabled: true, required: false }) },
      company: { type: fieldToggleSchema, default: () => ({ enabled: false, required: false }) },
    },
    defaults: {
      source: { type: String, default: 'Website Form' },
      leadStatus: { type: String, default: 'New' },
      crmType: { type: String, default: 'sales' },
    },
    honeypotField: { type: String, default: '_gotcha' },
    status: { type: String, enum: ['active', 'paused'], default: 'active', index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

websiteFormSchema.index({ tenantId: 1, slug: 1 }, { unique: true });

websiteFormSchema.plugin(tenantPlugin);

module.exports = mongoose.model('WebsiteForm', websiteFormSchema);
