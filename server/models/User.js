const mongoose = require('mongoose');
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
  // Google OAuth fields
  googleId: { type: String },
  googleAccessToken: { type: String },
  googleRefreshToken: { type: String },
  googleCalendarLinked: { type: Boolean, default: false },
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

module.exports = mongoose.model('User', userSchema);
