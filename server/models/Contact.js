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

const contactSchema = new mongoose.Schema({
  name: { type: String, required: true },
  nameKey: { type: String, index: true },
  email: { type: String, index: true },
  phone: { type: String, index: true },

  // Data Aggregation Flags
  inCRM: { type: Boolean, default: false },
  inExly: { type: Boolean, default: false },
  inMailer: { type: Boolean, default: false },
  inTsc: { type: Boolean, default: false },
  inBookedCalls: { type: Boolean, default: false },
  inEnquiries: { type: Boolean, default: false },
  inCommunity: { type: Boolean, default: false },

  inlets: [inletEntrySchema],
  inletCount: { type: Number, default: 0, index: true },
  isMultiInlet: { type: Boolean, default: false, index: true },

  // Unified Data Points
  leadStatus: { type: String },
  leadQuality: { type: String },
  exlyOfferings: [{ type: String }],
  city: { type: String },
  sourceFilename: { type: String },

  // Mailer specific tracking
  emailStatus: { type: String, enum: ['Active', 'Unsubscribed', 'Invalid', 'Pending', 'Bounced'], default: 'Pending' },
  bounceCount: { type: Number, default: 0 },
  unsubscribed: { type: Boolean, default: false, index: true },
  unsubscribeReason: { type: String },

  role: { type: String, default: 'Customer' },
  notes: { type: String },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

contactSchema.index({ phone: 1 });
contactSchema.index({ email: 1 });
contactSchema.index({ nameKey: 1 });

contactSchema.pre('save', function(next) {
  try {
    applyPersonIdentityToDoc(this);
    next();
  } catch (err) {
    next(err);
  }
});
contactSchema.index({ 'inlets.key': 1 });
contactSchema.index({ updatedAt: -1 });
contactSchema.index({ name: 'text', email: 'text', phone: 'text' });

contactSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Contact', contactSchema);
