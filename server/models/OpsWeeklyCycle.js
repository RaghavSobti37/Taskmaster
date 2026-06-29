const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const opsWeeklyCycleSchema = new mongoose.Schema(
  {
    weekKey: { type: String, required: true, index: true },
    domain: { type: String, required: true },
    submittedAt: { type: Date },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },
  },
  { timestamps: true },
);

opsWeeklyCycleSchema.index({ weekKey: 1, domain: 1 }, { unique: true });
opsWeeklyCycleSchema.plugin(tenantPlugin);

module.exports = mongoose.model('OpsWeeklyCycle', opsWeeklyCycleSchema);
