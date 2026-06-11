const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const PROFILE_STATUS = ['connected', 'pending', 'error', 'manual'];

const ArtistSocialProfileSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
  platform: { type: String, required: true, index: true },
  accountName: { type: String, default: '' },
  accountId: { type: String, default: '' },
  followers: { type: Number },
  verified: { type: Boolean, default: false },
  lastSync: { type: Date },
  status: { type: String, enum: PROFILE_STATUS, default: 'pending', index: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  connectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ArtistConnection' },
}, { timestamps: true });

ArtistSocialProfileSchema.index({ artistId: 1, platform: 1 }, { unique: true });
ArtistSocialProfileSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ArtistSocialProfile', ArtistSocialProfileSchema);
module.exports.PROFILE_STATUS = PROFILE_STATUS;
