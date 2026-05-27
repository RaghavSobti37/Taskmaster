const mongoose = require('mongoose');

const CRMStatSnapshotSchema = new mongoose.Schema({
  repId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true }, // Null = Admin/Global
  metrics: {
    totalLeads: { type: Number, default: 0 },
    connected: { type: Number, default: 0 },
    meaningful: { type: Number, default: 0 },
    converted: { type: Number, default: 0 },
    totalReps: { type: Number, default: 0 },
    conversionRate: { type: Number, default: 0 }
  },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CRMStatSnapshot', CRMStatSnapshotSchema);
