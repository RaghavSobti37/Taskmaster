const mongoose = require('mongoose');

const ArtistAuthSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true, unique: true },
  oauthCredentials: {
    youtube: {
      accessToken: { type: String, select: false },
      refreshToken: { type: String, select: false },
      channelId: { type: String },
      tokenExpiry: { type: Date }
    },
    meta: {
      accessToken: { type: String, select: false },
      igAccountId: { type: String },
      fbPageId: { type: String },
      tokenExpiry: { type: Date },
      availableAccounts: [{
        fbPageId: { type: String },
        fbPageName: { type: String },
        igAccountId: { type: String },
        igUsername: { type: String },
        igName: { type: String },
        igProfilePicture: { type: String }
      }]
    },
    spotify: {
      artistId: { type: String },
      chartmetricId: { type: String },
      accessToken: { type: String, select: false },
      refreshToken: { type: String, select: false },
      tokenExpiry: { type: Date },
      spotifyUserId: { type: String },
      displayName: { type: String },
      connectedAt: { type: Date }
    }
  },
  isSynced: { type: Boolean, default: false }
});

// Input sanitization hook
ArtistAuthSchema.pre('save', function(next) {
  if (this.oauthCredentials?.spotify?.artistId) {
    this.oauthCredentials.spotify.artistId = this.oauthCredentials.spotify.artistId.trim();
  }
  if (this.oauthCredentials?.youtube?.channelId) {
    this.oauthCredentials.youtube.channelId = this.oauthCredentials.youtube.channelId.trim();
  }
  if (this.oauthCredentials?.meta?.igAccountId) {
    this.oauthCredentials.meta.igAccountId = this.oauthCredentials.meta.igAccountId.trim();
  }
  next();
});

module.exports = mongoose.model('ArtistAuth', ArtistAuthSchema);
