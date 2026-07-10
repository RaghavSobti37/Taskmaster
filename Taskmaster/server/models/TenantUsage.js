const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const tenantUsageSchema = new mongoose.Schema({
  periodKey: { type: String, required: true },
  seatsUsed: { type: Number, default: 0 },
  emailSends: { type: Number, default: 0 },
  storageMb: { type: Number, default: 0 },
  apiCalls: { type: Number, default: 0 },
}, { timestamps: true });

tenantUsageSchema.index({ tenantId: 1, periodKey: 1 }, { unique: true });

tenantUsageSchema.plugin(tenantPlugin);

module.exports = mongoose.model('TenantUsage', tenantUsageSchema);
