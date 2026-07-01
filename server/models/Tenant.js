const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  /** Deployment slug, e.g. theshakticollective */
  slug: { type: String, unique: true, sparse: true, index: true },
  domain: { type: String, unique: true, sparse: true }, // Optional custom domain
  /** Clerk organization id for this deployment */
  clerkOrganizationId: { type: String, unique: true, sparse: true, index: true },
  /** Users with this email domain may auto-join the Clerk org (invites always allowed) */
  allowedEmailDomain: { type: String, trim: true, lowercase: true },
  status: { type: String, enum: ['active', 'suspended', 'trial'], default: 'trial' },
  contactEmail: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tenant', tenantSchema);
