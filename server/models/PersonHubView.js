const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const PersonHubViewSchema = new mongoose.Schema({
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true, unique: true, index: true },
  name: { type: String, required: true },
  email: { type: String, index: true, sparse: true },
  phone: { type: String, index: true, sparse: true },
  city: { type: String },
  inletKeys: [{ type: String, index: true }],
  inletCount: { type: Number, default: 0, index: true },
  isMultiInlet: { type: Boolean, default: false, index: true },
  emailStatus: { type: String, enum: ['Active', 'Unsubscribed', 'Invalid', 'Pending', 'Bounced'], default: 'Pending' },
  unsubscribed: { type: Boolean, default: false, index: true },
  lastActivityAt: { type: Date, default: Date.now, index: true },
  /** Earliest identity touch — used for "new this week" (not hub upsert createdAt). */
  firstSeenAt: { type: Date, index: true },
  /** Legacy inlet flags for folder queries during migration */
  inCRM: { type: Boolean, default: false },
  inExly: { type: Boolean, default: false },
  inMailer: { type: Boolean, default: false },
  inOutsourced: { type: Boolean, default: false },
  inBookedCalls: { type: Boolean, default: false },
  inEnquiries: { type: Boolean, default: false },
  inCommunity: { type: Boolean, default: false },
  inNewsletter: { type: Boolean, default: false },
  inArtistPath: { type: Boolean, default: false, index: true },
  inArtistCrm: { type: Boolean, default: false, index: true },
  latestArtistType: { type: String },
  artistPathResponseCount: { type: Number, default: 0 },
}, { timestamps: true });

PersonHubViewSchema.index({ tenantId: 1, email: 1 }, { unique: true, sparse: true });
PersonHubViewSchema.index({ tenantId: 1, phone: 1 }, { unique: true, sparse: true });
PersonHubViewSchema.index({ name: 'text', email: 'text', phone: 'text' });
PersonHubViewSchema.index({ 'inletKeys': 1 });

PersonHubViewSchema.plugin(tenantPlugin);

module.exports = mongoose.model('PersonHubView', PersonHubViewSchema);
