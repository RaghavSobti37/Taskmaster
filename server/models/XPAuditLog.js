const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  action: { type: String, required: true },
  details: { type: mongoose.Schema.Types.Mixed },
  /** Set when admin recalc changes stored amount (config sync). */
  previousAmount: { type: Number },
  recalculatedAt: { type: Date },
  recalcReason: { type: String },
  createdAt: { type: Date, default: Date.now },
});

schema.index({ userId: 1, createdAt: -1 });
schema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('XPAuditLog', schema);
