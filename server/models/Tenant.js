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
  plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  settings: {
    defaultCurrency: { type: String, default: 'INR' },
    dateFormat: { type: String, default: 'DD/MM/YYYY' },
    timezone: { type: String, default: 'Asia/Kolkata' },
  },
  featureUnlocks: {
    resend: { type: Boolean, default: false },
    google: { type: Boolean, default: false },
    meta: { type: Boolean, default: false },
    knowledgeEngine: { type: Boolean, default: false },
    finance: { type: Boolean, default: false },
    artistOs: { type: Boolean, default: false },
  },
  onboardingProgress: {
    dismissedChecklist: { type: Boolean, default: false },
    completedSteps: [{ type: String }],
  },
  security: {
    mfaRequired: { type: Boolean, default: false },
    ssoOnly: { type: Boolean, default: false },
    ipAllowlist: [{ type: String }],
    sessionMaxDays: { type: Number, default: 30 },
    idleTimeoutMinutes: { type: Number, default: 0 },
    passwordMinLength: { type: Number, default: 8 },
  },
  sso: {
    provider: { type: String, enum: ['', 'saml', 'oidc'], default: '' },
    metadataUrl: { type: String },
    clientId: { type: String },
    enforceSSO: { type: Boolean, default: false },
    jitDefaultRole: { type: String, default: 'standard' },
    scimBearerHash: { type: String, select: false },
    scimBearerPrefix: { type: String },
  },
  branding: {
    logoUrl: { type: String },
    accentColor: { type: String },
    customEmailDomain: { type: String },
    customAppDomain: { type: String },
  },
  domainVerification: {
    claimedDomain: { type: String },
    txtToken: { type: String },
    verifiedAt: { type: Date },
    autoAttachSignups: { type: Boolean, default: false },
    requireAdminApproval: { type: Boolean, default: true },
  },
  offboarding: {
    scheduledDeletionAt: { type: Date },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  auditRetentionDays: { type: Number, default: 90 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Tenant', tenantSchema);
