const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const ArtistContentReleaseSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
  title: { type: String, required: true },
  releaseType: { type: String, default: 'single' },
  releaseDate: { type: Date, required: true, index: true },
  spotifyStreams: { type: Number, default: 0 },
  youtubeViews: { type: Number, default: 0 },
  reelsCount: { type: Number, default: 0 },
  revenueImpact: { type: Number, default: 0 },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

ArtistContentReleaseSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ArtistContentRelease', ArtistContentReleaseSchema);
