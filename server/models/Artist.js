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
      ctr: { type: Number, default: 0 },
      topFanEngagement: { type: Number, default: 0 },
      postReach: {
        organic: { type: Number, default: 0 },
        paid: { type: Number, default: 0 }
      }
    }
  },
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
      tokenExpiry: { type: Date }
    },
    spotify: {
      artistId: { type: String },
      chartmetricId: { type: String }
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

module.exports = mongoose.model('Artist', ArtistSchema);
