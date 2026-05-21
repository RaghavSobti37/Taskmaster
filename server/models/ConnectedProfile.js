const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

const ConnectedProfileSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  platform: { type: String, required: true, enum: ['spotify', 'youtube', 'meta', 'songstats'] },
  platformId: { type: String, required: true },
  platformName: { type: String },
  accessToken: { type: String, select: false },
  refreshToken: { type: String, select: false },
  tokenExpiry: { type: Date },
  profileData: { type: mongoose.Schema.Types.Mixed },
  status: { type: String, enum: ['active', 'error', 'revoked'], default: 'active' },
  lastSyncedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// Encrypt tokens before save
ConnectedProfileSchema.pre('save', function(next) {
  if (this.isModified('accessToken') && this.accessToken && !this.accessToken.includes(':')) {
    this.accessToken = encrypt(this.accessToken);
  }
  if (this.isModified('refreshToken') && this.refreshToken && !this.refreshToken.includes(':')) {
    this.refreshToken = encrypt(this.refreshToken);
  }
  next();
});

// Helper methods to get decrypted tokens
ConnectedProfileSchema.methods.getAccessToken = function() {
  return decrypt(this.accessToken);
};
ConnectedProfileSchema.methods.getRefreshToken = function() {
  return decrypt(this.refreshToken);
};

module.exports = mongoose.model('ConnectedProfile', ConnectedProfileSchema);
