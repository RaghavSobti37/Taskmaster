const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const ArtistAudienceSnapshotSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
  platform: { type: String, required: true, index: true },
  capturedAt: { type: Date, required: true, default: Date.now, index: true },
  demographics: { type: mongoose.Schema.Types.Mixed, default: {} },
  reach: { type: Number, default: 0 },
  followers: { type: Number, default: 0 },
}, { timestamps: true });

ArtistAudienceSnapshotSchema.index({ artistId: 1, platform: 1, capturedAt: -1 });
ArtistAudienceSnapshotSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ArtistAudienceSnapshot', ArtistAudienceSnapshotSchema);
