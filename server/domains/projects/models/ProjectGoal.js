const mongoose = require('mongoose');
const tenantPlugin = require('../../../plugins/tenantPlugin');

const metricTargetSchema = new mongoose.Schema({
  target: { type: Number, default: 0 },
}, { _id: false });

const metricOverrideSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: false },
  value: { type: Number, default: 0 },
}, { _id: false });

const referenceLinkSchema = new mongoose.Schema({
  label: { type: String, required: true, trim: true },
  url: { type: String, required: true, trim: true },
}, { _id: true });

const schema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, unique: true, index: true },
  startDate: { type: Date },
  endDate: { type: Date },
  targets: {
    sales: metricTargetSchema,
    totalReach: metricTargetSchema,
    warmLeads: metricTargetSchema,
    audienceExposure: metricTargetSchema,
  },
  sourceLinks: {
    artistIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Artist' }],
    offeringIds: [{ type: String, trim: true }],
    offeringKeywords: [{ type: String, trim: true }],
    leadKeywords: [{ type: String, trim: true }],
    referenceUrls: [referenceLinkSchema],
  },
  metricOverrides: {
    sales: metricOverrideSchema,
    totalReach: metricOverrideSchema,
    warmLeads: metricOverrideSchema,
    audienceExposure: metricOverrideSchema,
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

schema.plugin(tenantPlugin);

module.exports = mongoose.model('ProjectGoal', schema);
