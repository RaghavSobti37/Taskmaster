const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: false }, // Optional — Google OAuth users have no password
  role: { type: String, enum: ['user', 'admin', 'sales', 'artist_management'], default: 'user' },
  avatar: { type: String },
  gender: { type: String, enum: ['male', 'female', 'other'], default: 'male' },
  phone: { type: String, default: '', index: true },
  lastOnline: { type: Date, default: Date.now },
  online: { type: Boolean, default: false },
  teams: [{ type: String }],
  exp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  dailyStreak: { type: Number, default: 0 },
  // Google OAuth fields
  googleId: { type: String },
  googleAccessToken: { type: String },
  googleRefreshToken: { type: String },
  googleCalendarLinked: { type: Boolean, default: false },
  googleAccounts: [{
    email: { type: String, required: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    linkedAt: { type: Date, default: Date.now }
  }],
  repId: { type: String, unique: true, sparse: true }, // For CRM mapping (e.g., sr01, sr02)
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.plugin(tenantPlugin);

module.exports = mongoose.model('User', userSchema);
