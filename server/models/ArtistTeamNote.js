const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const ArtistTeamNoteSchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  authorName: { type: String },
  body: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

ArtistTeamNoteSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ArtistTeamNote', ArtistTeamNoteSchema);
