const mongoose = require('mongoose');

const ArtistMetricsSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
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
  history: [{
    date: { type: Date, default: Date.now },
    views: { type: Number },
    likes: { type: Number },
    listens: { type: Number },
    followers: { type: Number }
  }],
  analyticsHistory: [{
    timestamp: { type: Date, default: Date.now, index: true },
    platform: { type: String, enum: ['spotify', 'youtube', 'meta', 'overall'] },
    metrics: { type: mongoose.Schema.Types.Mixed }
  }]
});

module.exports = mongoose.model('ArtistMetrics', ArtistMetricsSchema);
