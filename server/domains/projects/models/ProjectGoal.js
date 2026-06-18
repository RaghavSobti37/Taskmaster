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
  crmDigest: {
    monthlyTargetLakhs: { type: Number, default: 0 },
    planValues: {
      'One-Time': { type: Number, default: 0 },
      '3 Mo': { type: Number, default: 0 },
      '6 Mo': { type: Number, default: 0 },
      '9 Mo': { type: Number, default: 0 },
    },
    crmType: { type: String, enum: ['sales', 'artist'], default: 'sales' },
  },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

schema.plugin(tenantPlugin);

module.exports = mongoose.model('ProjectGoal', schema);
