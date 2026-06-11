const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const ArtistActivityLogSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
  action: { type: String, required: true },
  label: { type: String, required: true },
  entityType: { type: String },
  entityId: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

ArtistActivityLogSchema.index({ artistId: 1, createdAt: -1 });
ArtistActivityLogSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ArtistActivityLog', ArtistActivityLogSchema);
