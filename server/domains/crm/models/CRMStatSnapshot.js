const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const CRMStatSnapshotSchema = new mongoose.Schema({
  repId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true }, // Null = Admin/Global within tenant
  metrics: {
    totalLeads: { type: Number, default: 0 },
    connected: { type: Number, default: 0 },
    activeReach: { type: Number, default: 0 },
    meaningful: { type: Number, default: 0 },
    warmLeads: { type: Number, default: 0 },
    convertedLeads: { type: Number, default: 0 },
    converted: { type: Number, default: 0 },
    totalReps: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 }
  },
  updatedAt: { type: Date, default: Date.now }
});

CRMStatSnapshotSchema.index({ tenantId: 1, repId: 1 }, { unique: true });
CRMStatSnapshotSchema.plugin(tenantPlugin);

module.exports = mongoose.model('CRMStatSnapshot', CRMStatSnapshotSchema);
