const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const valuesSchema = new mongoose.Schema({
  sales: { type: Number, default: 0 },
  totalReach: { type: Number, default: 0 },
  warmLeads: { type: Number, default: 0 },
  audienceExposure: { type: Number, default: 0 },
}, { _id: false });

const schema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  weekKey: { type: String, required: true, index: true },
  values: valuesSchema,
  increments: valuesSchema,
  capturedAt: { type: Date, default: Date.now },
}, { timestamps: true });

schema.index({ projectId: 1, weekKey: 1 }, { unique: true });
schema.plugin(tenantPlugin);

module.exports = mongoose.model('ProjectGoalSnapshot', schema);
