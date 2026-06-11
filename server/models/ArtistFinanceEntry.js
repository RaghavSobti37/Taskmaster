const mongoose = require('mongoose');
const tenantPlugin = require('../plugins/tenantPlugin');

const CATEGORIES = ['Travel', 'Hotel', 'Food', 'Production', 'Marketing', 'Management', 'Misc', 'Revenue'];

const ArtistFinanceEntrySchema = new mongoose.Schema({
  artistId: { type: mongoose.Schema.Types.ObjectId, ref: 'Artist', required: true, index: true },
  type: { type: String, enum: ['revenue', 'expense'], required: true },
  category: { type: String, enum: CATEGORIES, default: 'Misc' },
  amount: { type: Number, required: true, min: 0 },
  entryDate: { type: Date, required: true, index: true },
  description: { type: String },
  gigId: { type: mongoose.Schema.Types.ObjectId, ref: 'ArtistGig' },
  documentId: { type: String },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

ArtistFinanceEntrySchema.index({ artistId: 1, entryDate: -1 });
ArtistFinanceEntrySchema.plugin(tenantPlugin);

module.exports = mongoose.model('ArtistFinanceEntry', ArtistFinanceEntrySchema);
module.exports.EXPENSE_CATEGORIES = CATEGORIES;
