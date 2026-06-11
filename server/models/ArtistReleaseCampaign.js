const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const DspLinkSchema = new mongoose.Schema({
  platform: { type: String, required: true },
  url: { type: String, required: true },
}, { _id: false });

const ArtistReleaseCampaignSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
  title: { type: String, required: true },
  releaseDate: { type: Date, required: true, index: true },
  dspLinks: { type: [DspLinkSchema], default: [] },
  distributor: { type: String },
  upc: { type: String },
  isrc: { type: String },
  campaignNotes: { type: String },
  contentReleaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'ArtistContentRelease' },
}, { timestamps: true });

ArtistReleaseCampaignSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ArtistReleaseCampaign', ArtistReleaseCampaignSchema);
