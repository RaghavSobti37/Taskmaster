const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');
const { personFields, applyPersonPreSave } = require('./personFields');

const MasterclassReviewSchema = new mongoose.Schema({
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', index: true },
  ...personFields,
  campaign: { type: String, enum: ['review01', 'review02'], required: true, index: true },
  firstName: { type: String },
  lastName: { type: String },
  registeredMobile: { type: String },
  registeredEmail: { type: String, index: true },
  artistTypes: { type: String },
  completion: { type: String },
  pace: { type: String },
  clarity: { type: String },
  depth: { type: String },
  usefulness: { type: String },
  courseInterest: { type: String },
  weightedRating: { type: Number, default: 5 },
  oneLineExperience: { type: String },
  improvementSuggestion: { type: String },
  displayName: { type: String },
  title: { type: String, default: 'Masterclass Review' },
  content: { type: String },
  rating: { type: Number, default: 5 },
  ratingText: { type: String },
  isApproved: { type: Boolean, default: false, index: true },
  source: { type: String, default: 'tsc-website', index: true },
  sourceSite: { type: String },
  submittedAt: { type: Date, default: Date.now, index: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

MasterclassReviewSchema.index({ campaign: 1, isApproved: 1, submittedAt: -1 });
applyPersonPreSave(MasterclassReviewSchema);
MasterclassReviewSchema.plugin(tenantPlugin);

module.exports = mongoose.model('MasterclassReview', MasterclassReviewSchema);
