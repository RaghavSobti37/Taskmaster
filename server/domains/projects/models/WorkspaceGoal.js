const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const metricTargetSchema = new mongoose.Schema({
  target: { type: Number, default: 0 },
}, { _id: false });

const schema = new mongoose.Schema({
  workspaceName: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  targets: {
    sales: metricTargetSchema,
    totalReach: metricTargetSchema,
    warmLeads: metricTargetSchema,
    audienceExposure: metricTargetSchema,
  },
  crmDigest: {
    monthlyTargetLakhs: { type: Number, default: 0 },
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

schema.plugin(tenantPlugin);

module.exports = mongoose.model('WorkspaceGoal', schema);
