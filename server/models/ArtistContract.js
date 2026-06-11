const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const ArtistContractSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
  gigId: { type: mongoose.Schema.Types.ObjectId, ref: 'ArtistGig' },
  title: { type: String, required: true },
  status: { type: String, enum: ['draft', 'sent', 'signed', 'expired'], default: 'draft' },
  documentUrl: { type: String },
  signedAt: { type: Date },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

ArtistContractSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ArtistContract', ArtistContractSchema);
