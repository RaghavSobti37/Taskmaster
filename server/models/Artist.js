const mongoose = require('mongoose');

const ArtistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  bio: { type: String },
  profileImage: { type: String },
  website: { type: String },
  socials: {
    youtube: { type: String },
    instagram: { type: String },
    instagramCollective: { type: String },
    facebook: { type: String },
    spotify: { type: String },
    soundcloud: { type: String }
  },
  analytics: {
    youtube: {
      subscribers: { type: Number, default: 0 },
      views: { type: Number, default: 0 },
      watchTime: { type: Number, default: 0 },
      avd: { type: String },
      trafficSources: {
        suggested: { type: Number, default: 0 },
        search: { type: Number, default: 0 }
      },
      returningViewers: { type: Number, default: 0 }
    },
    instagram: {
      followers: { type: Number, default: 0 },
      reelsPerformance: {
        views: { type: Number, default: 0 },
        saves: { type: Number, default: 0 },
        shares: { type: Number, default: 0 }
      },
      followerVelocity: { type: Number, default: 0 },
      audienceQuality: { type: Number, default: 0 },
      profileVisitRatio: { type: Number, default: 0 }
    },
    spotify: {
      monthlyListeners: { type: Number, default: 0 },
      followers: { type: Number, default: 0 },
      streamsPerListener: { type: Number, default: 0 },
      playlistAdditions: { type: Number, default: 0 },
      mal: { type: Number, default: 0 },
      triggerCities: [{ type: String }]
    },
    facebook: {
      likes: { type: Number, default: 0 },
      followers: { type: Number, default: 0 },
      name: { type: String },
      ctr: { type: Number, default: 0 },
      topFanEngagement: { type: Number, default: 0 },
      postReach: {
        organic: { type: Number, default: 0 },
        paid: { type: Number, default: 0 }
      }
    },
    tracks: [{ type: mongoose.Schema.Types.Mixed }],
    videos: [{ type: mongoose.Schema.Types.Mixed }],
    posts: [{ type: mongoose.Schema.Types.Mixed }]
  },
  trackedVideos: [{
    videoId: { type: String },
    title: { type: String },
    channelName: { type: String },
    isNative: { type: Boolean, default: true },
    views: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    watchTimeMinutes: { type: Number, default: 0 },
    thumbnailCtr: { type: Number, default: 0 },
    url: { type: String },
    addedAt: { type: Date, default: Date.now }
  }],
  events: [{
    date: { type: String },
    venue: { type: String },
    audience: { type: String },
    title: { type: String },
    description: { type: String },
    status: { type: String, default: 'planned' }
  }],
  discography: [{
    title: { type: String },
    type: { type: String },
    spotify: { type: String },
    youtube: { type: String }
  }],
  history: [{
    date: { type: Date, default: Date.now },
    views: { type: Number },
    likes: { type: Number },
    listens: { type: Number },
    followers: { type: Number }
  }],
  team: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
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
  analyticsHistory: [{
    timestamp: { type: Date, default: Date.now, index: true },
    platform: { type: String, enum: ['spotify', 'youtube', 'meta', 'overall'] },
    metrics: { type: mongoose.Schema.Types.Mixed }
  }],
  isSynced: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

// Input sanitization hook
ArtistSchema.pre('save', function(next) {
  if (this.name) this.name = this.name.trim().replace(/\s+/g, ' ');
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

module.exports = mongoose.model('Artist', ArtistSchema);
