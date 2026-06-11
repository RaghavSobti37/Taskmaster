const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const ASSET_TYPES = ['artwork', 'poster', 'reel', 'press', 'logo', 'epk'];

const ArtistAssetSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
  type: { type: String, enum: ASSET_TYPES, required: true, index: true },
  title: { type: String, required: true },
  url: { type: String, required: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tags: [{ type: String }],
}, { timestamps: true });

ArtistAssetSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ArtistAsset', ArtistAssetSchema);
module.exports.ASSET_TYPES = ASSET_TYPES;
