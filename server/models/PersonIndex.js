const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');
const { applyPersonIdentityToDoc } = require('../utils/personNormalization');

const inletEntrySchema = new mongoose.Schema({
  key: { type: String, required: true },
  recordIds: [{ type: mongoose.Schema.Types.ObjectId }],
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  summary: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });

const personIndexSchema = new mongoose.Schema({
  name: { type: String, required: true },
  nameKey: { type: String, index: true },
  email: { type: String, index: true },
  phone: { type: String, index: true },

  inCRM: { type: Boolean, default: false },
  inExly: { type: Boolean, default: false },
  inMailer: { type: Boolean, default: false },
  inOutsourced: { type: Boolean, default: false },
  inBookedCalls: { type: Boolean, default: false },
  inEnquiries: { type: Boolean, default: false },
  inCommunity: { type: Boolean, default: false },
  inNewsletter: { type: Boolean, default: false },
  inArtistPath: { type: Boolean, default: false },
  inArtistCrm: { type: Boolean, default: false },

  /** @deprecated use inOutsourced — kept for migration reads */
  inTsc: { type: Boolean, default: false },

  inlets: [inletEntrySchema],
  inletCount: { type: Number, default: 0, index: true },
  isMultiInlet: { type: Boolean, default: false, index: true },

  leadStatus: { type: String },
  leadQuality: { type: String },
  exlyOfferings: [{ type: String }],
  city: { type: String },
  sourceFilename: { type: String },

  emailStatus: { type: String, enum: ['Active', 'Unsubscribed', 'Invalid', 'Pending', 'Bounced'], default: 'Pending' },
  bounceCount: { type: Number, default: 0 },
  unsubscribed: { type: Boolean, default: false, index: true },
  unsubscribeReason: { type: String },
}, { timestamps: true });

personIndexSchema.index({ phone: 1 });
personIndexSchema.index({ email: 1 });
personIndexSchema.index({ nameKey: 1 });
personIndexSchema.index({ 'inlets.key': 1 });
personIndexSchema.index({ updatedAt: -1 });
personIndexSchema.index({ name: 'text', email: 'text', phone: 'text' });

personIndexSchema.pre('save', function (next) {
  try {
    applyPersonIdentityToDoc(this);
    next();
  } catch (err) {
    next(err);
  }
});

personIndexSchema.plugin(tenantPlugin);

module.exports = mongoose.model('PersonIndex', personIndexSchema);
