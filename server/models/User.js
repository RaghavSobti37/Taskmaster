const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: false, select: false }, // Optional — Google OAuth users have no password
  avatar: { type: String },
  gender: { type: String, enum: ['male', 'female', 'other'], default: 'male' },
  dateOfBirth: { type: Date },
  phone: { type: String, default: '', index: true },
  suspended: { type: Boolean, default: false, index: true },
  suspendedAt: { type: Date, default: null },
  suspensionReason: { type: String, default: '' },
  lastOnline: { type: Date, default: Date.now },
  online: { type: Boolean, default: false },
  teams: [{ type: String }],
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', index: true },
  /** Admin-set page access override; empty = inherit from department role. */
  pagePermissions: { type: [String], default: [] },
  exp: { type: Number, default: 0 },
  dailyStreak: { type: Number, default: 0 },
  /** Clerk user id (optional SSO) */
  clerkId: { type: String, unique: true, sparse: true },
  // Google OAuth fields
  googleId: { type: String },
  googleAccessToken: { type: String },
  googleRefreshToken: { type: String },
  googleCalendarLinked: { type: Boolean, default: false },
  googleAccounts: [{
    email: { type: String, required: true },
    accessToken: { type: String },
    refreshToken: { type: String },
    manualLink: { type: Boolean, default: false },
    linkedAt: { type: Date, default: Date.now }
  }],
  repId: { type: String, unique: true, sparse: true }, // For CRM mapping (e.g., sr01, sr02)
  mustChangePassword: { type: Boolean, default: false },
  passwordChangedAt: { type: Date },
  /** Display preference: auto | dmY | mdY | Ymd | dmYDash | mdYDash | dmYShort | mdYShort */
  dateFormatPreference: {
    type: String,
    enum: ['auto', 'dmY', 'mdY', 'Ymd', 'dmYDash', 'mdYDash', 'dmYShort', 'mdYShort'],
    default: 'auto',
  },
  passwordResetToken: { type: String, select: false },
  passwordResetExpires: { type: Date, select: false },
  mfa: {
    enabled: { type: Boolean, default: false },
    secretEncrypted: { type: String, select: false },
    pendingSecretEncrypted: { type: String, select: false },
    backupCodesHash: [{ type: String, select: false }],
  },
  pushSubscriptions: [{
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  }],
});

userSchema.pre('save', async function () {
  if (!this.isModified('password') || !this.password) return;
  if (/^\$2[aby]\$/.test(this.password)) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  if (/^\$2[aby]\$/.test(this.password)) {
    return bcrypt.compare(candidatePassword, this.password);
  }
  return candidatePassword === this.password;
};

userSchema.plugin(tenantPlugin);

module.exports = mongoose.model('User', userSchema);
