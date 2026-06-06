const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const ArtistPathResponseSchema = new mongoose.Schema({
  personId: { type: mongoose.Schema.Types.ObjectId, ref: 'Person', required: true, index: true },
  submittedAt: { type: Date, default: Date.now, index: true },
  importId: { type: mongoose.Schema.Types.ObjectId, ref: 'CRMImport' },
  sheetRowId: { type: String, index: true },
  answers: { type: mongoose.Schema.Types.Mixed, default: {} },
  rawRow: { type: mongoose.Schema.Types.Mixed, default: {} },
  source: { type: String, default: 'artist_path_sheet', index: true },
}, { timestamps: true });

ArtistPathResponseSchema.index({ personId: 1, submittedAt: -1 });
ArtistPathResponseSchema.index({ sheetRowId: 1 }, { unique: true, sparse: true });

ArtistPathResponseSchema.plugin(tenantPlugin);

module.exports = mongoose.model('ArtistPathResponse', ArtistPathResponseSchema);
