const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const monthlyLeaderboardEntrySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    rank: { type: Number, required: true, min: 1 },
    monthlyXp: { type: Number, required: true, min: 0 },
    name: { type: String, default: '' },
    avatar: { type: String, default: '' },
  },
  { _id: false }
);

const monthlyLeaderboardSnapshotSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    monthStartKey: { type: String, required: true, index: true },
    monthEndKey: { type: String, required: true },
    entries: { type: [monthlyLeaderboardEntrySchema], default: [] },
    logCount: { type: Number, default: 0 },
    storedSum: { type: Number, default: 0 },
    resolvedSum: { type: Number, default: 0 },
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

monthlyLeaderboardSnapshotSchema.index({ tenantId: 1, monthStartKey: 1 }, { unique: true });
monthlyLeaderboardSnapshotSchema.plugin(tenantPlugin);

module.exports = mongoose.model('MonthlyLeaderboardSnapshot', monthlyLeaderboardSnapshotSchema);
