const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

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
  team: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
});

ArtistSchema.virtual('metricsData', {
  ref: 'ArtistMetrics',
  localField: '_id',
  foreignField: 'artistId',
  justOne: true
});

ArtistSchema.virtual('authData', {
  ref: 'ArtistAuth',
  localField: '_id',
  foreignField: 'artistId',
  justOne: true
});

// Proxy properties for backwards compatibility
ArtistSchema.virtual('analytics').get(function() { return this.metricsData?.analytics; });
ArtistSchema.virtual('trackedVideos').get(function() { return this.metricsData?.trackedVideos; });
ArtistSchema.virtual('history').get(function() { return this.metricsData?.history; });
ArtistSchema.virtual('analyticsHistory').get(function() { return this.metricsData?.analyticsHistory; });
ArtistSchema.virtual('oauthCredentials').get(function() { return this.authData?.oauthCredentials; });
ArtistSchema.virtual('isSynced').get(function() { return this.authData?.isSynced; });

ArtistSchema.set('toObject', { virtuals: true });
ArtistSchema.set('toJSON', { virtuals: true });

// Input sanitization hook
ArtistSchema.pre('save', function(next) {
  if (this.name) this.name = this.name.trim().replace(/\s+/g, ' ');
  next();
});

ArtistSchema.plugin(tenantPlugin);

module.exports = mongoose.model('Artist', ArtistSchema);
