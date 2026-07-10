const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  action: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed },
  /** Set when admin recalc changes stored amount (config sync). */
  previousAmount: { type: Number },
  recalculatedAt: { type: Date },
  recalcReason: { type: String },
  clawedBackAt: { type: Date },
  clawReason: { type: String },
  /** Stable key for entity-scoped awards — prevents duplicate inserts under concurrent upserts. */
  dedupeKey: { type: String },
  createdAt: { type: Date, default: Date.now },
});

schema.index({ tenantId: 1, userId: 1, createdAt: -1 });
schema.index({ tenantId: 1, action: 1, createdAt: -1 });
schema.index(
  { tenantId: 1, dedupeKey: 1 },
  { unique: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } },
);
schema.plugin(tenantPlugin);

module.exports = mongoose.model('XPAuditLog', schema);
